import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { browserModules, sharedSourceGuard } from '../shared-source.js';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const shared = JSON.parse(read('../../frontend/package.json'));
const web = JSON.parse(read('../package.json'));
for (const name of Object.keys(shared.dependencies)) {
  assert.equal(web.dependencies[name], shared.dependencies[name], `Keep the ${name} version range identical in both apps.`);
}
assert.match(read('../src/App.jsx'), /AppShell as SharedAppShell.*from '@shared\/App'/);
assert.match(read('../src/main.jsx'), /import '@shared\/i18n'/);
assert.match(read('../src/index.css'), /@import "\.\.\/\.\.\/frontend\/src\/index.css"/);
// Prove stale feature imports are rejected, including files added later.
const plugin = sharedSourceGuard();
assert.throws(() => plugin.load.call({ error: message => { throw new Error(message); } }, new URL('../src/pages/ForYouScreen.jsx', import.meta.url).pathname), /duplicate feature/);
assert(!browserModules.has('pages/ForYouScreen.jsx'));
console.log('Parity verified: shared routes, feature modules, translations, styles and runtime dependencies.');
