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
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const tool_1 = require("./tool");
const wait = captureSnapshot => (0, tool_1.defineTool)({
    capability: 'wait',
    schema: {
        name: 'browser_wait',
        description: 'Wait for a specified time in seconds',
        inputSchema: zod_1.z.object({
            time: zod_1.z.number().describe('The time to wait in seconds'),
        }),
    },
    handle: async (context, params) => {
        await new Promise(f => setTimeout(f, Math.min(10000, params.time * 1000)));
        return {
            code: [`// Waited for ${params.time} seconds`],
            captureSnapshot,
            waitForNetwork: false,
        };
    },
});
const close = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_close',
        description: 'Close the page',
        inputSchema: zod_1.z.object({}),
    },
    handle: async (context) => {
        await context.close();
        return {
            code: [`// Internal to close the page`],
            captureSnapshot: false,
            waitForNetwork: false,
        };
    },
});
const resize = captureSnapshot => (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_resize',
        description: 'Resize the browser window',
        inputSchema: zod_1.z.object({
            width: zod_1.z.number().describe('Width of the browser window'),
            height: zod_1.z.number().describe('Height of the browser window'),
        }),
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const code = [
            `// Resize browser window to ${params.width}x${params.height}`,
            `await page.setViewportSize({ width: ${params.width}, height: ${params.height} });`
        ];
        const action = async () => {
            await tab.page.setViewportSize({ width: params.width, height: params.height });
        };
        return {
            code,
            action,
            captureSnapshot,
            waitForNetwork: true
        };
    },
});
exports.default = (captureSnapshot) => [
    close,
    wait(captureSnapshot),
    resize(captureSnapshot)
];
