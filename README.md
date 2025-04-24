# Playwright Trace MCP

Playwright Trace MCP is a Model Context Protocol (MCP) server that provides browser automation capabilities using [Playwright](https://playwright.dev/). This server adds trace viewer and video recording functionality to record and analyze browser interactions. It enables LLMs (Large Language Models) to interact with web pages through structured accessibility snapshots, without requiring screenshots or visual models.

## Key Features

- **Fast and lightweight**: Uses Playwright's accessibility tree, not pixel-based input.
- **LLM-friendly**: No vision models needed, operates purely on structured data.
- **Deterministic tool application**: Avoids ambiguity common with screenshot-based approaches.
- **Video recording**: Ability to record browser interactions as video.
- **Trace viewer**: Capability to trace and analyze browser interactions.

## Use Cases

- Web navigation and form-filling
- Data extraction from structured content
- LLM-driven automated testing
- General-purpose browser interaction for agents
- Recording and analyzing browser interactions

## Installation

### For Users

#### Installation via NPM

```bash
npm install @playwright/trace-mcp
```

Or

```bash
npx @playwright/trace-mcp
```

### Configuration Example

#### NPX

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/trace-mcp@latest"
      ]
    }
  }
}
```

### Installation in VS Code

You can install the Playwright Record MCP server using VS Code CLI:

```bash
# For VS Code
code --add-mcp '{"name":"playwright","command":"npx","args":["@playwright/trace-mcp@latest"]}'
```

```bash
# For VS Code Insiders
code-insiders --add-mcp '{"name":"playwright","command":"npx","args":["@playwright/trace-mcp@latest"]}'
```

After installation, the Playwright Record MCP server will be available for use with your GitHub Copilot agent in VS Code.

## CLI Options

The Playwright Trace MCP server supports the following command-line options:

- `--browser <browser>`: Browser or Chrome channel to use. Possible values:
  - `chrome`, `firefox`, `webkit`, `msedge`
  - Chrome channels: `chrome-beta`, `chrome-canary`, `chrome-dev`
  - Edge channels: `msedge-beta`, `msedge-canary`, `msedge-dev`
  - Default: `chrome`
- `--caps <caps>`: Comma-separated list of capabilities to enable, possible values: tabs, pdf, history, wait, files, install. Default is all.
- `--cdp-endpoint <endpoint>`: CDP endpoint to connect to
- `--executable-path <path>`: Path to the browser executable
- `--headless`: Run browser in headless mode (headed by default)
- `--port <port>`: Port to listen on for SSE transport
- `--user-data-dir <path>`: Path to the user data directory
- `--vision`: Run server that uses screenshots (Aria snapshots are used by default)
- `--record-video`: Record browser interactions as video
- `--video-dir <path>`: Directory to save videos (default: mcp_videos)
- `--trace`: Enable tracing for the browser session
- `--trace-dir <path>`: Directory to save traces (default: mcp_traces)
- `--trace-screenshots`: Enable capturing screenshots in trace (default: true)
- `--trace-snapshots`: Enable capturing DOM snapshots in trace (default: true)
- `--record-path <path>`: Path to save recording files (default: ./recordings)
- `--record-format <format>`: Recording format, possible values: mp4, webm (default: mp4)

## User Data Directory

Playwright Trace MCP will launch the browser with a new profile, located at:

- Windows: `%USERPROFILE%\AppData\Local\ms-playwright\mcp-chrome-profile`
- macOS: `~/Library/Caches/ms-playwright/mcp-chrome-profile`
- Linux: `~/.cache/ms-playwright/mcp-chrome-profile`

All login information will be stored in that profile; you can delete it between sessions if you'd like to clear the offline state.

## Running Headless Browser (Browser without GUI)

This mode is useful for background or batch operations.

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/trace-mcp@latest",
        "--headless"
      ]
    }
  }
}
```

## Using Video Recording

To use the video recording feature, use the `--record-video` flag:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/trace-mcp@latest",
        "--record-video"
      ]
    }
  }
}
```

To specify the video directory path:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/trace-mcp@latest",
        "--record-video",
        "--video-dir", "./my-videos"
      ]
    }
  }
}
```

## Using Trace Viewer

To enable trace recording functionality, use the `--trace` flag:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/trace-mcp@latest",
        "--trace"
      ]
    }
  }
}
```

To customize trace recording options:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/trace-mcp@latest",
        "--trace",
        "--trace-dir", "./my-traces",
        "--trace-screenshots", 
        "--trace-snapshots"
      ]
    }
  }
}
```

After recording a trace, you can view it using the built-in trace viewer tool or through the Playwright CLI:

```bash
npx playwright show-trace ./my-traces/trace.zip
```

## Running Headed Browser on Linux without DISPLAY

