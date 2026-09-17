import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Guards against the diagnostic network-noise strings creeping back into
// user-facing copy (WS10 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md).
// Walks the real source tree rather than importing modules, so it also
// catches the phrase turning up in a new file this test doesn't know about.
const BANNED_PHRASES = [
  'taking longer than usual',
  "couldn't connect right now",
];

const SRC_DIR = join(__dirname, '..');
const SKIP_DIRS = new Set(['test', 'node_modules']);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(js|jsx)$/.test(entry)) files.push(full);
  }
  return files;
}

describe('no network-noise diagnostic copy', () => {
  it('never reappears in src/', () => {
    const offenders = [];
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const phrase of BANNED_PHRASES) {
        if (content.includes(phrase)) offenders.push(`${file}: "${phrase}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
