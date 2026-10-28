import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const webSource = fileURLToPath(new URL('./src/', import.meta.url));
// These are the ONLY browser-specific modules. All features live in frontend/src.
export const browserModules = new Set([
  'App.jsx', 'main.jsx', 'index.css', 'context/AuthContext.jsx',
  'pages/LoginScreen.jsx', 'pages/LandingPage.jsx', 'utils/phone.js', 'utils/session.js',
  'utils/firebaseGoogle.js',
  'utils/telegramLogin.js',
]);
export function sharedSourceGuard() {
  let config;
  return { name: 'wellcircle-shared-feature-source', enforce: 'pre',
  configResolved(value) { config = value; },
  generateBundle() {
    const hash = createHash('sha256');
    const walk = directory => {
      for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name === 'test') continue;
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) walk(path);
        else { hash.update(path.slice(sharedRoot.length)); hash.update(readFileSync(path)); }
      }
    };
    const sharedRoot = fileURLToPath(new URL('../frontend/src/', import.meta.url));
    walk(sharedRoot);
    let revision = 'unknown';
    try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sharedRoot, encoding: 'utf8' }).trim(); } catch { /* source archive */ }
    this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ surface: 'web', sharedSource: 'frontend/src', sharedSourceDigest: hash.digest('hex'), revision, builtAt: new Date().toISOString() }) });
  },
  closeBundle() {
    if (config?.command === 'build') copyFileSync(new URL('./public/.htaccess', import.meta.url), resolve(config.root, config.build.outDir, '.htaccess'));
  },
  load(id) {
    const file = id.split('?')[0];
    if (file.startsWith(webSource) && !browserModules.has(file.slice(webSource.length)) && !file.includes('/test/')) {
      this.error(`Browser build imported a duplicate feature: ${file}. Import @shared/ instead so both apps stay in sync.`);
    }
    return null;
  } };
}
