/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as playwright from 'playwright';
import yaml from 'yaml';
import path from 'path';
import fs from 'fs';

import { waitForCompletion } from './tools/utils';
import { ManualPromise } from './manualPromise';

import type { ImageContent, TextContent } from '@modelcontextprotocol/sdk/types';
import type { ModalState, Tool, ToolActionResult } from './tools/tool';

export type ContextOptions = {
  browserName?: 'chromium' | 'firefox' | 'webkit';
  userDataDir: string;
  launchOptions?: playwright.LaunchOptions;
  cdpEndpoint?: string;
  remoteEndpoint?: string;
  recordVideo?: boolean;
  videoDir?: string;
  // 트레이스 관련 옵션 추가
  traceEnabled?: boolean;
  traceDir?: string;
  traceName?: string;
  traceScreenshots?: boolean;
  traceSnapshots?: boolean;
};

type PageOrFrameLocator = playwright.Page | playwright.FrameLocator;

type PendingAction = {
  dialogShown: ManualPromise<void>;
};

export class Context {
  readonly tools: Tool[];
  readonly options: ContextOptions;
  private _browser: playwright.Browser | undefined;
  private _browserContext: playwright.BrowserContext | undefined;
  private _tabs: Tab[] = [];
  private _currentTab: Tab | undefined;
  private _modalStates: (ModalState & { tab: Tab })[] = [];
  private _pendingAction: PendingAction | undefined;

  constructor(tools: Tool[], options: ContextOptions) {
    this.tools = tools;
    this.options = options;
  }

  modalStates(): ModalState[] {
    return this._modalStates;
  }

  setModalState(modalState: ModalState, inTab: Tab) {
    this._modalStates.push({ ...modalState, tab: inTab });
  }

  clearModalState(modalState: ModalState) {
    this._modalStates = this._modalStates.filter(state => state !== modalState);
  }

  modalStatesMarkdown(): string[] {
    const result: string[] = ['### Modal state'];
    for (const state of this._modalStates) {
      const tool = this.tools.find(tool => tool.clearsModalState === state.type);
      result.push(`- [${state.description}]: can be handled by the "${tool?.schema.name}" tool`);
    }
    return result;
  }

  tabs(): Tab[] {
    return this._tabs;
  }

  currentTabOrDie(): Tab {
    if (!this._currentTab)
      throw new Error('No current snapshot available. Capture a snapshot of navigate to a new location first.');
    return this._currentTab;
  }

  async newTab(): Promise<Tab> {
    const browserContext = await this._ensureBrowserContext();
    const page = await browserContext.newPage();
    this._currentTab = this._tabs.find(t => t.page === page)!;
    return this._currentTab;
  }

  async selectTab(index: number) {
    this._currentTab = this._tabs[index - 1];
    await this._currentTab.page.bringToFront();
  }

  async ensureTab(): Promise<Tab> {
    const context = await this._ensureBrowserContext();
    if (!this._currentTab)
      await context.newPage();
    return this._currentTab!;
  }

  async listTabsMarkdown(): Promise<string> {
    if (!this._tabs.length)
      return '### No tabs open';
    const lines: string[] = ['### Open tabs'];
    for (let i = 0; i < this._tabs.length; i++) {
      const tab = this._tabs[i];
      const title = await tab.page.title();
      const url = tab.page.url();
      const current = tab === this._currentTab ? ' (current)' : '';
      lines.push(`- ${i + 1}:${current} [${title}] (${url})`);
    }
    return lines.join('\n');
  }

  async closeTab(index: number | undefined) {
    const tab = index === undefined ? this._currentTab : this._tabs[index - 1];
    await tab?.page.close();
    return await this.listTabsMarkdown();
  }

