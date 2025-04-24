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
const http_1 = __importDefault(require("http"));
const commander_1 = require("commander");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const index_1 = require("./index");
const server_1 = require("./server");
const assert_1 = __importDefault(require("assert"));
const packageJSON = require('../package.json');
commander_1.program
    .version('Version ' + packageJSON.version)
    .name(packageJSON.name)
    .option('--browser <browser>', 'Browser or chrome channel to use, possible values: chrome, firefox, webkit, msedge.')
    .option('--caps <caps>', 'Comma-separated list of capabilities to enable, possible values: tabs, pdf, history, wait, files, install. Default is all.')
    .option('--cdp-endpoint <endpoint>', 'CDP endpoint to connect to.')
    .option('--executable-path <path>', 'Path to the browser executable.')
    .option('--headless', 'Run browser in headless mode, headed by default')
    .option('--port <port>', 'Port to listen on for SSE transport.')
    .option('--user-data-dir <path>', 'Path to the user data directory')
    .option('--vision', 'Run server that uses screenshots (Aria snapshots are used by default)')
    .option('--record-video', 'Record video of the browser session')
    .option('--video-dir <path>', 'Directory to save videos (default: mcp_videos)')
    // 트레이스 관련 옵션 추가
    .option('--trace', 'Enable tracing for the browser session')
    .option('--trace-dir <path>', 'Directory to save traces (default: mcp_traces)')
    .option('--trace-screenshots', 'Enable capturing screenshots in trace (default: true)')
    .option('--trace-snapshots', 'Enable capturing DOM snapshots in trace (default: true)')
    .action(async (options) => {
    const serverList = new server_1.ServerList(() => (0, index_1.createServer)({
        browser: options.browser,
        userDataDir: options.userDataDir,
        headless: options.headless,
        executablePath: options.executablePath,
        vision: !!options.vision,
        cdpEndpoint: options.cdpEndpoint,
        capabilities: options.caps?.split(',').map((c) => c.trim()),
        recordVideo: !!options.recordVideo,
        videoDir: options.videoDir,
        // 트레이스 관련 옵션 전달
        traceEnabled: !!options.trace,
        traceDir: options.traceDir,
        traceScreenshots: options.traceScreenshots !== false,
        traceSnapshots: options.traceSnapshots !== false,
    }));
    setupExitWatchdog(serverList);
    if (options.port) {
        startSSEServer(+options.port, serverList);
    }
    else {
        const server = await serverList.create();
        await server.connect(new stdio_js_1.StdioServerTransport());
    }
});
function setupExitWatchdog(serverList) {
    const handleExit = async () => {
        setTimeout(() => process.exit(0), 15000);
        await serverList.closeAll();
        process.exit(0);
    };
    process.stdin.on('close', handleExit);
    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);
}
commander_1.program.parse(process.argv);
async function startSSEServer(port, serverList) {
    const sessions = new Map();
    const httpServer = http_1.default.createServer(async (req, res) => {
        if (req.method === 'POST') {
            const searchParams = new URL(`http://localhost${req.url}`).searchParams;
            const sessionId = searchParams.get('sessionId');
            if (!sessionId) {
                res.statusCode = 400;
                res.end('Missing sessionId');
                return;
            }
            const transport = sessions.get(sessionId);
            if (!transport) {
                res.statusCode = 404;
                res.end('Session not found');
                return;
            }
            await transport.handlePostMessage(req, res);
            return;
        }
        else if (req.method === 'GET') {
            const transport = new sse_js_1.SSEServerTransport('/sse', res);
            sessions.set(transport.sessionId, transport);
            const server = await serverList.create();
            res.on('close', () => {
                sessions.delete(transport.sessionId);
                serverList.close(server).catch(e => console.error(e));
            });
            await server.connect(transport);
            return;
        }
        else {
            res.statusCode = 405;
            res.end('Method not allowed');
        }
    });
    httpServer.listen(port, () => {
        const address = httpServer.address();
        (0, assert_1.default)(address, 'Could not bind server socket');
        let url;
        if (typeof address === 'string') {
            url = address;
        }
        else {
            const resolvedPort = address.port;
            let resolvedHost = address.family === 'IPv4' ? address.address : `[${address.address}]`;
            if (resolvedHost === '0.0.0.0' || resolvedHost === '[::]')
                resolvedHost = 'localhost';
            url = `http://${resolvedHost}:${resolvedPort}`;
        }
        console.log(`Listening on ${url}`);
        console.log('Put this in your client config:');
        console.log(JSON.stringify({
            'mcpServers': {
                'playwright': {
                    'url': `${url}/sse`
                }
            }
        }, undefined, 2));
    });
}
