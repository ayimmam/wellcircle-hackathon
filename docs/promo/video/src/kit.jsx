// Shared pieces for every promo video: background, hook, ring wipe, logo lock-up,
// the phone with its screen timeline, tap ripples, callouts, points pops and the CTA.
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import logo from '../../../../frontend/src/new_logo.png';
import TAPS from '../../screens-video/taps.json';

export const { fontFamily } = loadFont('normal', { weights: ['600', '800', '900'], subsets: ['latin'] });

export const AMBER = '#F5A623';
export const RUST = '#B5560F';
export const INK = '#14100C';
export const GREEN = '#1E7A3C';
export const ease = Easing.bezier(0.65, 0, 0.35, 1);
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

const pop = (frame, fps, at) => spring({ frame: frame - at, fps, config: { damping: 14, stiffness: 180 } });

// Tap recorded by ../capture.mjs: `key` is the frame it was tapped on. → [x, y, at, swapTo?]
export const tap = (key, at, swap) => {
  if (!TAPS[key]) throw new Error(`No tap recorded for ${key} — re-run capture.mjs`);
  return [...TAPS[key], at, swap && `${swap}.png`];
};

// Fill in each screen's end frame from the next screen's start.
export const timeline = (screens, end) => screens.map((s, i) => ({ ...s, to: screens[i + 1]?.from ?? end }));

export const Background = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 28%, #FFF9EF 0%, #FBEBD0 58%, #F4D6A6 100%)' }}>
      <div style={{
        position: 'absolute', width: 900, height: 900, borderRadius: '50%', background: AMBER, opacity: 0.22, filter: 'blur(160px)',
        left: 90 + Math.sin(frame / 55) * 160, top: 700 + Math.cos(frame / 70) * 220,
      }} />
    </AbsoluteFill>
  );
};

// lines: [{ text, size, at, accent? }] — the accent line lands last and shakes.
export const Hook = ({ lead, lines }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: INK, color: '#fff', padding: '0 90px', justifyContent: 'center', gap: 28 }}>
      {/* on screen from frame 0: no fade-in on the hook line */}
      <div style={{ fontSize: 58, fontWeight: 800, opacity: 0.75, marginBottom: 24 }}>{lead}</div>
      {lines.map(({ text, size, at, accent }) => {
        const p = pop(frame, fps, at);
        const shake = accent ? interpolate(frame, [at + 2, at + 6, at + 10, at + 14, at + 18], [0, -10, 10, -6, 0], clamp) : 0;
        return (
          <div key={text} style={{
            fontSize: size, fontWeight: 900, color: accent ? AMBER : '#fff', opacity: p,
            transform: `translate(${shake}px, ${(1 - p) * 40}px) scale(${0.9 + p * 0.1})`,
          }}>{text}</div>
        );
      })}
    </AbsoluteFill>
  );
};

// Double ring wipe: the brand is a circle, so the transition is too.
export const RingWipe = ({ at }) => {
  const frame = useCurrentFrame();
  const ring = (start, color) => {
    const s = interpolate(frame, [start, start + 16], [0, 1], { ...clamp, easing: ease });
    return <div style={{ position: 'absolute', left: 540 - 1150, top: 960 - 1150, width: 2300, height: 2300, borderRadius: '50%', background: color, transform: `scale(${s})` }} />;
  };
  return <AbsoluteFill>{ring(at, AMBER)}{ring(at + 9, '#FFF9EF')}</AbsoluteFill>;
};

export const Lockup = ({ at, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, at);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: p, transform: `scale(${0.8 + p * 0.2})` }}>
      <Img src={logo} style={{ width: 220, height: 220, borderRadius: '50%', boxShadow: '0 30px 60px rgba(120,60,0,.35)' }} />
      <div style={{ fontSize: 76, fontWeight: 900, letterSpacing: 6, color: INK, marginTop: 40 }}>WELL CIRCLE</div>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 8, color: AMBER, marginTop: 6 }}>YOUR WELLNESS TRIBE</div>
      {children}
    </div>
  );
};

// Hook → ring wipe → logo, handing over to the phone at `phoneIn`.
export const Intro = ({ hook, wipe, phoneIn }) => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [phoneIn - 6, phoneIn + 6], [1, 0], clamp);
  return <>
    {frame < wipe + 26 && <Hook {...hook} />}
    {frame >= wipe && frame < wipe + 26 && <RingWipe at={wipe} />}
    {frame >= wipe + 18 && frame < phoneIn + 6 && (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: out }}><Lockup at={wipe + 18} /></AbsoluteFill>
    )}
  </>;
};