  async run(tool: Tool, params: Record<string, unknown> | undefined) {
    // Tab management is done outside of the action() call.
    const toolResult = await tool.handle(this, tool.schema.inputSchema.parse(params));
    const { code, action, waitForNetwork, captureSnapshot, resultOverride } = toolResult;
    const racingAction = action ? () => this._raceAgainstModalDialogs(action) : undefined;

    if (resultOverride)
      return resultOverride;

    if (!this._currentTab) {
      return {
        content: [{
          type: 'text',
          text: 'No open pages available. Use the "browser_navigate" tool to navigate to a page first.',
        }],
      };
    }

    const tab = this.currentTabOrDie();
    // TODO: race against modal dialogs to resolve clicks.
    let actionResult: { content?: (ImageContent | TextContent)[] } | undefined;
    try {
      if (waitForNetwork)
        actionResult = await waitForCompletion(this, tab.page, async () => racingAction?.()) ?? undefined;
      else
        actionResult = await racingAction?.() ?? undefined;
    } finally {
      if (captureSnapshot && !this._javaScriptBlocked())
        await tab.captureSnapshot();
    }

    const result: string[] = [];
    result.push(`- Ran Playwright code:
\`\`\`js
${code.join('\n')}
\`\`\`
`);

    if (this.modalStates().length) {
      result.push(...this.modalStatesMarkdown());
      return {
        content: [{
          type: 'text',
          text: result.join('\n'),
        }],
      };
    }

    if (this.tabs().length > 1)
      result.push(await this.listTabsMarkdown(), '');

    if (this.tabs().length > 1)
      result.push('### Current tab');

    result.push(
        `- Page URL: ${tab.page.url()}`,
        `- Page Title: ${await tab.page.title()}`
    );

    if (captureSnapshot && tab.hasSnapshot())
      result.push(tab.snapshotOrDie().text());

    const content = actionResult?.content ?? [];

    return {
      content: [
        ...content,
        {
          type: 'text',
          text: result.join('\n'),
        }
      ],
    };
  }

  async waitForTimeout(time: number) {
    if (this._currentTab && !this._javaScriptBlocked())
      await this._currentTab.page.evaluate(() => new Promise(f => setTimeout(f, 1000)));
    else
      await new Promise(f => setTimeout(f, time));
  }

  private async _raceAgainstModalDialogs(action: () => Promise<ToolActionResult>): Promise<ToolActionResult> {
    this._pendingAction = {
      dialogShown: new ManualPromise(),
    };

    let result: ToolActionResult | undefined;
    try {
      await Promise.race([
        action().then(r => result = r),
        this._pendingAction.dialogShown,
      ]);
    } finally {
      this._pendingAction = undefined;
    }
    return result;
  }

  private _javaScriptBlocked(): boolean {
    return this._modalStates.some(state => state.type === 'dialog');
  }

  dialogShown(tab: Tab, dialog: playwright.Dialog) {
    this.setModalState({
      type: 'dialog',
      description: `"${dialog.type()}" dialog with message "${dialog.message()}"`,
      dialog,
    }, tab);
    this._pendingAction?.dialogShown.resolve();
  }

  private _onPageCreated(page: playwright.Page) {
    const tab = new Tab(this, page, tab => this._onPageClosed(tab));
    this._tabs.push(tab);
    if (!this._currentTab)
      this._currentTab = tab;
  }

  private _onPageClosed(tab: Tab) {
    this._modalStates = this._modalStates.filter(state => state.tab !== tab);
    const index = this._tabs.indexOf(tab);
    if (index === -1)
      return;
    this._tabs.splice(index, 1);

    if (this._currentTab === tab)
      this._currentTab = this._tabs[Math.min(index, this._tabs.length - 1)];
    if (this._browserContext && !this._tabs.length)
      void this.close();
  }

  async close() {
    if (!this._browserContext)
      return;
    const browserContext = this._browserContext;
    const browser = this._browser;
    this._browserContext = undefined;
    this._browser = undefined;

    await browserContext?.close().then(async () => {
      await browser?.close();
    }).catch(() => {});
  }

  private async _ensureBrowserContext() {
    if (!this._browserContext) {
      const context = await this._createBrowserContext();
      this._browser = context.browser;
      this._browserContext = context.browserContext;
      for (const page of this._browserContext.pages())
        this._onPageCreated(page);
      this._browserContext.on('page', page => this._onPageCreated(page));
    }
    return this._browserContext;
  }

