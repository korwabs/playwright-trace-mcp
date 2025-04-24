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

import { z } from 'zod';
import { defineTool } from './tool';
import path from 'path';
import fs from 'fs';
import { showTraceViewer } from '../utils/trace-viewer';

const traceStart = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_trace_start',
    description: '브라우저 세션의 트레이스 기록을 시작합니다',
    inputSchema: z.object({
      directory: z.string().optional().describe('트레이스를 저장할 디렉토리 경로(기본값: mcp_traces)'),
      name: z.string().optional().describe('트레이스 파일 이름(기본값: trace)'),
      screenshots: z.boolean().optional().describe('스크린샷 기록 여부(기본값: true)'),
      snapshots: z.boolean().optional().describe('DOM 스냅샷 기록 여부(기본값: true)'),
    }),
  },

  handle: async (context, params) => {
    // 트레이스 디렉토리 설정
    const traceDir = params.directory || path.join(process.cwd(), 'mcp_traces');
    const traceName = params.name || 'trace';
    const screenshots = params.screenshots !== undefined ? params.screenshots : true;
    const snapshots = params.snapshots !== undefined ? params.snapshots : true;

    // 디렉토리가 없으면 생성
    if (!fs.existsSync(traceDir)) {
      fs.mkdirSync(traceDir, { recursive: true });
    }

    // 트레이스 옵션 설정
    context.options.traceEnabled = true;
    context.options.traceDir = traceDir;
    context.options.traceName = traceName;
    context.options.traceScreenshots = screenshots;
    context.options.traceSnapshots = snapshots;

    const code = [
      `// 브라우저 세션의 트레이스 기록 시작`,
      `await context.tracing.start({ screenshots: ${screenshots}, snapshots: ${snapshots} });`,
    ];

    return {
      code,
      action: async () => {
        const tab = context.currentTabOrDie();
        try {
          await tab.startTracing({
            screenshots,
            snapshots,
          });
          return {
            content: [{
              type: "text" as "text",
              text: `트레이스 기록이 시작되었습니다. 디렉토리: ${traceDir}, 파일명: ${traceName}`,
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: "text" as "text",
              text: `트레이스 기록 시작 중 오류 발생: ${error}`,
            }],
            isError: true,
          };
        }
      },
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

const traceStop = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_trace_stop',
    description: '브라우저 세션의 트레이스 기록을 중지하고 파일로 저장합니다',
    inputSchema: z.object({
      path: z.string().optional().describe('저장할 트레이스 파일 경로(기본값: 시작 시 지정한 디렉토리와 이름 사용)'),
    }),
  },

  handle: async (context, params) => {
    const traceDir = context.options.traceDir || path.join(process.cwd(), 'mcp_traces');
    const traceName = context.options.traceName || 'trace';
    const tracePath = params.path || path.join(traceDir, `${traceName}.zip`);

    const code = [
      `// 브라우저 세션의 트레이스 기록 중지 및 저장`,
      `await context.tracing.stop({ path: "${tracePath}" });`,
    ];

    return {
      code,
      action: async () => {
        const tab = context.currentTabOrDie();
        try {
          await tab.stopTracing(tracePath);
          return {
            content: [{
              type: "text" as "text",
              text: `트레이스 기록이 중지되었고 파일이 저장되었습니다: ${tracePath}`,
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: "text" as "text",
              text: `트레이스 기록 중지 중 오류 발생: ${error}`,
            }],
            isError: true,
          };
        }
      },
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

const traceView = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_trace_view',
    description: '저장된 트레이스 파일을 Playwright Trace Viewer에서 엽니다',
    inputSchema: z.object({
      path: z.string().describe('열 트레이스 파일 경로'),
      port: z.number().optional().describe('Trace Viewer를 실행할 포트(기본값: 9322)'),
    }),
  },

  handle: async (context, params) => {
    const tracePath = params.path;
    const port = params.port || 9322;

    const code = [
      `// Trace Viewer에서 트레이스 파일 열기`,
      `// npx playwright show-trace ${tracePath} --port ${port}`,
    ];

    return {
      code,
      action: async () => {
        try {
          const result = await showTraceViewer(tracePath, port);
          
          if (result.success) {
            return {
              content: [{
                type: "text" as "text",
                text: result.message,
              }],
            };
          } else {
            return {
              content: [{
                type: "text" as "text",
                text: result.message,
              }],
              isError: true,
            };
          }
        } catch (error) {
          return {
            content: [{
              type: "text" as "text",
              text: `Trace Viewer 실행 중 오류 발생: ${error}`,
            }],
            isError: true,
          };
        }
      },
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

export default [
  traceStart,
  traceStop,
  traceView,
];
