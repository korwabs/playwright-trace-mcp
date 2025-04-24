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
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const tool_1 = require("./tool");
const javascript = __importStar(require("../javascript"));
const elementSchema = zod_1.z.object({
    element: zod_1.z.string().describe('Human-readable element description used to obtain permission to interact with the element'),
});
const screenshot = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_screen_capture',
        description: 'Take a screenshot of the current page',
        inputSchema: zod_1.z.object({}),
    },
    handle: async (context) => {
        const tab = await context.ensureTab();
        const options = { type: 'jpeg', quality: 50, scale: 'css' };
        const code = [
            `// Take a screenshot of the current page`,
            `await page.screenshot(${javascript.formatObject(options)});`,
        ];
        const action = () => tab.page.screenshot(options).then(buffer => {
            return {
                content: [{ type: 'image', data: buffer.toString('base64'), mimeType: 'image/jpeg' }],
            };
        });
        return {
            code,
            action,
            captureSnapshot: false,
            waitForNetwork: false
        };
    },
});
const moveMouse = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_screen_move_mouse',
        description: 'Move mouse to a given position',
        inputSchema: elementSchema.extend({
            x: zod_1.z.number().describe('X coordinate'),
            y: zod_1.z.number().describe('Y coordinate'),
        }),
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const code = [
            `// Move mouse to (${params.x}, ${params.y})`,
            `await page.mouse.move(${params.x}, ${params.y});`,
        ];
        const action = () => tab.page.mouse.move(params.x, params.y);
        return {
            code,
            action,
            captureSnapshot: false,
            waitForNetwork: false
        };
    },
});
const click = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_screen_click',
        description: 'Click left mouse button',
        inputSchema: elementSchema.extend({
            x: zod_1.z.number().describe('X coordinate'),
            y: zod_1.z.number().describe('Y coordinate'),
        }),
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const code = [
            `// Click mouse at coordinates (${params.x}, ${params.y})`,
            `await page.mouse.move(${params.x}, ${params.y});`,
            `await page.mouse.down();`,
            `await page.mouse.up();`,
        ];
        const action = async () => {
            await tab.page.mouse.move(params.x, params.y);
            await tab.page.mouse.down();
            await tab.page.mouse.up();
        };
        return {
            code,
            action,
            captureSnapshot: false,
            waitForNetwork: true,
        };
    },
});
const drag = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_screen_drag',
        description: 'Drag left mouse button',
        inputSchema: elementSchema.extend({
            startX: zod_1.z.number().describe('Start X coordinate'),
            startY: zod_1.z.number().describe('Start Y coordinate'),
            endX: zod_1.z.number().describe('End X coordinate'),
            endY: zod_1.z.number().describe('End Y coordinate'),
        }),
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const code = [
            `// Drag mouse from (${params.startX}, ${params.startY}) to (${params.endX}, ${params.endY})`,
            `await page.mouse.move(${params.startX}, ${params.startY});`,
            `await page.mouse.down();`,
            `await page.mouse.move(${params.endX}, ${params.endY});`,
            `await page.mouse.up();`,
        ];
        const action = async () => {
            await tab.page.mouse.move(params.startX, params.startY);
            await tab.page.mouse.down();
            await tab.page.mouse.move(params.endX, params.endY);
            await tab.page.mouse.up();
        };
        return {
            code,
            action,
            captureSnapshot: false,
            waitForNetwork: true,
        };
    },
});
const type = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_screen_type',
        description: 'Type text',
        inputSchema: zod_1.z.object({
            text: zod_1.z.string().describe('Text to type into the element'),
            submit: zod_1.z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
        }),
    },
    handle: async (context, params) => {
        const tab = context.currentTabOrDie();
        const code = [
            `// Type ${params.text}`,
            `await page.keyboard.type('${params.text}');`,
        ];
        const action = async () => {
            await tab.page.keyboard.type(params.text);
            if (params.submit)
                await tab.page.keyboard.press('Enter');
        };
        if (params.submit) {
            code.push(`// Submit text`);
            code.push(`await page.keyboard.press('Enter');`);
        }
        return {
            code,
            action,
            captureSnapshot: false,
            waitForNetwork: true,
        };
    },
});
exports.default = [
    screenshot,
    moveMouse,
    click,
    drag,
    type,
];
