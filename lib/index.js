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
exports.createServer = createServer;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const server_1 = require("./server");
const common_1 = __importDefault(require("./tools/common"));
const console_1 = __importDefault(require("./tools/console"));
const dialogs_1 = __importDefault(require("./tools/dialogs"));
const files_1 = __importDefault(require("./tools/files"));
const install_1 = __importDefault(require("./tools/install"));
const keyboard_1 = __importDefault(require("./tools/keyboard"));
const navigate_1 = __importDefault(require("./tools/navigate"));
const network_1 = __importDefault(require("./tools/network"));
const pdf_1 = __importDefault(require("./tools/pdf"));
const snapshot_1 = __importDefault(require("./tools/snapshot"));
const tabs_1 = __importDefault(require("./tools/tabs"));
const screen_1 = __importDefault(require("./tools/screen"));
const video_1 = __importDefault(require("./tools/video"));
const trace_1 = __importDefault(require("./tools/trace"));
const scroll_1 = __importDefault(require("./tools/scroll"));

const snapshotTools = [
    ...(0, common_1.default)(true),
    ...console_1.default,
    ...(0, dialogs_1.default)(true),
    ...(0, files_1.default)(true),
    ...install_1.default,
    ...(0, keyboard_1.default)(true),
    ...(0, navigate_1.default)(true),
    ...network_1.default,
    ...pdf_1.default,
    ...snapshot_1.default,
    ...(0, tabs_1.default)(true),
    ...video_1.default,
    ...trace_1.default,
    ...scroll_1.default,
];
const screenshotTools = [
    ...(0, common_1.default)(false),
    ...console_1.default,
    ...(0, dialogs_1.default)(false),
    ...(0, files_1.default)(false),
    ...install_1.default,
    ...(0, keyboard_1.default)(false),
    ...(0, navigate_1.default)(false),
    ...network_1.default,
    ...pdf_1.default,
    ...screen_1.default,
    ...(0, tabs_1.default)(false),
    ...video_1.default,
    ...trace_1.default,
    ...scroll_1.default,
];
const packageJSON = require('../package.json');
async function createServer(options) {
    let browserName;
    let channel;
    switch (options?.browser) {
        case 'chrome':
        case 'chrome-beta':
        case 'chrome-canary':
        case 'chrome-dev':
        case 'msedge':
        case 'msedge-beta':
        case 'msedge-canary':
        case 'msedge-dev':
            browserName = 'chromium';
            channel = options.browser;
            break;
        case 'chromium':
            browserName = 'chromium';
            break;
        case 'firefox':
            browserName = 'firefox';
            break;
        case 'webkit':
            browserName = 'webkit';
            break;
        default:
            browserName = 'chromium';
            channel = 'chrome';
    }
    const userDataDir = options?.userDataDir ?? await createUserDataDir(browserName);
    const launchOptions = {
        headless: !!(options?.headless ?? (os_1.default.platform() === 'linux' && !process.env.DISPLAY)),
        channel,
        executablePath: options?.executablePath,
    };
    const allTools = options?.vision ? screenshotTools : snapshotTools;
    const tools = allTools.filter(tool => !options?.capabilities || tool.capability === 'core' || options.capabilities.includes(tool.capability));
    return (0, server_1.createServerWithTools)({
        name: 'Playwright',
        version: packageJSON.version,
        tools,
        resources: [],
        browserName,
        userDataDir,
        launchOptions,
        cdpEndpoint: options?.cdpEndpoint,
        recordVideo: options?.recordVideo,
        videoDir: options?.videoDir,
        traceEnabled: options?.traceEnabled,
        traceDir: options?.traceDir,
        traceScreenshots: options?.traceScreenshots,
        traceSnapshots: options?.traceSnapshots,
    });
}
async function createUserDataDir(browserName) {
    let cacheDirectory;
    if (process.platform === 'linux')
        cacheDirectory = process.env.XDG_CACHE_HOME || path_1.default.join(os_1.default.homedir(), '.cache');
    else if (process.platform === 'darwin')
        cacheDirectory = path_1.default.join(os_1.default.homedir(), 'Library', 'Caches');
    else if (process.platform === 'win32')
        cacheDirectory = process.env.LOCALAPPDATA || path_1.default.join(os_1.default.homedir(), 'AppData', 'Local');
    else
        throw new Error('Unsupported platform: ' + process.platform);
    const result = path_1.default.join(cacheDirectory, 'ms-playwright', `mcp-${browserName}-profile`);
    await fs_1.default.promises.mkdir(result, { recursive: true });
    return result;
}
