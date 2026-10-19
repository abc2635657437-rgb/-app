// Structural audit of the shipped pages, plus a comparison against the runtime
// timeline when one has been captured.
//
//   node scripts/audit-runtime.mjs   # first: writes outputs/runtime-assets.json
//   node scripts/audit.mjs
//
// It deliberately does NOT guess reachability from source code: a path built by
// string interpolation looks unreachable to a scanner while being requested on
// every load. "What ships but is never fetched" is answered by the browser.

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const problems = [];
const notes = [];
const fail = (m) => problems.push(m);

const PAGES = ['explore3d.html', 'explore3d-explore.html', 'index.html'];
const RUNTIME_MANIFEST = 'outputs/runtime-assets.json';

// --- 1. pages: duplicate ids and missing local references ------------------
for (const page of PAGES) {
  if (!existsSync(page)) {
    fail(`${page}: missing`);
    continue;
  }
  const html = readFileSync(page, 'utf8');

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const counts = new Map();
  for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  const dupes = [...counts].filter(([, n]) => n > 1).map(([id]) => id);
  if (dupes.length) fail(`${page}: duplicate id(s) ${dupes.join(', ')}`);

  const refs = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
  const missing = [];
  for (const ref of refs) {
    const clean = ref.split('?')[0];
    if (clean.startsWith('//')) continue;
    if (!existsSync(clean.replace(/^\//, ''))) missing.push(clean);
  }
  if (missing.length) fail(`${page}: missing local asset(s): ${missing.slice(0, 5).join(', ')}`);
  notes.push(`${page}: ${ids.length} ids, ${refs.length} local refs, ${missing.length} missing`);
}

// --- 2. links must point at screens that exist ----------------------------
const SCREENS = new Set(['home', 'publish', 'map', 'friends', 'messages', 'profile', 'ai']);
for (const page of PAGES) {
  const html = readFileSync(page, 'utf8');
  for (const match of html.matchAll(/screen=([a-z]+)/g)) {
    if (!SCREENS.has(match[1])) fail(`${page}: link to unknown screen "${match[1]}"`);
  }
}

// --- 3. what ships but the browser never fetched -------------------------
let unreachable = [];
if (!existsSync(RUNTIME_MANIFEST)) {
  notes.push(`skipped "never fetched" check: run scripts/audit-runtime.mjs first`);
} else {
  const requested = new Set(
    JSON.parse(readFileSync(RUNTIME_MANIFEST, 'utf8'))
      .map((url) => {
        try {
          return new URL(url, 'http://local').pathname.replace(/^\//, '');
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  );

  let tracked = [];
  try {
    tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    notes.push('git ls-files unavailable');
  }

  // Only the files this delivery owns are in scope; the rest of the repository
  // (mini-program, admin, existing modules) is predates this work.
  const OURS = [/^assets\/explore3d\//, /^modules\/explore3d\//, /^modules\/vendor\/three\//, /^scripts\//];

  unreachable = tracked.filter((file) => {
    if (!OURS.some((re) => re.test(file))) return false;
    if (file.startsWith('scripts/')) return false;
    if (requested.has(file)) return false;
    // textures are fetched through a runtime-built path
    if (file.startsWith('assets/explore3d/tex/') && requested.has('assets/explore3d/tex/meadow.webp')) return false;
    if (file.startsWith('assets/explore3d/spots/') && requested.has('assets/explore3d/spots/leifeng-pagoda.jpg')) return false;
    return /\.(?:js|mjs|css|html|json|webp|png|jpg|jpeg|svg)$/.test(file);
  });

  notes.push(`runtime timeline covers ${requested.size} same-site paths`);
}

// --- report ---------------------------------------------------------------
console.log('--- notes ---');
for (const note of notes) console.log('  ' + note);

if (unreachable.length) {
  console.log('--- shipped but never fetched ---');
  for (const file of unreachable) console.log('   ' + file);
}

console.log('--- broken references ---');
if (!problems.length) console.log('  none');
for (const problem of problems) console.log('  FAIL ' + problem);

console.log(`\n${problems.length} broken reference(s), ${unreachable.length} never-fetched file(s)`);
process.exitCode = problems.length ? 1 : 0;
