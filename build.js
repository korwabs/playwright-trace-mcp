/**
 * Custom build script for playwright-trace-mcp
 */
const { spawn } = require('child_process');
const path = require('path');

// TypeScript 컴파일러 경로
const tscPath = path.resolve(__dirname, 'node_modules', 'typescript', 'bin', 'tsc');

// TypeScript 컴파일러 실행
console.log('Running TypeScript compiler...');
const tsc = spawn('node', [tscPath], { stdio: 'inherit' });

tsc.on('close', (code) => {
  if (code !== 0) {
    console.error(`TypeScript compilation failed with code ${code}`);
    process.exit(code);
  }
  
  console.log('Build completed successfully.');
});