When running a headed browser on a system without a display or from worker processes of IDEs,
run the MCP server from an environment with DISPLAY and pass the `--port` flag to enable SSE transport.

```bash
npx @playwright/trace-mcp@latest --port 8931
```

Then, in the MCP client config, set the `url` to the SSE endpoint:

```json
{
  "mcpServers": {
    "playwright": {
      "url": "http://localhost:8931/sse"
    }
  }
}
```

## Docker

**NOTE:** The Docker implementation currently only supports headless Chromium.

```json
{
  "mcpServers": {
    "playwright": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "mcp/playwright-trace"]
    }
  }
}
```

To build with Docker:

```bash
docker build -t mcp/playwright-trace .
```

## Tool Modes

The tools are available in two modes:

1. **Snapshot Mode** (default): Uses accessibility snapshots for better performance and reliability
2. **Vision Mode**: Uses screenshots for visual-based interactions

To use Vision Mode, add the `--vision` flag when starting the server:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/record-mcp@latest",
        "--vision"
      ]
    }
  }
}
```

Vision Mode works best with computer use models that are able to interact with elements using X-Y coordinate space, based on the provided screenshot.

## Programmatic Usage with Custom Transports

```javascript
import http from 'http';

import { createServer } from '@playwright/trace-mcp';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

http.createServer(async (req, res) => {
  // ...

  // Creates a headless Playwright Record MCP server with SSE transport
  const mcpServer = await createServer({ headless: true, record: true });
  const transport = new SSEServerTransport('/messages', res);
  await mcpServer.connect(transport);

  // ...
});
```

## Snapshot-based Interactions

- **browser_snapshot**
  - Description: Capture accessibility snapshot of the current page, this is better than screenshot
  - Parameters: None

- **browser_click**
  - Description: Perform click on a web page
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot

- **browser_drag**
  - Description: Perform drag and drop between two elements
  - Parameters:
    - `startElement` (string): Human-readable source element description used to obtain the permission to interact with the element
    - `startRef` (string): Exact source element reference from the page snapshot
    - `endElement` (string): Human-readable target element description used to obtain the permission to interact with the element
    - `endRef` (string): Exact target element reference from the page snapshot

- **browser_hover**
  - Description: Hover over element on page
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot

- **browser_type**
  - Description: Type text into editable element
  - Parameters:
    - `element` (string): Human-readable element description used to obtain permission to interact with the element
    - `ref` (string): Exact target element reference from the page snapshot
    - `text` (string): Text to type into the element
    - `submit` (boolean, optional): Whether to submit entered text (press Enter after)
    - `slowly` (boolean, optional): Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.

## Video Recording Tools

- **browser_video_enable**
  - Description: Enable video recording for the browser session
  - Parameters:
    - `directory` (string, optional): Directory to save the video files (default: mcp_videos)

- **browser_video_get_path**
  - Description: Get the path of the current video recording
  - Parameters: None

- **browser_video_save**
  - Description: Save the current video recording to a file
  - Parameters:
    - `filename` (string): Name of the file to save the video to

## Trace Viewer Tools

- **browser_trace_start**
  - Description: Start recording a trace of browser interactions
  - Parameters:
    - `directory` (string, optional): Directory to save trace files (default: mcp_traces)
    - `name` (string, optional): Name of the trace file (default: trace)
    - `screenshots` (boolean, optional): Whether to capture screenshots (default: true)
    - `snapshots` (boolean, optional): Whether to capture DOM snapshots (default: true)

- **browser_trace_stop**
  - Description: Stop recording trace and save it to a file
  - Parameters:
    - `path` (string, optional): Path to save the trace file (default: directory/name.zip from trace_start)

- **browser_trace_view**
  - Description: Open a trace file in Playwright Trace Viewer
  - Parameters:
    - `path` (string): Path to the trace file to open
    - `port` (number, optional): Port to run the Trace Viewer on (default: 9322)
    
## Scroll Tools

- **browser_scroll**
  - Description: Scroll the page by a specified amount
  - Parameters:
    - `x` (number, optional): Horizontal scroll amount in pixels (default: 0)
    - `y` (number): Vertical scroll amount in pixels
    - `behavior` (string, optional): Scroll behavior ('auto' or 'smooth', default: 'auto')

- **browser_scroll_to_element**
  - Description: Scroll to bring a specific element into view
  - Parameters:
    - `element` (string): Human-readable description of the target element
    - `ref` (string): Element reference from page snapshot
    - `behavior` (string, optional): Scroll behavior ('auto' or 'smooth', default: 'auto')
    - `block` (string, optional): Vertical alignment ('start', 'center', 'end', 'nearest', default: 'center')
    - `inline` (string, optional): Horizontal alignment ('start', 'center', 'end', 'nearest', default: 'nearest')

- **browser_scroll_to_position**
  - Description: Scroll to an absolute position on the page
  - Parameters:
    - `x` (number): Horizontal position in pixels
    - `y` (number): Vertical position in pixels
    - `behavior` (string, optional): Scroll behavior ('auto' or 'smooth', default: 'auto')

- **browser_auto_scroll**
  - Description: Automatically scroll to the bottom of the page, ensuring all content is loaded
  - Parameters:
    - `distance` (number, optional): Distance to scroll in each step in pixels (default: 100)
    - `delay` (number, optional): Delay between scroll steps in milliseconds (default: 100)

### Scrolling Examples

```javascript
// 기본 스크롤 - 페이지 아래로 500픽셀 스크롤
await mcpServer.invoke('browser_scroll', {
  y: 500
});

