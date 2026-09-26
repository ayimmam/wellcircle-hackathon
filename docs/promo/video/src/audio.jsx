// Narration + music over a finished video. Clips come from ../narration/narrate.py (Kokoro TTS);
// music is the licence-free track at ../screens-video/audio/music.mp3 (Pixabay, same as the AgriData pitch).
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useVideoConfig } from 'remotion';
import BOOKING from '../../screens-video/audio/narration/Booking/manifest.json';
import COMMUNITY from '../../screens-video/audio/narration/Community/manifest.json';

const MANIFESTS = { Booking: BOOKING, Community: COMMUNITY };
export const MUSIC = 'audio/music.mp3';  // null = narration only
const MUSIC_LEVEL = 0.22;   // no one speaking
const DUCKED_LEVEL = 0.06;  // under the voice
const GAP = 6;              // min frames between two lines

// Each line starts at its `at` frame, but never on top of the line before it.
const schedule = (video) => {
  let prevEnd = 0;
  return Object.entries(MANIFESTS[video]).map(([id, m]) => {
    const from = Math.max(m.at, prevEnd + GAP);
    const dur = Math.ceil(m.seconds * 30);
    if (from - m.at > 45) console.warn(`${video} narration "${id}" starts ${((from - m.at) / 30).toFixed(1)}s late: shorten the line before it.`);
    prevEnd = from + dur;
    return { id, from, dur };
  });
};

// Wrap a composition component with its narration (narration/script.json → videos[video]) and the music bed.
export const withAudio = (Base, video, durationInFrames) => {
  const lines = schedule(video);
  const end = lines.length ? lines.at(-1).from + lines.at(-1).dur : 0;
  if (end > durationInFrames) console.warn(`${video} narration runs ${((end - durationInFrames) / 30).toFixed(1)}s past the end: trim the script.`);

  const Narrated = () => {
    const { durationInFrames: total } = useVideoConfig();
    const musicVolume = (frame) => {
      const away = Math.min(Infinity, ...lines.map((l) => (frame < l.from ? l.from - frame : frame > l.from + l.dur ? frame - (l.from + l.dur) : 0)));
      const level = interpolate(away, [0, 12], [DUCKED_LEVEL, MUSIC_LEVEL], { extrapolateRight: 'clamp' });
      const edges = interpolate(frame, [0, 20, total - 45, total], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      return level * edges;
    };
    return (
      <AbsoluteFill>
        <Base />
        {lines.map((l) => (
          <Sequence key={l.id} from={l.from} durationInFrames={l.dur + 2}>
            <Audio src={staticFile(`audio/narration/${video}/${l.id}.wav`)} />
          </Sequence>
        ))}
        {MUSIC && <Audio src={staticFile(MUSIC)} loop volume={musicVolume} />}
      </AbsoluteFill>
    );
  };
  return Narrated;
};
