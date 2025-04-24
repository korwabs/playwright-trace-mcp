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
const listTabs = (0, tool_1.defineTool)({
    capability: 'tabs',
    schema: {
        name: 'browser_tab_list',
        description: 'List browser tabs',
        inputSchema: zod_1.z.object({}),
    },
    handle: async (context) => {
        await context.ensureTab();
        return {
            code: [`// <internal code to list tabs>`],
            captureSnapshot: false,
            waitForNetwork: false,
            resultOverride: {
                content: [{
                        type: 'text',
                        text: await context.listTabsMarkdown(),
                    }],
            },
        };
    },
});
const selectTab = captureSnapshot => (0, tool_1.defineTool)({
    capability: 'tabs',
    schema: {
        name: 'browser_tab_select',
        description: 'Select a tab by index',
        inputSchema: zod_1.z.object({
            index: zod_1.z.number().describe('The index of the tab to select'),
        }),
    },
    handle: async (context, params) => {
        await context.selectTab(params.index);
        const code = [
            `// <internal code to select tab ${params.index}>`,
        ];
        return {
            code,
            captureSnapshot,
            waitForNetwork: false
        };
    },
});
const newTab = captureSnapshot => (0, tool_1.defineTool)({
    capability: 'tabs',
    schema: {
        name: 'browser_tab_new',
        description: 'Open a new tab',
        inputSchema: zod_1.z.object({
            url: zod_1.z.string().optional().describe('The URL to navigate to in the new tab. If not provided, the new tab will be blank.'),
        }),
    },
    handle: async (context, params) => {
        await context.newTab();
        if (params.url)
            await context.currentTabOrDie().navigate(params.url);
        const code = [
            `// <internal code to open a new tab>`,
        ];
        return {
            code,
            captureSnapshot,
            waitForNetwork: false
        };
    },
});
const closeTab = captureSnapshot => (0, tool_1.defineTool)({
    capability: 'tabs',
    schema: {
        name: 'browser_tab_close',
        description: 'Close a tab',
        inputSchema: zod_1.z.object({
            index: zod_1.z.number().optional().describe('The index of the tab to close. Closes current tab if not provided.'),
        }),
    },
    handle: async (context, params) => {
        await context.closeTab(params.index);
        const code = [
            `// <internal code to close tab ${params.index}>`,
        ];
        return {
            code,
            captureSnapshot,
            waitForNetwork: false
        };
    },
});
exports.default = (captureSnapshot) => [
    listTabs,
    newTab(captureSnapshot),
    selectTab(captureSnapshot),
    closeTab(captureSnapshot),
];
