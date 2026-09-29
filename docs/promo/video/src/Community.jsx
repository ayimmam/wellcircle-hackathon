// Community story: find Bertusew on Well Circle → join → RSVP → check in at the run
// → post the run → hype the crew → spend the points. Real footage gets cut in at edit time.
import { AbsoluteFill } from 'remotion';
import { Background, Callouts, Cta, fontFamily, Intro, Phone, tap, timeline } from './kit.jsx';

const WIPE = 72;
const PHONE_IN = 120;
const PHONE_OUT = 830;
export const DURATION = PHONE_OUT + 85;

const HOOK = {
  lead: 'Running alone?',
  lines: [
    { text: 'You skip.', size: 120, at: 6 },
    { text: 'Nobody notices.', size: 110, at: 18 },
    { text: 'You quit.', size: 130, at: 30, accent: true },
  ],
};

// Points shown follow the app's real rules: +10 check-in, +10 post (backend/app/services/points.py).
const SCREENS = timeline([
  { from: PHONE_IN, src: 'c01-search-pre.png', text: 'Find your crew', taps: [tap('c01-search-pre', 16, 'c02-search-result'), tap('c02-search-result', 44)] },
  { from: 180, src: 'c03-provider.png', text: 'Meet them first', zoom: [0.5, 0.12, 1.12] },
  { from: 235, src: 'c04-join-pre.png', text: 'Join the circle', taps: [tap('c04-join-pre', 18, 'c04-join')] },
  { from: 285, src: 'c05-rsvp.png', text: 'Save your spot|Sunday · 6:45 AM', zoom: [0.5, 0.36, 1.1] },
  { from: 340, src: 'c06-checkin-pre.png', text: 'Show up. Check in.', taps: [tap('c06-checkin-pre', 14, 'c06-checkin')], pts: [[16, '+10 pts']] },
  { from: 395, src: 'c06-share-card.png', text: 'Streaks worth sharing' },
  { from: 435, src: 'c07-posts-pre.png', text: 'Post your run', taps: [tap('c07-posts-pre', 10, 'c07-posts'), tap('c08-composer-pre', 28, 'c08-composer'), tap('c08-composer', 58, 'c09-posted')], pts: [[62, '+10 pts']] },
  { from: 535, src: 'c10-react-pre.png', text: 'Hype the crew 🔥', taps: [tap('c10-react-pre', 14, 'c10-react')] },
  { from: 575, src: 'c11-gift-pre.png', text: 'Gift points to a crew-mate', taps: [tap('c11-gift-pre', 10, 'c11-gift'), tap('c11-gift', 32, 'c12-gifted')] },
  { from: 630, src: 'c13-comment-pre.png', text: 'Cheer them on', taps: [tap('c13-comment-pre', 10, 'c13-comment'), tap('c13-comment', 42, 'c14-commented')] },
  { from: 700, src: 'c15-store.png', text: 'Spend your points', taps: [tap('c15-store', 20, 'c16-product')] },
  { from: 745, src: 'c16-product.png', text: 'Post-run massage, on points', taps: [tap('c16-product', 18, 'c17-redeem'), tap('c17-redeem', 40, 'c18-voucher')] },
], PHONE_OUT);

export const Community = () => (
  <AbsoluteFill style={{ fontFamily }}>
    <Background />
    <Intro hook={HOOK} wipe={WIPE} phoneIn={PHONE_IN} />
    <Phone screens={SCREENS} inAt={PHONE_IN} outAt={PHONE_OUT} />
    <Callouts screens={SCREENS} until={PHONE_OUT} />
    <Cta at={PHONE_OUT + 10} title={<>Find your crew.<br />Run together.</>} />
  </AbsoluteFill>
);
