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
const requests = (0, tool_1.defineTool)({
    capability: 'core',
    schema: {
        name: 'browser_network_requests',
        description: 'Returns all network requests since loading the page',
        inputSchema: zod_1.z.object({}),
    },
    handle: async (context) => {
        const requests = context.currentTabOrDie().requests();
        const log = [...requests.entries()].map(([request, response]) => renderRequest(request, response)).join('\n');
        return {
            code: [`// <internal code to list network requests>`],
            action: async () => {
                return {
                    content: [{ type: 'text', text: log }]
                };
            },
            captureSnapshot: false,
            waitForNetwork: false,
        };
    },
});
function renderRequest(request, response) {
    const result = [];
    result.push(`[${request.method().toUpperCase()}] ${request.url()}`);
    if (response)
        result.push(`=> [${response.status()}] ${response.statusText()}`);
    return result.join(' ');
}
exports.default = [
    requests,
];
