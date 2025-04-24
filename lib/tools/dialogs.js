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
const handleDialog = captureSnapshot => (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_handle_dialog',
        description: 'Handle a dialog',
        inputSchema: zod_1.z.object({
            accept: zod_1.z.boolean().describe('Whether to accept the dialog.'),
            promptText: zod_1.z.string().optional().describe('The text of the prompt in case of a prompt dialog.'),
        }),
    },
    handle: async (context, params) => {
        const dialogState = context.modalStates().find(state => state.type === 'dialog');
        if (!dialogState)
            throw new Error('No dialog visible');
        if (params.accept)
            await dialogState.dialog.accept(params.promptText);
        else
            await dialogState.dialog.dismiss();
        context.clearModalState(dialogState);
        const code = [
            `// <internal code to handle "${dialogState.dialog.type()}" dialog>`,
        ];
        return {
            code,
            captureSnapshot,
            waitForNetwork: false,
        };
    },
    clearsModalState: 'dialog',
});
exports.default = (captureSnapshot) => [
    handleDialog(captureSnapshot),
];
