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
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const zod_1 = require("zod");
const utils_1 = require("./utils");
const context_1 = require("../context");
const javascript = __importStar(require("../javascript"));
const tool_1 = require("./tool");
const snapshot = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_snapshot',
        description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
        inputSchema: zod_1.z.object({}),
    },
    handle: async (context) => {
        await context.ensureTab();
        return {
            code: [`// <internal code to capture accessibility snapshot>`],
            captureSnapshot: true,
            waitForNetwork: false,
        };
    },
});
const elementSchema = zod_1.z.object({
    element: zod_1.z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
    ref: zod_1.z.string().describe('Exact target element reference from the page snapshot'),
});
const click = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_click',
        description: 'Perform click on a web page',
        inputSchema: elementSchema,
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const locator = tab.snapshotOrDie().refLocator(params.ref);
        const code = [
            `// Click ${params.element}`,
            `await page.${await (0, context_1.generateLocator)(locator)}.click();`
        ];
        return {
            code,
            action: () => locator.click(),
            captureSnapshot: true,
            waitForNetwork: true,
        };
    },
});
const drag = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_drag',
        description: 'Perform drag and drop between two elements',
        inputSchema: zod_1.z.object({
            startElement: zod_1.z.string().describe('Human-readable source element description used to obtain the permission to interact with the element'),
            startRef: zod_1.z.string().describe('Exact source element reference from the page snapshot'),
            endElement: zod_1.z.string().describe('Human-readable target element description used to obtain the permission to interact with the element'),
            endRef: zod_1.z.string().describe('Exact target element reference from the page snapshot'),
        }),
    },
    handle: async (context, params) => {
        const snapshot = context.currentTabOrDie().snapshotOrDie();
        const startLocator = snapshot.refLocator(params.startRef);
        const endLocator = snapshot.refLocator(params.endRef);
        const code = [
            `// Drag ${params.startElement} to ${params.endElement}`,
            `await page.${await (0, context_1.generateLocator)(startLocator)}.dragTo(page.${await (0, context_1.generateLocator)(endLocator)});`
        ];
        return {
            code,
            action: () => startLocator.dragTo(endLocator),
            captureSnapshot: true,
            waitForNetwork: true,
        };
    },
});
const hover = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_hover',
        description: 'Hover over element on page',
        inputSchema: elementSchema,
    },
    handle: async (context, params) => {
        const snapshot = context.currentTabOrDie().snapshotOrDie();
        const locator = snapshot.refLocator(params.ref);
        const code = [
            `// Hover over ${params.element}`,
            `await page.${await (0, context_1.generateLocator)(locator)}.hover();`
        ];
        return {
            code,
            action: () => locator.hover(),
            captureSnapshot: true,
            waitForNetwork: true,
        };
    },
});
const typeSchema = elementSchema.extend({
    text: zod_1.z.string().describe('Text to type into the element'),
    submit: zod_1.z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
    slowly: zod_1.z.boolean().optional().describe('Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.'),
});
const type = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_type',
        description: 'Type text into editable element',
        inputSchema: typeSchema,
    },
    handle: async (context, params) => {
        const snapshot = context.currentTabOrDie().snapshotOrDie();
        const locator = snapshot.refLocator(params.ref);
        const code = [];
        const steps = [];
        if (params.slowly) {
            code.push(`// Press "${params.text}" sequentially into "${params.element}"`);
            code.push(`await page.${await (0, context_1.generateLocator)(locator)}.pressSequentially(${javascript.quote(params.text)});`);
            steps.push(() => locator.pressSequentially(params.text));
        }
        else {
            code.push(`// Fill "${params.text}" into "${params.element}"`);
            code.push(`await page.${await (0, context_1.generateLocator)(locator)}.fill(${javascript.quote(params.text)});`);
            steps.push(() => locator.fill(params.text));
        }
        if (params.submit) {
            code.push(`// Submit text`);
            code.push(`await page.${await (0, context_1.generateLocator)(locator)}.press('Enter');`);
            steps.push(() => locator.press('Enter'));
        }
        return {
            code,
            action: () => steps.reduce((acc, step) => acc.then(step), Promise.resolve()),
            captureSnapshot: true,
            waitForNetwork: true,
        };
    },
});
const selectOptionSchema = elementSchema.extend({
    values: zod_1.z.array(zod_1.z.string()).describe('Array of values to select in the dropdown. This can be a single value or multiple values.'),
});
const selectOption = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_select_option',
        description: 'Select an option in a dropdown',
        inputSchema: selectOptionSchema,
    },
    handle: async (context, params) => {
        const snapshot = context.currentTabOrDie().snapshotOrDie();
        const locator = snapshot.refLocator(params.ref);
        const code = [
            `// Select options [${params.values.join(', ')}] in ${params.element}`,
            `await page.${await (0, context_1.generateLocator)(locator)}.selectOption(${javascript.formatObject(params.values)});`
        ];
        return {
            code,
            action: () => locator.selectOption(params.values).then(() => { }),
            captureSnapshot: true,
            waitForNetwork: true,
        };
    },
});
const screenshotSchema = zod_1.z.object({
    raw: zod_1.z.boolean().optional().describe('Whether to return without compression (in PNG format). Default is false, which returns a JPEG image.'),
    element: zod_1.z.string().optional().describe('Human-readable element description used to obtain permission to screenshot the element. If not provided, the screenshot will be taken of viewport. If element is provided, ref must be provided too.'),
    ref: zod_1.z.string().optional().describe('Exact target element reference from the page snapshot. If not provided, the screenshot will be taken of viewport. If ref is provided, element must be provided too.'),
}).refine(data => {
    return !!data.element === !!data.ref;
}, {
    message: 'Both element and ref must be provided or neither.',
    path: ['ref', 'element']
});
const screenshot = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_take_screenshot',
        description: `Take a screenshot of the current page. You can't perform actions based on the screenshot, use browser_snapshot for actions.`,
        inputSchema: screenshotSchema,
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const snapshot = tab.snapshotOrDie();
        const fileType = params.raw ? 'png' : 'jpeg';
        const fileName = path_1.default.join(os_1.default.tmpdir(), (0, utils_1.sanitizeForFilePath)(`page-${new Date().toISOString()}`)) + `.${fileType}`;
        const options = { type: fileType, quality: fileType === 'png' ? undefined : 50, scale: 'css', path: fileName };
        const isElementScreenshot = params.element && params.ref;
        const code = [
            `// Screenshot ${isElementScreenshot ? params.element : 'viewport'} and save it as ${fileName}`,
        ];
        const locator = params.ref ? snapshot.refLocator(params.ref) : null;
        if (locator)
            code.push(`await page.${await (0, context_1.generateLocator)(locator)}.screenshot(${javascript.formatObject(options)});`);
        else
            code.push(`await page.screenshot(${javascript.formatObject(options)});`);
        const action = async () => {
            const screenshot = locator ? await locator.screenshot(options) : await tab.page.screenshot(options);
            return {
                content: [{
                        type: 'image',
                        data: screenshot.toString('base64'),
                        mimeType: fileType === 'png' ? 'image/png' : 'image/jpeg',
                    }]
            };
        };
        return {
            code,
            action,
            captureSnapshot: true,
            waitForNetwork: false,
        };
    }
});
exports.default = [
    snapshot,
    click,
    drag,
    hover,
    type,
    selectOption,
    screenshot,
];