const Callout = ({ text, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, at);
  const [tag, rest] = text.includes('|') ? text.split('|') : [null, text]; // 'Tap 1|Pick a service' → pill + headline
  return (
    <div style={{
      position: 'absolute', top: 150, left: 70, right: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
      opacity: p, transform: `translateY(${(1 - p) * 30}px)`,
    }}>
      {tag && <div style={{ background: AMBER, color: INK, fontSize: 40, fontWeight: 900, padding: '10px 30px', borderRadius: 999 }}>{tag}</div>}
      <div style={{ fontSize: 68, fontWeight: 900, color: INK, textAlign: 'center', lineHeight: 1.1 }}>{rest}</div>
    </div>
  );
};

// Callout text follows the screen timeline; a screen without `text` keeps the previous one.
export const Callouts = ({ screens, until }) => {
  const frame = useCurrentFrame();
  const cur = screens.filter((s) => s.text && s.from <= frame).at(-1);
  if (!cur || frame >= until) return null;
  return <Callout key={cur.from} text={cur.text} at={cur.from + 6} />;
};

// iPhone 15, in points (pt) drawn at PT px each. Screens come from `capture.mjs` with FRAME=video:
// the 393×793pt app area under the 59pt status bar, so status bar + app = the real 393×852pt screen.
const SCREEN_W = 570;
const PT = SCREEN_W / 393;
const STATUS_H = 59 * PT;
const SHOT_H = 793 * PT;
const SCREEN_H = STATUS_H + SHOT_H;
const SCREEN_R = 55 * PT;            // display corner radius
const ISLAND = { w: 126 * PT, h: 37 * PT, top: 11 * PT };
const BEZEL = 19;                    // black border around the display, px
const BAND = 11;                     // metal frame, px
const PHONE_W = SCREEN_W + 2 * (BEZEL + BAND);
const PHONE_H = SCREEN_H + 2 * (BEZEL + BAND);
const PHONE_TOP = 440;
const METAL = 'linear-gradient(145deg, #EEEBE6, #C7C1B8 50%, #E7E2DA)';

const Ripple = ({ x, y, local, at }) => {
  // Short tail: a tap usually swaps the screen, and a lingering ripple would sit on the new layout.
  const s = interpolate(local, [at, at + 10], [0.2, 1.5], clamp);
  const o = interpolate(local, [at - 6, at, at + 9], [0, 0.6, 0], clamp);
  const dot = interpolate(local, [at - 8, at - 2, at + 2, at + 5], [0, 1, 1, 0], clamp);
  const pos = { position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, borderRadius: '50%', transform: 'translate(-50%,-50%)' };
  return <>
    <div style={{ ...pos, width: 150, height: 150, background: AMBER, opacity: o, transform: `translate(-50%,-50%) scale(${s})` }} />
    <div style={{ ...pos, width: 64, height: 64, background: 'rgba(255,255,255,.85)', border: '3px solid rgba(0,0,0,.15)', boxShadow: '0 6px 18px rgba(0,0,0,.25)', opacity: dot }} />
  </>;
};

const Screen = ({ s, frame }) => {
  const local = frame - s.from;
  const enter = interpolate(local, [0, s.slide ? 10 : 8], [0, 1], { ...clamp, easing: ease });
  const x = s.slide ? (1 - enter) * 100 : (1 - enter) * 6;
  // A tap with swapTo shows the tap's result from that moment on.
  const src = (s.taps || []).reduce((cur, [, , at, swap]) => (swap && local >= at + 2 ? swap : cur), s.src);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: s.slide ? 1 : enter, transform: `translateX(${x}%)` }}>
      <Img src={staticFile(src)} style={{ width: '100%', display: 'block' }} />
      {(s.taps || []).map(([tx, ty, at]) => <Ripple key={at} x={tx} y={ty} local={local} at={at} />)}
    </div>
  );
};

// "+10 pts" badges that float up beside the phone. pts: [[localFrame, label]]
const PointsPops = ({ s, frame }) => (s.pts || []).map(([at, label]) => {
  const local = frame - s.from - at;
  if (local < 0 || local > 40) return null;
  const y = interpolate(local, [0, 40], [0, -120], { ...clamp, easing: Easing.out(Easing.cubic) });
  const o = interpolate(local, [0, 5, 30, 40], [0, 1, 1, 0], clamp);
  return (
    <div key={at} style={{
      position: 'absolute', right: 60, top: PHONE_TOP + 260 + y, opacity: o, transform: `scale(${interpolate(local, [0, 6], [0.6, 1], clamp)})`,
      background: GREEN, color: '#fff', fontSize: 52, fontWeight: 900, padding: '14px 30px', borderRadius: 999, boxShadow: '0 16px 32px rgba(0,60,20,.35)',
    }}>{label}</div>
  );
});

