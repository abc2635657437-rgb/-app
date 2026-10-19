// The explore stylesheet was written for a page of its own. In the app shell it
// shares the document with the site's global styles, which win on specificity
// (they are written as `body .thing`). This scopes every explore rule under
// `#map ` so the two systems stop fighting.
//
//   node scripts/scope-explore-css.mjs

import { readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync('modules/explore3d/explore3d.css', 'utf8');
const lines = source.split('\n');
const out = [];

let inKeyframes = false;
let keyframeDepth = 0;

for (const line of lines) {
  const trimmed = line.trim();

  if (!inKeyframes && /^@(-webkit-)?keyframes/.test(trimmed)) {
    inKeyframes = true;
    keyframeDepth = 0;
    out.push(line);
    // count braces that may open and close on the same line
    keyframeDepth += (line.match(/\{/g) || []).length;
    keyframeDepth -= (line.match(/\}/g) || []).length;
    if (keyframeDepth <= 0) inKeyframes = false;
    continue;
  }

  if (inKeyframes) {
    keyframeDepth += (line.match(/\{/g) || []).length;
    keyframeDepth -= (line.match(/\}/g) || []).length;
    if (keyframeDepth <= 0) inKeyframes = false;
    out.push(line);
    continue;
  }

  // a selector line: indentation, selector text, then `{`
  const match = line.match(/^(\s*)([^@{}][^{}]*?)\s*\{\s*$/);
  if (match && match[2] && !/^(from|to|\d+%)$/.test(match[2].trim())) {
    const selector = match[2]
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        if (part === ':root') return '#map';
        if (part.startsWith('#map') || part.startsWith('body') || part.startsWith('html') || part.startsWith('@')) return part;
        return '#map ' + part;
      })
      .join(', ');
    out.push(match[1] + selector + ' {');
    continue;
  }

  out.push(line);
}

const scoped = out.join('\n');
writeFileSync('modules/explore3d/explore3d.scoped.css', scoped);

const scopedSelectors = (scoped.match(/#map/g) || []).length;
console.log('scoped rules:', scopedSelectors, '| bytes', scoped.length);
