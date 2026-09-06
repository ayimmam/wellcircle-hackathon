import { useLayoutEffect, useRef, useState } from 'react';
import { optimizeImageUrl, buildSrcSet, sourceWidthFor } from '../utils/imageUrl';

/**
 * The app's single `<img>`. Renders a plain image element — no wrapper, so it
 * drops into the existing layout and CSS unchanged — with the four things
 * every remote image here needs and almost none of them had:
 *
 *  - a compressed, correctly-sized source (see utils/imageUrl),
 *  - `loading="lazy"` for anything below the fold, so a feed of thirty avatars
 *    doesn't open thirty connections at once,
 *  - a shimmer painted behind the image until it decodes, which reads as
 *    progress rather than a blank rectangle — and *not* painted at all when
 *    the image is already on the device,
 *  - the caller's own empty state instead of a broken-image icon when a
 *    provider-supplied URL is dead.
 *
 * Set `priority` on the one image visible at the top of a screen (the Home
 * hero, a detail page cover). Deferring the image the user is already looking
 * at makes the screen slower, not faster.
 *
 * @param {{src?: string, alt?: string, width?: number, priority?: boolean,
 *          fallback?: React.ReactNode, className?: string, quality?: number}} props
 */
export default function SmartImage({
  src,
  alt = '',
  width,
  priority = false,
  fallback = null,
  className = '',
  quality,
  onLoad,
  onError,
  ...rest
}) {
  const [state, setState] = useState('loading');
  const imgRef = useRef(null);

  // An image served from the device cache can finish decoding before React
  // has attached `onLoad`, which strands the shimmer on top of a photo that is
  // already painted. Checking `complete` before the browser paints turns a
  // cached image into no visible load at all — which is the whole point of
  // caching it. Runs on `src` changes too, since one <img> is reused when a
  // carousel or a revalidated feed swaps the URL underneath it.
  useLayoutEffect(() => {
    const node = imgRef.current;
    if (node && node.complete && node.naturalWidth > 0) setState('loaded');
  }, [src]);

  if (!src || state === 'failed') return fallback;

  return (
    <img
      ref={imgRef}
      src={optimizeImageUrl(src, { width: sourceWidthFor(width), quality })}
      srcSet={buildSrcSet(src, width) || undefined}
      alt={alt}
      className={`smart-image ${className}`.trim()}
      data-loaded={state === 'loaded' ? 'true' : 'false'}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchpriority={priority ? 'high' : undefined}
      onLoad={(event) => { setState('loaded'); onLoad?.(event); }}
      onError={(event) => { setState('failed'); onError?.(event); }}
      {...rest}
    />
  );
}