export const Phone = ({ screens, inAt, outAt }) => {
  const frame = useCurrentFrame();
  if (frame < inAt || frame >= outAt + 20) return null;
  const i = screens.findLastIndex((s) => s.from <= frame);
  const cur = screens[i];
  const local = frame - cur.from;

  const rise = interpolate(frame, [inAt, inAt + 24], [1500, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const drop = interpolate(frame, [outAt, outAt + 18], [0, 1700], { ...clamp, easing: Easing.in(Easing.cubic) });

  // One camera move per screen: push in, hold, ease back out before the cut.
  const [zx, zy, zTo] = cur.zoom || [0.5, 0.5, 1];
  const len = cur.to - cur.from;
  const zoom = interpolate(local, [0, len * 0.45, len - 10, len], [1, zTo, zTo, 1], { ...clamp, easing: ease });
  const press = (cur.taps || []).reduce((m, [, , at]) => m - 0.018 * interpolate(local, [at, at + 3, at + 8], [0, 1, 0], clamp), 1);

  return <>
    <div style={{
      position: 'absolute', left: (1080 - PHONE_W) / 2, top: PHONE_TOP, width: PHONE_W, height: PHONE_H, boxSizing: 'border-box',
      padding: BAND, borderRadius: SCREEN_R + BEZEL + BAND, background: METAL,
      boxShadow: '0 70px 140px rgba(90,45,0,.35), inset 0 0 0 1.5px rgba(255,255,255,.7), inset 0 0 0 3px rgba(0,0,0,.08)',
      transform: `translateY(${rise + drop}px) scale(${zoom * press})`, transformOrigin: `${zx * 100}% ${zy * 100}%`,
    }}>
      <SideButtons />
      <div style={{ padding: BEZEL, borderRadius: SCREEN_R + BEZEL, background: '#0B0B0C' }}>
        <div style={{ width: SCREEN_W, height: SCREEN_H, borderRadius: SCREEN_R, overflow: 'hidden', background: '#fff', position: 'relative' }}>
          <StatusBar />
          <div style={{ position: 'absolute', top: STATUS_H, left: 0, right: 0, height: SHOT_H, overflow: 'hidden' }}>
            {i > 0 && <Screen s={screens[i - 1]} frame={frame} />}
            <Screen s={cur} frame={frame} />
          </div>
        </div>
      </div>
    </div>
    <PointsPops s={cur} frame={frame} />
  </>;
};

// Time left, Dynamic Island centre, signal + battery right, all on the island's centre line.
const StatusBar = () => {
  const cy = ISLAND.top + ISLAND.h / 2;
  const row = { position: 'absolute', top: cy, transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 8 };
  return <>
    <div style={{ ...row, left: 0, width: (SCREEN_W - ISLAND.w) / 2, justifyContent: 'center', fontSize: 17 * PT, fontWeight: 700, color: '#000', letterSpacing: -0.3 }}>9:41</div>
    <div style={{ position: 'absolute', top: ISLAND.top, left: (SCREEN_W - ISLAND.w) / 2, width: ISLAND.w, height: ISLAND.h, borderRadius: 999, background: '#000' }} />
    <div style={{ ...row, right: 0, width: (SCREEN_W - ISLAND.w) / 2, justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 17 }}>
        {[7, 10, 13, 16].map((h) => <div key={h} style={{ width: 4.5, height: h, borderRadius: 1.5, background: '#000' }} />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <div style={{ width: 36, height: 17, borderRadius: 5.5, border: '2px solid rgba(0,0,0,.4)', padding: 2 }}>
          <div style={{ width: '85%', height: '100%', borderRadius: 2.5, background: '#000' }} />
        </div>
        <div style={{ width: 2.5, height: 6, borderRadius: 2, background: 'rgba(0,0,0,.4)' }} />
      </div>
    </div>
  </>;
};

// Action button + volume rocker on the left, side button on the right (iPhone 15 layout).
const SideButtons = () => {
  const btn = (side, top, h) => ({
    position: 'absolute', [side]: -6, top: PHONE_H * top, width: 7, height: PHONE_H * h, borderRadius: 4,
    background: side === 'left' ? 'linear-gradient(90deg, #A9A298, #E2DDD5)' : 'linear-gradient(90deg, #E2DDD5, #A9A298)',
  });
  return <>
    <div style={btn('left', 0.165, 0.035)} />
    <div style={btn('left', 0.235, 0.065)} />
    <div style={btn('left', 0.315, 0.065)} />
    <div style={btn('right', 0.265, 0.1)} />
  </>;
};

export const Cta = ({ at, title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const p = pop(frame, fps, at + 16);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 200 }}>
      <Lockup at={at}>
        <div style={{ opacity: p, transform: `translateY(${(1 - p) * 30}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 60, fontWeight: 900, color: INK, textAlign: 'center', marginTop: 90, lineHeight: 1.15 }}>{title}</div>
          <div style={{ marginTop: 56, background: AMBER, color: INK, fontSize: 46, fontWeight: 900, padding: '26px 64px', borderRadius: 999, boxShadow: `0 20px 40px ${RUST}55` }}>Open in Telegram</div>
          <div style={{ marginTop: 26, fontSize: 48, fontWeight: 800, color: RUST }}>@wellcirclebot</div>
        </div>
      </Lockup>
    </AbsoluteFill>
  );
};
