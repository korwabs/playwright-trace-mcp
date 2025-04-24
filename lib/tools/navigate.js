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
const navigate = captureSnapshot => (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_navigate',
        description: 'Navigate to a URL',
        inputSchema: zod_1.z.object({
            url: zod_1.z.string().describe('The URL to navigate to'),
        }),
    },
    handle: async (context, params) => {
        const tab = await context.ensureTab();
        await tab.navigate(params.url);
        const code = [
            `// Navigate to ${params.url}`,
            `await page.goto('${params.url}');`,
        ];
        return {
            code,
            captureSnapshot,
            waitForNetwork: false,
        };
    },
});
const goBack = captureSnapshot => (0, tool_1.defineTool)({
    capability: 'history',
    schema: {
        name: 'browser_navigate_back',
        description: 'Go back to the previous page',
        inputSchema: zod_1.z.object({}),
    },
    handle: async (context) => {
        const tab = await context.ensureTab();
        await tab.page.goBack();
        const code = [
            `// Navigate back`,
            `await page.goBack();`,
        ];
        return {
            code,
            captureSnapshot,
            waitForNetwork: false,
        };
    },
});
const goForward = captureSnapshot => (0, tool_1.defineTool)({
    capability: 'history',
    schema: {
        name: 'browser_navigate_forward',
        description: 'Go forward to the next page',
        inputSchema: zod_1.z.object({}),
    },
    handle: async (context) => {
        const tab = context.currentTabOrDie();
        await tab.page.goForward();
        const code = [
            `// Navigate forward`,
            `await page.goForward();`,
        ];
        return {
            code,
            captureSnapshot,
            waitForNetwork: false,
        };
    },
});
exports.default = (captureSnapshot) => [
    navigate(captureSnapshot),
    goBack(captureSnapshot),
    goForward(captureSnapshot),
];