  private async _createBrowserContext(): Promise<{ browser?: playwright.Browser, browserContext: playwright.BrowserContext }> {
    if (this.options.remoteEndpoint) {
      const url = new URL(this.options.remoteEndpoint);
      if (this.options.browserName)
        url.searchParams.set('browser', this.options.browserName);
      if (this.options.launchOptions)
        url.searchParams.set('launch-options', JSON.stringify(this.options.launchOptions));
      const browser = await playwright[this.options.browserName ?? 'chromium'].connect(String(url));
      const browserContext = await browser.newContext();
      return { browser, browserContext };
    }

    if (this.options.cdpEndpoint) {
      const browser = await playwright.chromium.connectOverCDP(this.options.cdpEndpoint);
      const browserContext = browser.contexts()[0];
      return { browser, browserContext };
    }

    const browserContext = await this._launchPersistentContext();
    return { browserContext };
  }

  private async _launchPersistentContext(): Promise<playwright.BrowserContext> {
    try {
      const browserType = this.options.browserName ? playwright[this.options.browserName] : playwright.chromium;
      
      // 컨텍스트 옵션 설정
      const contextOptions = { ...this.options.launchOptions } as any;
      
      // 비디오 녹화 옵션
      if (this.options.recordVideo) {
        // 비디오 저장 디렉토리 설정
        const videoDir = this.options.videoDir || path.join(process.cwd(), 'mcp_videos');
        
        // 비디오 디렉토리가 없으면 생성
        if (!fs.existsSync(videoDir)) {
          fs.mkdirSync(videoDir, { recursive: true });
        }
        
        // recordVideo 옵션 추가 (타입 단언 사용)
        contextOptions.recordVideo = {
          dir: videoDir,
          size: { width: 800, height: 600 }
        };
      }
      
      // 트레이스 옵션 추가
      if (this.options.traceEnabled) {
        // 트레이스 기본 옵션 설정
        contextOptions.tracing = {
          mode: 'on',
          screenshots: this.options.traceScreenshots !== false,
          snapshots: this.options.traceSnapshots !== false,
          dir: this.options.traceDir || path.join(process.cwd(), 'mcp_traces')
        };
        
        // 트레이스 디렉토리가 없으면 생성
        if (!fs.existsSync(contextOptions.tracing.dir)) {
          fs.mkdirSync(contextOptions.tracing.dir, { recursive: true });
        }
      }
      
      return await browserType.launchPersistentContext(this.options.userDataDir, contextOptions);
    } catch (error: any) {
      if (error.message.includes('Executable doesn\'t exist'))
        throw new Error(`Browser specified in your config is not installed. Either install it (likely) or change the config.`);
      throw error;
    }
  }
}

export class Tab {
  readonly context: Context;
  readonly page: playwright.Page;
  private _console: playwright.ConsoleMessage[] = [];
  private _requests: Map<playwright.Request, playwright.Response | null> = new Map();
  private _snapshot: PageSnapshot | undefined;
  private _onPageClose: (tab: Tab) => void;
  private _videoPath: string | undefined;

  constructor(context: Context, page: playwright.Page, onPageClose: (tab: Tab) => void) {
    this.context = context;
    this.page = page;
    this._onPageClose = onPageClose;
    page.on('console', event => this._console.push(event));
    page.on('request', request => this._requests.set(request, null));
    page.on('response', response => this._requests.set(response.request(), response));
    page.on('framenavigated', frame => {
      if (!frame.parentFrame())
        this._clearCollectedArtifacts();
    });
    page.on('close', () => this._onClose());
    page.on('filechooser', chooser => {
      this.context.setModalState({
        type: 'fileChooser',
        description: 'File chooser',
        fileChooser: chooser,
      }, this);
    });
    page.on('dialog', dialog => this.context.dialogShown(this, dialog));
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(5000);
  }

  private _clearCollectedArtifacts() {
    this._console.length = 0;
    this._requests.clear();
  }

  private _onClose() {
    this._clearCollectedArtifacts();
    this._onPageClose(this);
  }

  async navigate(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    // Cap load event to 5 seconds, the page is operational at this point.
    await this.page.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
  }

  hasSnapshot(): boolean {
    return !!this._snapshot;
  }

  snapshotOrDie(): PageSnapshot {
    if (!this._snapshot)
      throw new Error('No snapshot available');
    return this._snapshot;
  }

  console(): playwright.ConsoleMessage[] {
    return this._console;
  }

