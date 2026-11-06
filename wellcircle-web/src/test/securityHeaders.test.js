import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WEB_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(WEB_ROOT, '..');

function headerValue(headers, key) {
  const match = headers.find(item => item.key === key);
  return match?.value || '';
}

it('website .htaccess enables the Phase F security headers', () => {
  const htaccess = readFileSync(resolve(WEB_ROOT, 'public/.htaccess'), 'utf8');
  for (const header of [
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'X-Frame-Options',
    'Content-Security-Policy',
  ]) {
    expect(htaccess).toContain(`Header always set ${header}`);
  }
  expect(htaccess).toContain("frame-ancestors 'none'");
});

it('Mini App Vercel config keeps auth providers working under CSP', () => {
  const config = JSON.parse(readFileSync(resolve(REPO_ROOT, 'frontend/vercel.json'), 'utf8'));
  const globalHeaders = config.headers.find(item => item.source === '/(.*)').headers;
  const csp = headerValue(globalHeaders, 'Content-Security-Policy');

  expect(headerValue(globalHeaders, 'Strict-Transport-Security')).toContain('max-age=');
  expect(headerValue(globalHeaders, 'X-Content-Type-Options')).toBe('nosniff');
  expect(headerValue(globalHeaders, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');

  for (const source of [
    'https://telegram.org',
    'https://accounts.google.com',
    'https://*.firebaseapp.com',
    'https://*.supabase.co',
    'https://us.i.posthog.com',
  ]) {
    expect(csp).toContain(source);
  }
  expect(csp).toContain('frame-ancestors https://web.telegram.org');
});
