// Programmatic UI capture for the promo videos (Layer 1: base UI).
//
//   cd frontend && VITE_USE_MOCK=true npx vite --port 5199      # terminal 1
//   npm i --no-save --prefix docs/promo playwright-core          # once
//   node docs/promo/capture.mjs            # light  → docs/promo/screens/
//   THEME=dark node docs/promo/capture.mjs # dark   → docs/promo/screens-dark/
//   ONLY=booking node docs/promo/capture.mjs  # re-shoot one flow
//   FRAME=video node docs/promo/capture.mjs    # → docs/promo/screens-video/ (for the Remotion videos)
//
// Default: 390x844 @3x = 1170x2532, a full iPhone 13/14 screen, so frames drop into Framey's
// mockups with no rescale. FRAME=video: 393x793 @3x, the app area of an iPhone 15 *below* its
// 59pt status bar, so the videos can draw a real status bar + Dynamic Island above it.
// Uses the installed Chrome.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://localhost:5199';
const THEME = process.env.THEME || 'light';
const VIDEO = process.env.FRAME === 'video';
const VIEWPORT = VIDEO ? { width: 393, height: 793 } : { width: 390, height: 844 };
const OUT = fileURLToPath(new URL(VIDEO ? './screens-video/' : THEME === 'dark' ? './screens-dark/' : './screens/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const P = (n) => `11111111-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const click = (page, text) => page.getByText(text, { exact: false }).first().click();

const settle = (page, ms = 1200) => page.waitForTimeout(ms);
const scrollTo = (page, text) => page.getByText(text, { exact: false }).first().scrollIntoViewIfNeeded();

// Where each tap lands, as viewport fractions keyed by the frame it's shown on → taps.json,
// which the Remotion videos read so ripples always hit the real button.
const TAPS_FILE = OUT + 'taps.json';
const TAPS = existsSync(TAPS_FILE) ? JSON.parse(readFileSync(TAPS_FILE, 'utf8')) : {};
// Snap `pre` with the element in view, tap it, snap `post` (if given).
const step = async (p, snap, el, pre, post, wait = 900) => {
  await el.scrollIntoViewIfNeeded(); await settle(p, 400);
  await snap(pre);
  const b = await el.boundingBox(); const vp = p.viewportSize();
  TAPS[pre] = [+((b.x + b.width / 2) / vp.width).toFixed(3), +((b.y + b.height / 2) / vp.height).toFixed(3)];
  await el.click(); await settle(p, wait);
  if (post) await snap(post);
};

// [name, route, act?, fullPage?]. act(page, snap) can take extra frames mid-flow; name=null skips the end frame.
// Order matters: the first /home visit shows the one-time "Share your progress" sheet.
const SHOTS = [
  ['01-share-card', '/home'],
  ['02-home', '/home'],
  ['03-home-tall', '/home', null, true],
  ['04-explore-events', '/explore'],
  ['05-explore-providers', '/explore', (p) => click(p, 'Providers')],
  ['06-provider-detail', `/provider/${P(1)}`],
  ['07-provider-tall', `/provider/${P(1)}`, null, true],
  // "-pre" / "-mid" frames are the same screen before each tap, so the video can swap state on the tap.
  [null, `/booking/${P(1)}`, async (p, snap) => {
    const next = p.getByRole('button', { name: /Next/ });
    await step(p, snap, p.locator('.service-item').nth(2), '08-booking-1-service-pre', '08-booking-1-service', 500);
    await step(p, snap, next, '08-booking-1-service');
    await step(p, snap, p.locator('.date-chip').nth(1), '09-booking-2-datetime-pre', '09-booking-2-datetime-mid', 500);
    await step(p, snap, p.locator('.time-slot').nth(3), '09-booking-2-datetime-mid', '09-booking-2-datetime', 500);
    await step(p, snap, next, '09-booking-2-datetime');
    await p.locator('input[type=tel], input[inputmode=tel]').first().fill('911234567'); await settle(p, 500);
    await step(p, snap, p.getByRole('button', { name: /Send Booking Request/ }), '10-booking-3-confirm', '11-booking-sent', 2000);
  }],
  ['12-community', '/community'],
  ['13-community-ranks', '/community', (p) => click(p, 'Ranks')],
  ['14-circle-header', '/circle/33333333-0000-0000-0000-000000000002'],
  ['15-circle-feed', '/circle/33333333-0000-0000-0000-000000000002', (p) => p.mouse.wheel(0, 900)],
  ['16-circle-leaderboard', '/circle/33333333-0000-0000-0000-000000000002', async (p) => { await scrollTo(p, 'Leaderboard'); await click(p, 'Leaderboard'); }],
  ['17-profile', '/profile'],
  ['18-products-store', '/products'],
  ['19-product-detail', '/products/prod-01-1'],
  [null, '/onboarding', async (p, snap) => {
    const next = async () => { await p.getByRole('button', { name: /Next|Continue/ }).first().click(); await settle(p); };
    await p.locator('.onboarding-input').fill('Meron'); await snap('20-onboarding-1-name'); await next();
    await p.locator('.onboarding-input').fill('Stay consistent with yoga 3x a week'); await snap('21-onboarding-2-goal'); await next();
    await p.locator('.avatar-picker-item').nth(1).click(); await snap('22-onboarding-3-vibe'); await next();
    for (const i of [0, 2, 3]) await p.locator('.option-grid .option-card').nth(i).click();
    await snap('23-onboarding-4-interests'); await next();
    await snap('24-onboarding-5-frequency'); await next();
    await p.locator('.option-card').first().click().catch(() => {}); await settle(p, 500);
    await snap('25-onboarding-6-circles');
  }],

  // Community story (Community.jsx video): find Bertusew → join → RSVP → check in → post a run
  // → react/comment/gift → spend points. One page session so mock state (joins, posts, balance) carries through.
  [null, '/explore#bertusew', async (p, snap) => {
    const BERTUSEW = `/provider/${P(15)}`;
    // In-app navigation: a reload would reset the mock's in-memory joins/posts/balance.
    const nav = async (path) => {
      await p.evaluate((u) => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')); }, path);
      await p.waitForLoadState('networkidle'); await settle(p, 1500);
    };
    await click(p, 'Providers'); await settle(p, 600);
    const search = p.getByPlaceholder(/Search providers/);
    await step(p, snap, search, 'c01-search-pre');
    await search.pressSequentially('Bertusew', { delay: 60 }); await settle(p, 1200);
    await p.locator('.card').filter({ hasText: 'Bertusew Runningclub' }).first().scrollIntoViewIfNeeded();
    await step(p, snap, p.getByText('Bertusew Runningclub').first(), 'c02-search-result', null, 1800);
    if (!p.url().includes(BERTUSEW)) await nav(BERTUSEW);
    await settle(p, 1200); await snap('c03-provider');
    await step(p, snap, p.getByRole('button', { name: 'Join Circle' }).first(), 'c04-join-pre', 'c04-join');

    await nav('/event/evt-bertusew-sep27/rsvp');
    await snap('c05-rsvp');

    await nav('/community/22222222-0000-0000-0000-000000000015');
    await step(p, snap, p.locator('#checkin-btn'), 'c06-checkin-pre', 'c06-checkin', 700);
    // The check-in can pop the streak share card: keep it as a frame, then dismiss.
    if (await p.locator('#share-card-sheet').isVisible()) {
      await settle(p, 1200); await snap('c06-share-card');
      await p.keyboard.press('Escape'); await settle(p, 800);
    }
    await step(p, snap, p.getByText('Posts & Reactions').first(), 'c07-posts-pre', 'c07-posts');
    await step(p, snap, p.getByText('Share an update, milestone').first(), 'c08-composer-pre');
    await p.locator('#post-composer').pressSequentially('Sunday long run with the Bertusew crew 🏃🏽‍♀️🔥 See you next week!', { delay: 15 });
    await p.getByText('+ Add activity details').click(); await settle(p, 400);
    await p.getByRole('button', { name: 'Run', exact: true }).click();
    await p.getByPlaceholder('Distance (km)').fill('10');
    await p.getByPlaceholder('Duration (min)').fill('58'); await settle(p, 400);
    await step(p, snap, p.locator('.btn-primary', { hasText: /^\s*Post$/ }), 'c08-composer', 'c09-posted', 2500);

    // Engage on a crew-mate's post (the one below ours).
    const other = p.locator('[title="React with fire"]').nth(1);
    await step(p, snap, other, 'c10-react-pre', 'c10-react', 1500);
    await step(p, snap, p.locator('[title="Gift Legacy Points"]').nth(1), 'c11-gift-pre', 'c11-gift', 600);
    await step(p, snap, p.getByRole('button', { name: /^10/ }).first(), 'c11-gift', 'c12-gifted', 1500);
    await step(p, snap, p.getByRole('button', { name: /Comment/ }).nth(1), 'c13-comment-pre');
    await p.getByPlaceholder('Write a comment...').pressSequentially('Great pace today! See you Sunday 🙌🏾', { delay: 15 }); await settle(p, 300);
    await step(p, snap, p.locator('.comment-composer-row .btn-primary'), 'c13-comment', 'c14-commented', 1800);

    await nav('/products');
    await step(p, snap, p.getByText('30-Min Head & Shoulder Massage').first(), 'c15-store', 'c16-product', 1500);
    await step(p, snap, p.getByRole('button', { name: /Redeem/ }).first(), 'c16-product', 'c17-redeem', 1500);
    await step(p, snap, p.getByRole('button', { name: /Confirm|Redeem/ }).last(), 'c17-redeem', 'c18-voucher', 2000);
  }],
];

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.addInitScript((theme) => localStorage.setItem('wellcircle-theme', theme), THEME);

const crewPost = (id, name, seed, hoursAgo, content, km, min, reactions, comments = []) => `{
  id: 'bertusew-${id}', content: ${JSON.stringify(content)},
  user: { id: 'crew-${seed}', name: '${name}', photo_url: 'https://i.pravatar.cc/150?u=${seed}' },
  created_at: new Date(now - ${hoursAgo} * 3600000).toISOString(),
  activity_type: 'run', distance_km: ${km}, duration_min: ${min}, photo_url: null,
  reactions: ${JSON.stringify(reactions)}, total_points_gifted: 15,
  community_id: '22222222-0000-0000-0000-000000000015', circle_id: null,
  comments: ${JSON.stringify(comments.map(([n, s, c], i) => ({ id: `bc-${id}-${i}`, content: c, created_at: new Date().toISOString(), parent_comment_id: null, user: { id: `crew-${s}`, name: n, photo_url: `https://i.pravatar.cc/150?u=${s}` }, replies: [] })))},
},`;
const BERTUSEW_POSTS = [
  crewPost(1, 'Dawit', 'dawit', 2, '6 AM crew is back 💪🏾 12 km around CMC this morning.', 12, 64, { '🔥': 9, '👏': 4 }, [['Hana', 'hana', 'That last hill though 😅']]),
  crewPost(2, 'Hana', 'hana', 5, 'First run with Bertusew and everyone waited for me at the turnaround ❤️', 6, 38, { '🔥': 6, '❤️': 5 }),
  crewPost(3, 'Abel', 'abel', 26, 'Easy recovery 5K, then coffee with the crew ☕', 5, 32, { '🔥': 4 }),
].join('');

// Promo-grade numbers without touching the repo's seed data: rewrite the mock module in flight.
await ctx.route('**/src/data/mock.js*', async (route) => {
  const res = await route.fetch();
  const body = (await res.text())
    .replace('points_balance: 120,', 'points_balance: 1240,')
    .replace('current_streak: 3,', 'current_streak: 21,')
    .replace('longest_streak: 3,', 'longest_streak: 21,')
    .replace("label: 'Longest streak', value: '3 days'", "label: 'Longest streak', value: '21 days'")
    // The Bertusew community has no seed posts; give the crew some runs to react to.
    .replace('export const MOCK_POSTS = [', `export const MOCK_POSTS = [${BERTUSEW_POSTS}`);
  await route.fulfill({ response: res, body });
});

const page = await ctx.newPage();
page.setDefaultTimeout(10000); // clicks fail fast on a stale selector
page.setDefaultNavigationTimeout(45000);
for (const [name, route, act, full] of SHOTS.filter(([, r]) => r.includes(process.env.ONLY || ''))) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // lazy chunks + entrance animations
  const snap = async (n, fullPage = false) => {
    // wait for lazy images so banners aren't blank gradients
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: OUT + n + '.png', fullPage, animations: 'disabled', timeout: 60000 });
    console.log('✓', n);
  };
  if (act) { await act(page, snap); await settle(page); }
  if (name) await snap(name, !!full);
}
writeFileSync(TAPS_FILE, JSON.stringify(TAPS, null, 1));
await browser.close();
