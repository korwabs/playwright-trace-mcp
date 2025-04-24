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

import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Playwright Trace Viewer를 실행합니다.
 * @param tracePath 트레이스 파일 경로
 * @param port 포트 번호 (기본값: 9322)
 * @returns 실행 상태 및 메시지
 */
export async function showTraceViewer(tracePath: string, port: number = 9322): Promise<{ success: boolean, message: string }> {
  try {
    const command = `npx playwright show-trace ${tracePath} --port ${port}`;
    const { stdout } = await execPromise(command);
    return {
      success: true,
      message: `Trace Viewer가 포트 ${port}에서 실행 중입니다. 브라우저에서 http://localhost:${port} 를 여세요.\n${stdout}`
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Trace Viewer 실행 중 오류 발생: ${error.message}`
    };
  }
}
