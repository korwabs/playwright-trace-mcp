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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const tool_1 = require("./tool");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const videoEnable = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_video_enable',
        description: '브라우저 세션의 비디오 녹화 기능을 활성화합니다',
        inputSchema: zod_1.z.object({
            directory: zod_1.z.string().optional().describe('비디오를 저장할 디렉토리 경로(기본값: mcp_videos)'),
        }),
    },
    handle: async (context, params) => {
        // 비디오 디렉토리 설정
        const videoDir = params.directory || path_1.default.join(process.cwd(), 'mcp_videos');
        // 디렉토리가 없으면 생성
        if (!fs_1.default.existsSync(videoDir)) {
            fs_1.default.mkdirSync(videoDir, { recursive: true });
        }
        // 컨텍스트 옵션 업데이트
        context.options.recordVideo = true;
        context.options.videoDir = videoDir;
        const code = [
            `// 브라우저 세션의 비디오 녹화 활성화`,
            `// 비디오 디렉토리: ${videoDir}`,
            `// 참고: 이 설정은 다음 브라우저 컨텍스트 생성 시 적용됩니다.`,
        ];
        return {
            code,
            captureSnapshot: false,
            waitForNetwork: false,
            resultOverride: {
                content: [{
                        type: "text",
                        text: `비디오 녹화가 활성화되었습니다. 저장 위치: ${videoDir}\n다음 브라우저 시작 시 적용됩니다.`,
                    }],
            },
        };
    },
});
const videoGetPath = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_video_get_path',
        description: '현재 탭의 비디오 경로를 가져옵니다',
        inputSchema: zod_1.z.object({}),
    },
    handle: async (context) => {
        const tab = context.currentTabOrDie();
        const code = [
            `// 현재 탭의 비디오 파일 경로 가져오기`,
            `const videoPath = await page.video().path();`,
        ];
        const action = async () => {
            const videoPath = await tab.getVideoPath();
            return {
                content: [{
                        type: "text",
                        text: videoPath ? `비디오 경로: ${videoPath}` : '비디오가 활성화되지 않았거나 아직 사용할 수 없습니다.',
                    }],
            };
        };
        return {
            code,
            action,
            captureSnapshot: false,
            waitForNetwork: false,
        };
    },
});
const videoSave = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_video_save',
        description: '현재 탭의 비디오를 지정된 경로에 저장합니다',
        inputSchema: zod_1.z.object({
            filename: zod_1.z.string().describe('저장할 파일 이름(확장자 포함)'),
        }),
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        // 비디오 디렉토리 설정
        const videoDir = context.options.videoDir || path_1.default.join(process.cwd(), 'mcp_videos');
        // 디렉토리가 없으면 생성
        if (!fs_1.default.existsSync(videoDir)) {
            fs_1.default.mkdirSync(videoDir, { recursive: true });
        }
        const filePath = path_1.default.join(videoDir, params.filename);
        const code = [
            `// 현재 탭의 비디오 저장`,
            `await page.video().saveAs("${filePath}");`,
        ];
        const action = async () => {
            const success = await tab.saveVideo(filePath);
            return {
                content: [{
                        type: "text",
                        text: success ? `비디오가 성공적으로, ${filePath}에 저장되었습니다.` : '비디오를 저장하는 데 실패했습니다. 비디오 녹화가 활성화되어 있는지 확인하세요.',
                    }],
            };
        };
        return {
            code,
            action,
            captureSnapshot: false,
            waitForNetwork: false,
        };
    },
});
exports.default = [
    videoEnable,
    videoGetPath,
    videoSave,
];
