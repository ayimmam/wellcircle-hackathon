import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { optimizeImageUrl, buildSrcSet, sourceWidthFor } from '../utils/imageUrl';

const UNSPLASH = 'https://images.unsplash.com/photo-123';
const widthOf = (url) => Number(new URL(url).searchParams.get('w'));

/**
 * Every cache the app benefits from — the browser's, the service worker's in
 * public/sw.js, the CDN's — is keyed on the exact URL. These tests pin the
 * property that makes those caches work: the same photo asks for the same
 * URL across screens, instead of a slightly different width per component and
 * per device pixel ratio.
 */
describe('image source widths', () => {
  const realDpr = window.devicePixelRatio;
  beforeEach(() => { window.devicePixelRatio = 2; });
  afterEach(() => { window.devicePixelRatio = realDpr; });

  it('collapses near-identical widths onto one source', () => {
    // Avatars are rendered at 36px in the feed and 40px in a member list.
    const feed = optimizeImageUrl(UNSPLASH, { width: sourceWidthFor(36) });
    const memberList = optimizeImageUrl(UNSPLASH, { width: sourceWidthFor(40) });
    expect(feed).toBe(memberList);
  });

  it('never asks for fewer pixels than the element renders', () => {
    [20, 24, 36, 40, 72, 80, 96, 200, 430].forEach(cssWidth => {
      expect(sourceWidthFor(cssWidth)).toBeGreaterThanOrEqual(cssWidth * 2);
    });
  });

  it('keeps odd device pixel ratios on the same ladder as everyone else', () => {
    window.devicePixelRatio = 2.75; // a real mid-range Android value
    const odd = sourceWidthFor(430);
    window.devicePixelRatio = 2;
    expect(odd).toBe(sourceWidthFor(430));
  });

  it('caps a card-width source at one ladder step per density', () => {
    const srcSet = buildSrcSet(UNSPLASH, 430);
    const widths = srcSet.split(', ').map(part => widthOf(part.split(' ')[0]));
    expect(widths).toEqual([480, 960]);
  });

  it('drops the srcset when both densities want the same source', () => {
    // A 20px icon quantises to the smallest ladder step at 1x and 2x alike;
    // two identical candidates tell the browser nothing.
    expect(buildSrcSet(UNSPLASH, 20)).toBeNull();
  });

  it('leaves hosts it cannot resize alone', () => {
    const url = 'https://example.com/cover.jpg';
    expect(optimizeImageUrl(url, { width: sourceWidthFor(430) })).toBe(url);
    expect(buildSrcSet(url, 430)).toBeNull();
  });
});
