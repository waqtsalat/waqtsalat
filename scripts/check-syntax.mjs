// Extract inline <script> JS from index.html and check for syntax errors
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const html = readFileSync('index.html', 'utf8');

// Find the main inline script (the large IIFE, last <script>...</script> block)
const scriptRegex = /<script>([^]*?)<\/script>/g;
let match;
let lastScript = null;
let scriptIndex = 0;

while ((match = scriptRegex.exec(html)) !== null) {
  lastScript = { content: match[1], index: scriptIndex++ };
}

if (!lastScript) {
  console.error('No inline <script> found in index.html');
  process.exit(1);
}

const tmpFile = join(tmpdir(), `waqtsalat-check-${Date.now()}.js`);
writeFileSync(tmpFile, lastScript.content);

try {
  execSync(`node --check "${tmpFile}"`, { stdio: 'pipe' });
  console.log('index.html inline JS: syntax OK');
} catch (err) {
  console.error('Syntax error in index.html inline JS:');
  console.error(err.stderr?.toString() || err.message);
  process.exit(1);
} finally {
  try { unlinkSync(tmpFile); } catch {}
}
