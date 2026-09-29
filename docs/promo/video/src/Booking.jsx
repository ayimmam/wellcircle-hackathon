// Hook 4 × Module D from ../PROMO_PLAN.md: "12 DMs" → Well Circle → booked in 3 taps.
import { AbsoluteFill } from 'remotion';
import { Background, Callouts, Cta, fontFamily, Intro, Phone, tap, timeline } from './kit.jsx';

const WIPE = 72;       // hook ends, ring wipe starts
const PHONE_IN = 120;  // phone rises
const PHONE_OUT = 545; // phone drops, CTA
export const DURATION = 620;

const HOOK = {
  lead: 'Booking a massage in Addis:',
  lines: [
    { text: '12 DMs', size: 128, at: 6 },
    { text: '1 payment screenshot', size: 84, at: 18 },
    { text: '0 confirmation.', size: 110, at: 30, accent: true },
  ],
};

// tap(recordedOn, frame, swapTo?): position comes from capture.mjs, frame is relative to the
// screen's start, swapTo = the frame showing the result of that tap (so the UI reacts on touch).
const SCREENS = timeline([
  { from: PHONE_IN, src: '02-home.png', text: 'Your wellness tribe, inside Telegram' },
  { from: 180, src: '06-provider-detail.png', text: 'Top studios in Addis', zoom: [0.5, 0.3, 1.08] },
  { from: 235, src: '08-booking-1-service-pre.png', text: 'Tap 1|Pick a service', taps: [tap('08-booking-1-service-pre', 20, '08-booking-1-service'), tap('08-booking-1-service', 44)] },
  { from: 295, src: '09-booking-2-datetime-pre.png', text: 'Tap 2|Pick a time', taps: [tap('09-booking-2-datetime-pre', 12, '09-booking-2-datetime-mid'), tap('09-booking-2-datetime-mid', 30, '09-booking-2-datetime'), tap('09-booking-2-datetime', 48)] },
  { from: 355, src: '10-booking-3-confirm.png', text: 'Tap 3|Send it', taps: [tap('10-booking-3-confirm', 34)] },
  { from: 410, src: '11-booking-sent.png', text: 'Booked. Pay at the studio.', zoom: [0.5, 0.6, 1.16] }, // >1.16 pushes the phone into the callout
  { from: 480, src: '04-explore-events.png', text: 'Events · Circles · Studios', slide: true },
  { from: 502, src: '12-community.png', slide: true },
  { from: 524, src: '05-explore-providers.png', slide: true },
], PHONE_OUT);

export const Booking = () => (
  <AbsoluteFill style={{ fontFamily }}>
    <Background />
    <Intro hook={HOOK} wipe={WIPE} phoneIn={PHONE_IN} />
    <Phone screens={SCREENS} inAt={PHONE_IN} outAt={PHONE_OUT} />
    <Callouts screens={SCREENS} until={PHONE_OUT} />
    <Cta at={PHONE_OUT + 10} title={<>Your next session.<br />Three taps.</>} />
  </AbsoluteFill>
);
