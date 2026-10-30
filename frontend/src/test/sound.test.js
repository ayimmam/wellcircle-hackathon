import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

describe('interface sound playback', () => {
  let sound;
  let context;
  let source;
  let AudioContext;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    source = { connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    context = {
      state: 'running', destination: {},
      createBufferSource: vi.fn(() => source),
      decodeAudioData: vi.fn(async () => ({})), resume: vi.fn(async () => {}),
    };
    AudioContext = vi.fn(function () { return context; });
    vi.stubGlobal('AudioContext', AudioContext);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
    sound = await import('../utils/sound');
  });

  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('does not create audio or fetch on startup or before a gesture', async () => {
    await sound.playSound('tap');
    expect(AudioContext).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('persists mute and stops playback without preventing future unmute', async () => {
    sound.unlockSound();
    await sound.playSound('tap');
    expect(source.start).toHaveBeenCalledOnce();
    sound.setSoundEnabled(false);
    expect(source.stop).toHaveBeenCalledOnce();
    expect(localStorage.getItem('wellcircle-sound')).toBe('off');
    await sound.playSound('success');
    expect(source.start).toHaveBeenCalledOnce();
  });

  it('suppresses rapid repeats, background feedback and expired actions', async () => {
    sound.unlockSound();
    await sound.playSound('tap');
    await sound.playSound('tap');
    expect(source.start).toHaveBeenCalledOnce();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    await sound.playSound('success');
    expect(source.start).toHaveBeenCalledOnce();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 16000);
    await sound.playSound('success');
    expect(source.start).toHaveBeenCalledOnce();
  });

  it('drops in-flight audio if muted while decoding', async () => {
    let finish;
    const decoded = new Promise(resolve => { finish = resolve; });
    context.decodeAudioData.mockReturnValue(decoded);
    sound.unlockSound();
    const pending = sound.playSound('error');
    sound.setSoundEnabled(false);
    finish({});
    await pending;
    expect(source.start).not.toHaveBeenCalled();
  });

  it('lets a fast confirmation replace the activation tap', async () => {
    sound.unlockSound();
    await sound.playSound('tap');
    await sound.playSound('success');
    expect(source.start).toHaveBeenCalledTimes(2);
    await sound.playSound('success');
    expect(source.start).toHaveBeenCalledTimes(2);
  });

  it('provides distinct like and route sounds, allowing navigation to replace the tap', async () => {
    sound.unlockSound();
    await sound.playSound('tap');
    await sound.playSound('navigate');
    expect(source.start).toHaveBeenCalledTimes(2);
    expect(source.stop).toHaveBeenCalledOnce();
    await sound.playSound('like');
    expect(source.start).toHaveBeenCalledTimes(3);
  });

  it('plays one delayed loading cue for concurrent requests and cancels fast loads', async () => {
    vi.useFakeTimers();
    sound.unlockSound();
    // Let the asset preload settle before advancing the loading delay.
    await sound.playSound('tap');
    source.start.mockClear();
    const fast = sound.startLoadingSound();
    fast();
    await vi.advanceTimersByTimeAsync(800);
    expect(source.start).not.toHaveBeenCalled();
    const first = sound.startLoadingSound();
    const second = sound.startLoadingSound();
    first();
    await vi.advanceTimersByTimeAsync(700);
    expect(source.start).toHaveBeenCalledOnce();
    second();
    await vi.advanceTimersByTimeAsync(5000);
    expect(source.start).toHaveBeenCalledOnce();
  });

  it('does not play delayed loading feedback after muting', async () => {
    vi.useFakeTimers();
    sound.unlockSound();
    await sound.playSound('tap');
    source.start.mockClear();
    const stop = sound.startLoadingSound();
    sound.setSoundEnabled(false);
    await vi.advanceTimersByTimeAsync(800);
    expect(source.start).not.toHaveBeenCalled();
    stop();
  });

  it('silently recovers from unavailable audio files', async () => {
    fetch.mockRejectedValue(new Error('offline'));
    sound.unlockSound();
    await expect(sound.playSound('tap')).resolves.toBeUndefined();
    expect(source.start).not.toHaveBeenCalled();
  });
});
