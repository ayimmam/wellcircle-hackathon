/**
 * Rewrite remote image URLs to ask for something close to the size we actually
 * render.
 *
 * Provider covers, product shots and post photos are arbitrary URLs typed in by
 * providers and users, so there is no upload pipeline to resize them at write
 * time. What we can do is add the resize/quality parameters the common hosts
 * already support, which turns a 2MB full-resolution photo into a few tens of
 * kilobytes for a 160px-tall card — a large win on a Telegram in-app
 * connection, at no infrastructure cost.
 *
 * Unrecognised hosts are returned untouched: a wrong guess would break the
 * image, and a slightly heavy image is a much smaller problem than a missing one.
 */

// Retina without going overboard: a 3x asset on a 400px card is mostly wasted
// bytes on the mid-range Android phones this app targets.
const MAX_DPR = 2;

/**
 * The only source widths we ever ask for.
 *
 * Every cache — the browser's, the service worker's, the CDN's — is keyed on
 * the exact URL, so an avatar requested at 36px on one screen and 40px on the
 * next is two downloads of the same face, and a phone with a 2.75 DPR asks for
 * widths no other device shares. Rounding up to a short ladder collapses all
 * of that onto a handful of URLs per image: the second screen to show a photo
 * gets it from disk instead of the network.
 *
 * Rounding is always *up*, so a quantised source is never smaller than the box
 * it renders into.
 */
const WIDTH_LADDER = [48, 96, 160, 240, 320, 480, 640, 960, 1280];

function quantizeWidth(width) {
  if (!width) return null;
  return WIDTH_LADDER.find(step => step >= width) ?? WIDTH_LADDER[WIDTH_LADDER.length - 1];
}

/**
 * Source pixels to request for an element rendered `cssWidth` wide, snapped to
 * the shared ladder.
 */
export function sourceWidthFor(cssWidth) {
  if (!cssWidth) return null;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return quantizeWidth(Math.round(cssWidth * Math.min(dpr, MAX_DPR)));
}

/**
 * @param {string} url        Original image URL.
 * @param {{width?: number, quality?: number}} [options]
 *        `width` is the source width to request, in real pixels.
 */
export function optimizeImageUrl(url, { width: requested, quality = 70 } = {}) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  let parsed;
  try {
    parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://localhost');
  } catch {
    return url;
  }

  const host = parsed.hostname;

  // Unsplash's imgix pipeline: seed data and many provider covers use it.
  if (host === 'images.unsplash.com') {
    if (requested) parsed.searchParams.set('w', String(requested));
    parsed.searchParams.set('q', String(quality));
    parsed.searchParams.set('auto', 'format,compress');
    parsed.searchParams.set('fit', 'crop');
    return parsed.toString();
  }

  // Cloudinary delivery URLs (uploads, and anything a provider pastes from
  // their own Cloudinary account): inject a transformation segment after
  // /upload/ unless one is already present.
  if (host.endsWith('res.cloudinary.com')) {
    const marker = '/upload/';
    const at = parsed.pathname.indexOf(marker);
    if (at === -1) return url;
    const after = parsed.pathname.slice(at + marker.length);
    // A transformation segment is already there (e.g. `w_400,q_auto/`) — leave
    // the author's intent alone rather than stacking a second one.
    if (/^[a-z]{1,3}_[^/]*\//.test(after)) return url;
    const transform = ['f_auto', 'q_auto', requested ? `w_${requested}` : null, 'c_limit']
      .filter(Boolean)
      .join(',');
    parsed.pathname = `${parsed.pathname.slice(0, at + marker.length)}${transform}/${after}`;
    return parsed.toString();
  }

  // Avatar generators — both take a pixel size.
  if (host === 'ui-avatars.com') {
    if (requested) parsed.searchParams.set('size', String(Math.min(requested, 512)));
    return parsed.toString();
  }
  if (host === 'i.pravatar.cc') {
    if (requested) parsed.pathname = `/${Math.min(requested, 512)}`;
    return parsed.toString();
  }

  return url;
}

/**
 * Build a `srcset` for hosts that can resize, so the browser picks a source
 * for the device it's actually on instead of always taking the 2x asset.
 * Returns null when the host can't resize, in which case `src` is enough.
 *
 * @param {string} url
 * @param {number} cssWidth The width the element is rendered at, in CSS px.
 */
export function buildSrcSet(url, cssWidth) {
  if (!url || !cssWidth) return null;
  if (!/images\.unsplash\.com|res\.cloudinary\.com/.test(url)) return null;

  const widths = [1, 2].map(dpr => quantizeWidth(Math.round(cssWidth * dpr)));
  // Small images (avatars, thumbnails) land in the same ladder step at both
  // densities. A srcset of two identical URLs tells the browser nothing, so
  // let `src` carry it alone and keep one candidate in every cache.
  if (widths[0] === widths[1]) return null;

  return widths
    .map((width, i) => `${optimizeImageUrl(url, { width })} ${i + 1}x`)
    .join(', ');
}
