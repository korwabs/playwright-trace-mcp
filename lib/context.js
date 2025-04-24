"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tab = exports.Context = void 0;
exports.generateLocator = generateLocator;
const playwright = __importStar(require("playwright"));
const yaml_1 = __importDefault(require("yaml"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("./tools/utils");
const manualPromise_1 = require("./manualPromise");
class Context {
    tools;
    options;
    _browser;
    _browserContext;
    _tabs = [];
    _currentTab;
    _modalStates = [];
    _pendingAction;
    constructor(tools, options) {
        this.tools = tools;
        this.options = options;
    }
    modalStates() {
        return this._modalStates;
    }
    setModalState(modalState, inTab) {
        this._modalStates.push({ ...modalState, tab: inTab });
    }
    clearModalState(modalState) {
        this._modalStates = this._modalStates.filter(state => state !== modalState);
    }
    modalStatesMarkdown() {
        const result = ['### Modal state'];
        for (const state of this._modalStates) {
            const tool = this.tools.find(tool => tool.clearsModalState === state.type);
            result.push(`- [${state.description}]: can be handled by the "${tool?.schema.name}" tool`);
        }
        return result;
    }
    tabs() {
        return this._tabs;
    }
    currentTabOrDie() {
        if (!this._currentTab)
            throw new Error('No current snapshot available. Capture a snapshot of navigate to a new location first.');
        return this._currentTab;
    }
    async newTab() {
        const browserContext = await this._ensureBrowserContext();
        const page = await browserContext.newPage();
        this._currentTab = this._tabs.find(t => t.page === page);
        return this._currentTab;
    }
    async selectTab(index) {
        this._currentTab = this._tabs[index - 1];
        await this._currentTab.page.bringToFront();
    }
    async ensureTab() {
        const context = await this._ensureBrowserContext();
        if (!this._currentTab)
            await context.newPage();
        return this._currentTab;
    }
    async listTabsMarkdown() {
        if (!this._tabs.length)
            return '### No tabs open';
        const lines = ['### Open tabs'];
        for (let i = 0; i < this._tabs.length; i++) {
            const tab = this._tabs[i];
            const title = await tab.page.title();
            const url = tab.page.url();
            const current = tab === this._currentTab ? ' (current)' : '';
            lines.push(`- ${i + 1}:${current} [${title}] (${url})`);
        }
        return lines.join('\n');
    }
    async closeTab(index) {
        const tab = index === undefined ? this._currentTab : this._tabs[index - 1];
        await tab?.page.close();
        return await this.listTabsMarkdown();
    }
    async run(tool, params) {
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
        let actionResult;
        try {
            if (waitForNetwork)
                actionResult = await (0, utils_1.waitForCompletion)(this, tab.page, async () => racingAction?.()) ?? undefined;
            else
                actionResult = await racingAction?.() ?? undefined;
        }
        finally {
            if (captureSnapshot && !this._javaScriptBlocked())
                await tab.captureSnapshot();
        }
        const result = [];
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
        result.push(`- Page URL: ${tab.page.url()}`, `- Page Title: ${await tab.page.title()}`);
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
    async waitForTimeout(time) {
        if (this._currentTab && !this._javaScriptBlocked())
            await this._currentTab.page.evaluate(() => new Promise(f => setTimeout(f, 1000)));
        else
            await new Promise(f => setTimeout(f, time));
    }
    async _raceAgainstModalDialogs(action) {
        this._pendingAction = {
            dialogShown: new manualPromise_1.ManualPromise(),
        };
        let result;
        try {
            await Promise.race([
                action().then(r => result = r),
                this._pendingAction.dialogShown,
            ]);
        }
        finally {
            this._pendingAction = undefined;
        }
        return result;
    }
    _javaScriptBlocked() {
        return this._modalStates.some(state => state.type === 'dialog');
    }
    dialogShown(tab, dialog) {
        this.setModalState({
            type: 'dialog',
            description: `"${dialog.type()}" dialog with message "${dialog.message()}"`,
            dialog,
        }, tab);
        this._pendingAction?.dialogShown.resolve();
    }
    _onPageCreated(page) {
        const tab = new Tab(this, page, tab => this._onPageClosed(tab));
        this._tabs.push(tab);
        if (!this._currentTab)
            this._currentTab = tab;
    }
    _onPageClosed(tab) {
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
        }).catch(() => { });
    }
    async _ensureBrowserContext() {
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
    async _createBrowserContext() {
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
    async _launchPersistentContext() {
        try {
            const browserType = this.options.browserName ? playwright[this.options.browserName] : playwright.chromium;
            // 컨텍스트 옵션 설정
            const contextOptions = { ...this.options.launchOptions };
            // 비디오 녹화 옵션
            if (this.options.recordVideo) {
                // 비디오 저장 디렉토리 설정
                const videoDir = this.options.videoDir || path_1.default.join(process.cwd(), 'mcp_videos');
                // 비디오 디렉토리가 없으면 생성
                if (!fs_1.default.existsSync(videoDir)) {
                    fs_1.default.mkdirSync(videoDir, { recursive: true });
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
                    dir: this.options.traceDir || path_1.default.join(process.cwd(), 'mcp_traces')
                };
                // 트레이스 디렉토리가 없으면 생성
                if (!fs_1.default.existsSync(contextOptions.tracing.dir)) {
                    fs_1.default.mkdirSync(contextOptions.tracing.dir, { recursive: true });
                }
            }
            return await browserType.launchPersistentContext(this.options.userDataDir, contextOptions);
        }
        catch (error) {
            if (error.message.includes('Executable doesn\'t exist'))
                throw new Error(`Browser specified in your config is not installed. Either install it (likely) or change the config.`);
            throw error;
        }
    }
}
exports.Context = Context;
class Tab {
    context;
    page;
    _console = [];
    _requests = new Map();
    _snapshot;
    _onPageClose;
    _videoPath;
    constructor(context, page, onPageClose) {
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
    _clearCollectedArtifacts() {
        this._console.length = 0;
        this._requests.clear();
    }
    _onClose() {
        this._clearCollectedArtifacts();
        this._onPageClose(this);
    }
    async navigate(url) {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        // Cap load event to 5 seconds, the page is operational at this point.
        await this.page.waitForLoadState('load', { timeout: 5000 }).catch(() => { });
    }
    hasSnapshot() {
        return !!this._snapshot;
    }
    snapshotOrDie() {
        if (!this._snapshot)
            throw new Error('No snapshot available');
        return this._snapshot;
    }
    console() {
        return this._console;
    }
    requests() {
        return this._requests;
    }
    async captureSnapshot() {
        this._snapshot = await PageSnapshot.create(this.page);
    }
    async getVideoPath() {
        try {
            // 비디오 메서드가 존재하는지 확인
            const video = this.page.video();
            if (video) {
                this._videoPath = await video.path();
                return this._videoPath;
            }
            return undefined;
        }
        catch (error) {
            console.error('비디오 경로를 가져오는 중 오류 발생:', error);
            return undefined;
        }
    }
    async saveVideo(filePath) {
        try {
            const video = this.page.video();
            if (video) {
                await video.saveAs(filePath);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('비디오 저장 중 오류 발생:', error);
            return false;
        }
    }
    async startTracing(options) {
        try {
            // 브라우저 컨텍스트에서 tracing API 사용
            const context = this.page.context();
            await context.tracing.start({
                screenshots: options?.screenshots ?? true,
                snapshots: options?.snapshots ?? true,
            });
            return true;
        }
        catch (error) {
            console.error('트레이스 기록 시작 중 오류 발생:', error);
            return false;
        }
    }
    async stopTracing(path) {
        try {
            const context = this.page.context();
            await context.tracing.stop({ path });
            return true;
        }
        catch (error) {
            console.error('트레이스 기록 중지 중 오류 발생:', error);
            return false;
        }
    }
}
exports.Tab = Tab;
class PageSnapshot {
    _frameLocators = [];
    _text;
    constructor() {
    }
    static async create(page) {
        const snapshot = new PageSnapshot();
        await snapshot._build(page);
        return snapshot;
    }
    text() {
        return this._text;
    }
    async _build(page) {
        const yamlDocument = await this._snapshotFrame(page);
        this._text = [
            `- Page Snapshot`,
            '```yaml',
            yamlDocument.toString({ indentSeq: false }).trim(),
            '```',
        ].join('\n');
    }
    async _snapshotFrame(frame) {
        const frameIndex = this._frameLocators.push(frame) - 1;
        const snapshotString = await frame.locator('body').ariaSnapshot({ ref: true, emitGeneric: true });
        const snapshot = yaml_1.default.parseDocument(snapshotString);
        const visit = async (node) => {
            if (yaml_1.default.isPair(node)) {
                await Promise.all([
                    visit(node.key).then(k => node.key = k),
                    visit(node.value).then(v => node.value = v)
                ]);
            }
            else if (yaml_1.default.isSeq(node) || yaml_1.default.isMap(node)) {
                node.items = await Promise.all(node.items.map(visit));
            }
            else if (yaml_1.default.isScalar(node)) {
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
                            }
                            catch (error) {
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
    refLocator(ref) {
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
async function generateLocator(locator) {
    return locator._generateLocatorString();
}