  requests(): Map<playwright.Request, playwright.Response | null> {
    return this._requests;
  }

  async captureSnapshot() {
    this._snapshot = await PageSnapshot.create(this.page);
  }
  
  async getVideoPath(): Promise<string | undefined> {
    try {
      // 비디오 메서드가 존재하는지 확인
      const video = this.page.video();
      if (video) {
        this._videoPath = await video.path();
        return this._videoPath;
      }
      return undefined;
    } catch (error) {
      console.error('비디오 경로를 가져오는 중 오류 발생:', error);
      return undefined;
    }
  }
  
  async saveVideo(filePath: string): Promise<boolean> {
    try {
      const video = this.page.video();
      if (video) {
        await video.saveAs(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('비디오 저장 중 오류 발생:', error);
      return false;
    }
  }
  
  async startTracing(options?: { screenshots?: boolean, snapshots?: boolean }): Promise<boolean> {
    try {
      // 브라우저 컨텍스트에서 tracing API 사용
      const context = this.page.context();
      await context.tracing.start({
        screenshots: options?.screenshots ?? true,
        snapshots: options?.snapshots ?? true,
      });
      return true;
    } catch (error) {
      console.error('트레이스 기록 시작 중 오류 발생:', error);
      return false;
    }
  }
  
  async stopTracing(path: string): Promise<boolean> {
    try {
      const context = this.page.context();
      await context.tracing.stop({ path });
      return true;
    } catch (error) {
      console.error('트레이스 기록 중지 중 오류 발생:', error);
      return false;
    }
  }
}

class PageSnapshot {
  private _frameLocators: PageOrFrameLocator[] = [];
  private _text!: string;

  constructor() {
  }

  static async create(page: playwright.Page): Promise<PageSnapshot> {
    const snapshot = new PageSnapshot();
    await snapshot._build(page);
    return snapshot;
  }

  text(): string {
    return this._text;
  }

  private async _build(page: playwright.Page) {
    const yamlDocument = await this._snapshotFrame(page);
    this._text = [
      `- Page Snapshot`,
      '```yaml',
      yamlDocument.toString({ indentSeq: false }).trim(),
      '```',
    ].join('\n');
  }

  private async _snapshotFrame(frame: playwright.Page | playwright.FrameLocator) {
    const frameIndex = this._frameLocators.push(frame) - 1;
    const snapshotString = await frame.locator('body').ariaSnapshot({ ref: true, emitGeneric: true });
    const snapshot = yaml.parseDocument(snapshotString);

    const visit = async (node: any): Promise<unknown> => {
      if (yaml.isPair(node)) {
        await Promise.all([
          visit(node.key).then(k => node.key = k),
          visit(node.value).then(v => node.value = v)
        ]);
      } else if (yaml.isSeq(node) || yaml.isMap(node)) {
        node.items = await Promise.all(node.items.map(visit));
      } else if (yaml.isScalar(node)) {
        if (typeof node.value === 'string') {
          const value = node.value;
          if (frameIndex > 0)
            node.value = value.replace('[ref=', `[ref=f${frameIndex}`);
          if (value.startsWith('iframe ')) {
            const ref = value.match(/\[ref=(.*)\]/)?.[1];
            if (ref) {
              try {
                const childSnapshot = await this._snapshotFrame(frame.frameLocator(`aria-ref=${ref}`));
                return snapshot.createPair(node.value, childSnapshot);
              } catch (error) {
                return snapshot.createPair(node.value, '<could not take iframe snapshot>');
              }
            }
          }
        }
      }

      return node;
    };
    await visit(snapshot.contents);
    return snapshot;
  }

  refLocator(ref: string): playwright.Locator {
    let frame = this._frameLocators[0];
    const match = ref.match(/^f(\d+)(.*)/);
    if (match) {
      const frameIndex = parseInt(match[1], 10);
      frame = this._frameLocators[frameIndex];
      ref = match[2];
    }

    if (!frame)
      throw new Error(`Frame does not exist. Provide ref from the most current snapshot.`);

    return frame.locator(`aria-ref=${ref}`);
  }
}

export async function generateLocator(locator: playwright.Locator): Promise<string> {
  return (locator as any)._generateLocatorString();
}
