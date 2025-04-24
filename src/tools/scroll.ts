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

import { z } from 'zod';
import { defineTool } from './tool';

const scroll = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_scroll',
    description: '브라우저 페이지에서 스크롤을 수행합니다',
    inputSchema: z.object({
      x: z.number().optional().describe('가로 스크롤 양 (픽셀)'),
      y: z.number().describe('세로 스크롤 양 (픽셀)'),
      behavior: z.enum(['auto', 'smooth']).optional().describe('스크롤 동작 (기본값: auto)'),
    }),
  },

  handle: async (context, params) => {
    const x = params.x || 0;
    const y = params.y;
    const behavior = params.behavior || 'auto';

    const code = [
      `// 페이지 스크롤`,
      `await page.evaluate((x, y, behavior) => {`,
      `  window.scrollBy({`,
      `    left: x,`,
      `    top: y,`,
      `    behavior: behavior`,
      `  });`,
      `}, ${x}, ${y}, '${behavior}');`,
    ];

    return {
      code,
      action: async () => {
        const tab = context.currentTabOrDie();
        try {
          await tab.page.evaluate((x, y, behavior) => {
            window.scrollBy({
              left: x,
              top: y,
              behavior
            });
          }, x, y, behavior);
          
          return {
            content: [{
              type: "text" as "text",
              text: `${y > 0 ? '아래' : '위'}로 ${Math.abs(y)} 픽셀 스크롤했습니다.`,
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: "text" as "text",
              text: `스크롤 중 오류 발생: ${error}`,
            }],
            isError: true,
          };
        }
      },
      captureSnapshot: true,
      waitForNetwork: false,
    };
  },
});

const scrollToElement = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_scroll_to_element',
    description: '지정된 요소로 스크롤하여 화면에 표시합니다',
    inputSchema: z.object({
      element: z.string().describe('스크롤할 요소에 대한 설명'),
      ref: z.string().describe('페이지 스냅샷에서의 정확한 요소 참조'),
      behavior: z.enum(['auto', 'smooth']).optional().describe('스크롤 동작 (기본값: auto)'),
      block: z.enum(['start', 'center', 'end', 'nearest']).optional().describe('세로 정렬 (기본값: center)'),
      inline: z.enum(['start', 'center', 'end', 'nearest']).optional().describe('가로 정렬 (기본값: nearest)'),
    }),
  },

  handle: async (context, params) => {
    const element = params.element;
    const ref = params.ref;
    const behavior = params.behavior || 'auto';
    const block = params.block || 'center';
    const inline = params.inline || 'nearest';

    const code = [
      `// 요소로 스크롤`,
      `const elementHandle = await page.locator('aria-ref=${ref}');`,
      `await elementHandle.scrollIntoViewIfNeeded({`,
      `  behavior: '${behavior}',`,
      `});`,
    ];

    return {
      code,
      action: async () => {
        const tab = context.currentTabOrDie();
        try {
          const locator = tab.snapshotOrDie().refLocator(ref);
          await locator.scrollIntoViewIfNeeded({
            behavior: behavior as 'auto' | 'smooth',
          });
          
          return {
            content: [{
              type: "text" as "text",
              text: `"${element}" 요소로 스크롤했습니다.`,
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: "text" as "text",
              text: `요소로 스크롤 중 오류 발생: ${error}`,
            }],
            isError: true,
          };
        }
      },
      captureSnapshot: true,
      waitForNetwork: false,
    };
  },
});

const scrollToPosition = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_scroll_to_position',
    description: '페이지의 특정 위치로 스크롤합니다',
    inputSchema: z.object({
      x: z.number().describe('가로 스크롤 위치 (픽셀)'),
      y: z.number().describe('세로 스크롤 위치 (픽셀)'),
      behavior: z.enum(['auto', 'smooth']).optional().describe('스크롤 동작 (기본값: auto)'),
    }),
  },

  handle: async (context, params) => {
    const x = params.x;
    const y = params.y;
    const behavior = params.behavior || 'auto';

    const code = [
      `// 특정 위치로 스크롤`,
      `await page.evaluate((x, y, behavior) => {`,
      `  window.scrollTo({`,
      `    left: x,`,
      `    top: y,`,
      `    behavior: behavior`,
      `  });`,
      `}, ${x}, ${y}, '${behavior}');`,
    ];

    return {
      code,
      action: async () => {
        const tab = context.currentTabOrDie();
        try {
          await tab.page.evaluate((x, y, behavior) => {
            window.scrollTo({
              left: x,
              top: y,
              behavior
            });
          }, x, y, behavior);
          
          return {
            content: [{
              type: "text" as "text",
              text: `(${x}, ${y}) 위치로 스크롤했습니다.`,
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: "text" as "text",
              text: `위치로 스크롤 중 오류 발생: ${error}`,
            }],
            isError: true,
          };
        }
      },
      captureSnapshot: true,
      waitForNetwork: false,
    };
  },
});

const autoScroll = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_auto_scroll',
    description: '페이지 끝까지 자동으로 스크롤하여 전체 콘텐츠를 로드합니다',
    inputSchema: z.object({
      distance: z.number().optional().describe('각 스크롤 단계의 거리 (픽셀) (기본값: 100)'),
      delay: z.number().optional().describe('스크롤 단계 사이의 지연 시간 (밀리초) (기본값: 100)'),
    }),
  },

  handle: async (context, params) => {
    const distance = params.distance || 100;
    const delay = params.delay || 100;

    const code = [
      `// 페이지 끝까지 자동 스크롤`,
      `await page.evaluate(async (distance, delay) => {`,
      `  await new Promise((resolve) => {`,
      `    let totalHeight = 0;`,
      `    const timer = setInterval(() => {`,
      `      const scrollHeight = document.body.scrollHeight;`,
      `      window.scrollBy(0, distance);`,
      `      totalHeight += distance;`,
      `      `,
      `      if (totalHeight >= scrollHeight) {`,
      `        clearInterval(timer);`,
      `        resolve();`,
      `      }`,
      `    }, delay);`,
      `  });`,
      `}, ${distance}, ${delay});`,
    ];

    return {
      code,
      action: async () => {
        const tab = context.currentTabOrDie();
        try {
          let scrollCount = 0;
          
          await tab.page.evaluate(async (distance, delay) => {
            return await new Promise<number>((resolve) => {
              let totalHeight = 0;
              let count = 0;
              const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                count++;
                
                if (totalHeight >= scrollHeight) {
                  clearInterval(timer);
                  resolve(count);
                }
              }, delay);
            });
          }, distance, delay).then(count => {
            scrollCount = count;
          });
          
          return {
            content: [{
              type: "text" as "text",
              text: `페이지 끝까지 자동 스크롤을 완료했습니다. ${scrollCount}회 스크롤 수행.`,
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: "text" as "text",
              text: `자동 스크롤 중 오류 발생: ${error}`,
            }],
            isError: true,
          };
        }
      },
      captureSnapshot: true,
      waitForNetwork: true,
    };
  },
});

export default [
  scroll,
  scrollToElement,
  scrollToPosition,
  autoScroll
];
