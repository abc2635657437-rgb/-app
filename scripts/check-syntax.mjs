// Syntax-check every script the site ships.
//
//   node scripts/check-syntax.mjs
//
// A missing comma in sw.js shipped once: the file returned 200, every URL it
// listed was reachable, and the worker still failed to evaluate — so nothing
// installed and no cache was ever filled. Checking the artifact (not its inputs)
// is the only thing that catches that.

import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const PAGES = ['explore3d.html', 'explore3d-explore.html', 'index.html'];

const targets = new Set(['sw.js']);

for (const page of PAGES) {
  if (!existsSync(page)) continue;
  const html = readFileSync(page, 'utf8');
  for (const match of html.matchAll(/<script src="([^"]+)"/g)) {
    targets.add(match[1].split('?')[0].replace(/^\//, ''));
  }
}

// modules reached by import, plus the panel's own scripts
const roots = [...targets];
for (const file of roots) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/(?:from|import\s*\()\s*['"](\.\.?\/[^'"]+)['"]/g)) {
    const resolved = path.normalize(path.join(path.dirname(file), match[1]));
    if (existsSync(resolved)) targets.add(resolved);
  }
}

const tmpRoot = path.join(os.tmpdir(), 'tw-syntax-' + Date.now());
mkdirSync(tmpRoot, { recursive: true });
const failures = [];

for (const file of [...targets].sort()) {
  if (!existsSync(file)) {
    failures.push({ file, error: 'missing' });
    continue;
  }
  if (!/\.(?:js|mjs)$/.test(file)) continue;
  // node parses .mjs as a module, which is what the browser sees for type=module
  const tmp = path.join(tmpRoot, file.replace(/[\\/]/g, '_') + '.mjs');
  try {
    writeFileSync(tmp, readFileSync(file));
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  } catch (error) {
    const message = String(error.stderr || error.message).split('\n').slice(0, 3).join(' ').trim();
    failures.push({ file, error: message });
  }
}

rmSync(tmpRoot, { recursive: true, force: true });

console.log(`checked ${targets.size} script(s)`);
for (const failure of failures) console.log(`FAIL ${failure.file}: ${failure.error}`);
if (!failures.length) console.log('all parsable');
process.exitCode = failures.length ? 1 : 0;
