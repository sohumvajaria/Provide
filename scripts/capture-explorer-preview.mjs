/**
 * Capture a static PNG of explorer.html?preview=1 for the home page preview.
 *
 * Requires: local static server on port 8080 (or set PREVIEW_BASE_URL)
 *   python3 -m http.server 8080
 *
 * Usage:
 *   npm run capture-explorer-preview
 */
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outputPath = path.join(rootDir, 'assets', 'explorer-preview.png');
const baseUrl = process.env.PREVIEW_BASE_URL || 'http://127.0.0.1:8080';
const previewUrl = `${baseUrl}/explorer.html?preview=1`;

mkdirSync(path.dirname(outputPath), { recursive: true });

const result = spawnSync(
  'npx',
  [
    '--yes',
    'playwright@1.49.0',
    'screenshot',
    '--browser',
    'chromium',
    '--viewport-size',
    '1280,720',
    '--wait-for-timeout',
    '12000',
    previewUrl,
    outputPath,
  ],
  { cwd: rootDir, stdio: 'inherit', shell: false }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Saved ${outputPath}`);