// 부드러운 스크롤 효과 사용
await mcpServer.invoke('browser_scroll', {
  y: 500,
  behavior: 'smooth'
});

// 특정 요소로 스크롤 (먼저 스냅샷 캡처 필요)
await mcpServer.invoke('browser_snapshot');
await mcpServer.invoke('browser_scroll_to_element', {
  element: '상품 설명 섹션',
  ref: 'element-ref-123'
});

// 특정 위치로 스크롤
await mcpServer.invoke('browser_scroll_to_position', {
  x: 0,
  y: 1500
});

// 페이지 전체 자동 스크롤 (긴 페이지의 모든 콘텐츠 로드)
await mcpServer.invoke('browser_auto_scroll', {
  distance: 200,  // 각 스크롤 단계의 거리
  delay: 100      // 각 스크롤 사이의 지연 시간(ms)
});
```

### Video Recording and Tracing

```javascript
// Start video recording
await mcpServer.invoke('browser_video_enable', {
  directory: './mcp_videos'
});

// Start tracing
await mcpServer.invoke('browser_trace_start', {
  directory: './mcp_traces',
  name: 'my-trace',
  screenshots: true,
  snapshots: true
});

// Perform browser navigation
await mcpServer.invoke('browser_navigate', {
  url: 'https://example.com'
});

// Interact with the page
const snapshot = await mcpServer.invoke('browser_snapshot');
// Find elements in the snapshot...

// Stop tracing and save
await mcpServer.invoke('browser_trace_stop', {
  path: './mcp_traces/my-trace.zip'
});

// Get video path and save
const videoPath = await mcpServer.invoke('browser_video_get_path');
await mcpServer.invoke('browser_video_save', {
  filename: 'my-recording.mp4'
});

// View trace in Playwright Trace Viewer
await mcpServer.invoke('browser_trace_view', {
  path: './mcp_traces/my-trace.zip',
  port: 9322
});
```

## Supported Browsers

- Chrome
- Firefox
- WebKit
- Microsoft Edge

## Requirements

- Node.js 18 or higher
- The required browser must be installed (or use the `browser_install` tool to install it)

## Development Setup

### Environment Setup

To set up a development environment for Playwright Trace MCP, follow these steps:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/korwabs/playwright-trace-mcp.git
   cd playwright-trace-mcp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Building the project**:

   The project uses TypeScript and needs to be compiled. The build process is configured to use the locally installed TypeScript compiler. To build the project:
   ```bash
   npm run build
   ```

   **Troubleshooting Build Issues**:
   
   If you encounter issues with the TypeScript compiler not being found, you may need to ensure the local TypeScript package is properly installed:
   ```bash
   # Remove node_modules (optional, if you suspect corrupted packages)
   rm -rf node_modules
   
   # Reinstall dependencies
   npm install
   ```

   If you still face issues with the build command, you can directly use the TypeScript compiler from node_modules:
   ```bash
   # Using the local TypeScript compiler directly
   node ./node_modules/typescript/bin/tsc
   ```

4. **Running tests**:
   ```bash
   npm test
   ```

5. **Watching for changes during development**:
   ```bash
   npm run watch
   ```

### Project Structure

- `src/`: TypeScript source code
  - `tools/`: MCP tools implementation
    - `trace.ts`: Trace viewer functionality
    - `video.ts`: Video recording functionality
  - `utils/`: Utility functions
    - `trace-viewer.ts`: Helper functions for trace viewer
  - `context.ts`: Context implementation
  - `index.ts`: Main entry point
- `lib/`: Compiled JavaScript code (generated)
- `tests/`: Test files

### Common Development Tasks

1. **Adding a new tool**:
   - Create a new file in `src/tools/`
   - Export tool implementations using the `defineTool` factory
   - Import and add the tool to the tool arrays in `src/index.ts`

2. **Testing locally**:
   ```bash
   # Build the project
   npm run build
   
   # Link the package locally
   npm link
   
   # Use the linked package
   npx @playwright/trace-mcp
   ```

3. **Publishing a new version**:
   ```bash
   # Clean, build, test, and publish
   npm run npm-publish
   ```

## License

Apache-2.0 license
