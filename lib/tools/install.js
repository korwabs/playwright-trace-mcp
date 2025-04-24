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
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const tool_1 = require("./tool");
const install = (0, tool_1.defineTool)({
    capability: 'install',
    schema: {
        name: 'browser_install',
        description: 'Install the browser specified in the config. Call this if you get an error about the browser not being installed.',
        inputSchema: zod_1.z.object({}),
    },
    handle: async (context) => {
        const channel = context.options.launchOptions?.channel ?? context.options.browserName ?? 'chrome';
        const cli = path_1.default.join(require.resolve('playwright/package.json'), '..', 'cli.js');
        const child = (0, child_process_1.fork)(cli, ['install', channel], {
            stdio: 'pipe',
        });
        const output = [];
        child.stdout?.on('data', data => output.push(data.toString()));
        child.stderr?.on('data', data => output.push(data.toString()));
        await new Promise((resolve, reject) => {
            child.on('close', code => {
                if (code === 0)
                    resolve();
                else
                    reject(new Error(`Failed to install browser: ${output.join('')}`));
            });
        });
        return {
            code: [`// Browser ${channel} installed`],
            captureSnapshot: false,
            waitForNetwork: false,
        };
    },
});
exports.default = [
    install,
];
