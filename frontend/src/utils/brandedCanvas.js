/**
 * Branded canvas utilities — shared image-generation helpers for ShareCard.jsx,
 * story sharing, and provider/event poster sharing (WS12 of
 * docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026_ROUND2.md).
 *
 * Extracts the canvas drawing helpers from ShareCard.jsx into a shared module
 * so the wordmark/caption/share logic is reused, not duplicated.
 */

import { showToast } from '../components/Toast';
import { track } from '../analytics';

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'WellCircleBot';
const DEEP_LINK_BASE = `https://t.me/${BOT_USERNAME}`;

/**
 * Draw the Well Circle wordmark and branding bar onto a canvas context.
 * Used by both ShareCard (milestone images) and story/poster share images.
 */
export function drawBrandingBar(ctx, width, height) {
  // Bottom gradient band
  const gradient = ctx.createLinearGradient(0, height - 120, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - 120, width, 120);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';

  // Wordmark
  ctx.font = '500 28px system-ui, -apple-system, sans-serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText(`@${BOT_USERNAME} on Telegram`, width / 2, height - 30);
  ctx.globalAlpha = 1;
}

/**
 * Draw a title + subtitle over the image.
 */
export function drawOverlayText(ctx, width, height, title, subtitle) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;

  if (title) {
    ctx.font = '700 42px system-ui, -apple-system, sans-serif';
    ctx.fillText(title, width / 2, height - 100, width - 80);
  }
  if (subtitle) {
    ctx.font = '500 28px system-ui, -apple-system, sans-serif';
    ctx.globalAlpha = 0.85;
    ctx.fillText(subtitle, width / 2, height - 60, width - 80);
    ctx.globalAlpha = 1;
  }
  ctx.shadowBlur = 0;
}

/**
 * Safe image loader with timeout for canvas rendering.
 */
function loadImage(src, timeoutMs = 800) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error('No image src'));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let timer = null;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('Image load timeout'));
    }, timeoutMs);
    img.onload = () => {
      cleanup();
      resolve(img);
    };
    img.onerror = (err) => {
      cleanup();
      reject(err);
    };
    img.src = src;
  });
}

/**
 * Generate a branded share image from a source image URL.
 * Returns a Blob (PNG) suitable for Web Share API or download.
 */
export async function generateBrandedImage({ imageUrl, title, subtitle, aspectWidth = 1080, aspectHeight = 1920 }) {
  const canvas = document.createElement('canvas');
  canvas.width = aspectWidth;
  canvas.height = aspectHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Fill background
  ctx.fillStyle = '#0B1220';
  ctx.fillRect(0, 0, aspectWidth, aspectHeight);

  // Load and draw the source image
  try {
    const img = await loadImage(imageUrl, 1000);
    // Cover-fit the image
    const scale = Math.max(aspectWidth / img.width, aspectHeight / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (aspectWidth - w) / 2, (aspectHeight - h) / 2, w, h);
  } catch {
    // If image fails to load, continue with the dark background
  }

  drawBrandingBar(ctx, aspectWidth, aspectHeight);
  if (title || subtitle) {
    drawOverlayText(ctx, aspectWidth, aspectHeight, title, subtitle);
  }

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Three-tier share fallback: Web Share API → Telegram inline query → clipboard.
 * Used by StoryViewer, ProviderDetail, and EventsScreen share buttons.
 */
export async function shareBrandedImage({ imageUrl, title, subtitle, tag = 'share' }) {
  try {
    const blob = await generateBrandedImage({ imageUrl, title, subtitle });
    if (!blob) {
      showToast('Could not generate share image', 'error');
      return;
    }

    const file = new File([blob], `wellcircle-${tag}.png`, { type: 'image/png' });
    const deepLink = `${DEEP_LINK_BASE}?startapp=${tag}`;
    const shareText = `${title || 'Check this out'} — Join me on Well Circle! ${deepLink}`;

    // Tier 1: Web Share API (works for Instagram, WhatsApp, etc.)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Well Circle',
        text: shareText,
      });
      track('branded_share_completed', { tag, method: 'web_share' });
      return;
    }

    // Tier 2: Telegram inline query (inside Telegram only)
    const tg = window.Telegram?.WebApp;
    if (tg?.switchInlineQuery) {
      tg.switchInlineQuery(shareText, ['users', 'groups']);
      track('branded_share_completed', { tag, method: 'inline_query' });
      return;
    }

    // Tier 3: Clipboard fallback
    await navigator.clipboard.writeText(deepLink);
    showToast('Link copied!', 'success');
    track('branded_share_completed', { tag, method: 'clipboard' });
  } catch (err) {
    if (err?.name !== 'AbortError') {
      // Clipboard fallback on share failure
      const deepLink = `${DEEP_LINK_BASE}?startapp=${tag}`;
      try {
        await navigator.clipboard.writeText(deepLink);
        showToast('Link copied!', 'success');
      } catch {
        showToast('Could not share', 'error');
      }
    }
  }
}


/**
 * Draw a rounded rectangle on a canvas context.
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Word wrap helper for canvas text.
 */
function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = ctx.measureText ? ctx.measureText(testLine).width : testLine.length * 10;
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Generate a high-quality branded post card image on a canvas.
 * Includes author info, content, activity stats, attached photo, and @wellcirclebot watermark.
 */
export async function generatePostCardBlob(post, { width = 1080, height = 1350 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#080D1A');
  bgGrad.addColorStop(0.5, '#0F1E36');
  bgGrad.addColorStop(1, '#091322');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Inner card frame with subtle glass border
  const cardPad = 48;
  const cardW = width - cardPad * 2;
  const cardH = height - cardPad * 2;
  const cardR = 36;

  ctx.save();
  drawRoundedRect(ctx, cardPad, cardPad, cardW, cardH, cardR);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Header: Brand & Tagline
  ctx.textAlign = 'left';
  ctx.fillStyle = '#60A5FA';
  ctx.font = '700 28px system-ui, -apple-system, sans-serif';
  if (ctx.letterSpacing) ctx.letterSpacing = '5px';
  ctx.fillText('WELL CIRCLE', cardPad + 36, cardPad + 60);
  if (ctx.letterSpacing) ctx.letterSpacing = '0px';

  // Header chip / Source on top right
  const sourceName = post?.source?.name || (post?.activity_type ? post.activity_type.toUpperCase() : 'WELLNESS');
  ctx.textAlign = 'right';
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(sourceName, width - cardPad - 36, cardPad + 60);

  // Hairline divider
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(cardPad + 36, cardPad + 90, cardW - 72, 1.5);

  let curY = cardPad + 140;

  // Author avatar + info
  const avatarX = cardPad + 36;
  const avatarY = curY;
  const avatarSize = 88;
  const avatarRadius = avatarSize / 2;

  // Draw avatar
  let avatarLoaded = false;
  if (post?.user?.photo_url) {
    try {
      const avatarImg = await loadImage(post.user.photo_url, 800);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      avatarLoaded = true;
    } catch {
      avatarLoaded = false;
    }
  }

  if (!avatarLoaded) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
    const avGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
    avGrad.addColorStop(0, '#3B82F6');
    avGrad.addColorStop(1, '#8B5CF6');
    ctx.fillStyle = avGrad;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 36px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const initial = (post?.user?.name || 'U').charAt(0).toUpperCase();
    ctx.fillText(initial, avatarX + avatarRadius, avatarY + avatarRadius + 12);
    ctx.restore();
  }

  // Author Name & Handle
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 36px system-ui, -apple-system, sans-serif';
  const authorName = post?.user?.name || 'Well Circle Member';
  ctx.fillText(authorName, avatarX + avatarSize + 24, avatarY + 36);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '500 24px system-ui, -apple-system, sans-serif';
  const handle = post?.user?.telegram_handle ? `@${post.user.telegram_handle}` : `@${authorName.toLowerCase().replace(/\s+/g, '')}`;
  ctx.fillText(handle, avatarX + avatarSize + 24, avatarY + 72);

  curY += avatarSize + 36;

  // Activity stats pill (if present)
  if (post?.activity_type) {
    const statsText = [
      post.activity_type.toUpperCase(),
      post.distance_km ? `${post.distance_km} km` : null,
      post.duration_min ? `${post.duration_min} min` : null,
    ].filter(Boolean).join('  ·  ');

    ctx.font = '600 24px system-ui, -apple-system, sans-serif';
    const textWidth = ctx.measureText ? ctx.measureText(statsText).width : 200;
    const pillW = textWidth + 48;
    const pillH = 48;

    drawRoundedRect(ctx, cardPad + 36, curY, pillW, pillH, 24);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#34D399';
    ctx.fillText(`⚡ ${statsText}`, cardPad + 60, curY + 32);
    curY += pillH + 28;
  }

  // Post Content text
  if (post?.content) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F9FAFB';
    const isShort = post.content.length < 90;
    ctx.font = isShort ? '600 38px system-ui, -apple-system, sans-serif' : '400 32px system-ui, -apple-system, sans-serif';
    const lineHeight = isShort ? 54 : 46;
    const maxContentWidth = cardW - 72;
    const lines = wrapText(ctx, post.content, maxContentWidth);

    for (let i = 0; i < Math.min(lines.length, 7); i++) {
      ctx.fillText(lines[i], cardPad + 36, curY + 30);
      curY += lineHeight;
    }
    curY += 20;
  }

  // Attached Post Photo (if present)
  if (post?.photo_url) {
    try {
      const postImg = await loadImage(post.photo_url, 800);
      const maxPhotoH = height - curY - cardPad - 160;
      if (maxPhotoH > 150) {
        const photoW = cardW - 72;
        const photoH = Math.min(maxPhotoH, 440);
        const photoX = cardPad + 36;
        const photoY = curY;

        ctx.save();
        drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 24);
        ctx.clip();

        const scale = Math.max(photoW / postImg.width, photoH / postImg.height);
        const dw = postImg.width * scale;
        const dh = postImg.height * scale;
        ctx.drawImage(postImg, photoX + (photoW - dw) / 2, photoY + (photoH - dh) / 2, dw, dh);
        ctx.restore();
      }
    } catch {
      // Ignore photo load failure
    }
  }

  // Watermark Footer at bottom of card
  const footerY = height - cardPad - 90;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  drawRoundedRect(ctx, cardPad + 36, footerY, cardW - 72, 64, 20);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#93C5FD';
  ctx.font = '600 26px system-ui, -apple-system, sans-serif';
  ctx.fillText(`@${BOT_USERNAME} on Telegram`, width / 2, footerY + 41);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Share a post as a branded image card outside the app.
 * Includes @wellcirclebot as watermark below.
 */
export async function sharePostCard(post) {
  try {
    if (post?.id) {
      import('../api/client').then(({ sharePost }) => {
        sharePost(post.id).catch(() => {});
      });
    }

    const blob = await generatePostCardBlob(post);
    if (!blob) {
      showToast('Could not generate post card', 'error');
      return;
    }

    const file = new File([blob], `wellcircle-post-${post?.id || 'share'}.png`, { type: 'image/png' });
    const botUsername = BOT_USERNAME;
    const deepLink = `${DEEP_LINK_BASE}?startapp=post_${post?.id || ''}`;
    const authorName = post?.user?.name || 'Someone';
    const shareText = `Check out this post by ${authorName} on Well Circle! @${botUsername} on Telegram ${deepLink}`;

    // Tier 1: Web Share API (native share sheet with image file)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Well Circle Post',
        text: shareText,
      });
      track('post_card_shared', { postId: post?.id, method: 'web_share' });
      showToast('Post shared!', 'success');
      return;
    }

    // Tier 2: Telegram inline query (inside Telegram WebApp)
    const tg = window.Telegram?.WebApp;
    if (tg?.switchInlineQuery) {
      tg.switchInlineQuery(shareText, ['users', 'groups']);
      track('post_card_shared', { postId: post?.id, method: 'inline_query' });
      showToast('Opening Telegram share...', 'success');
      return;
    }

    // Tier 3: Download card image and copy link to clipboard
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wellcircle-post-${post?.id || 'card'}.png`;
    a.click();
    URL.revokeObjectURL(url);
    await navigator.clipboard.writeText(deepLink);
    showToast('Post card downloaded & link copied!', 'success');
    track('post_card_shared', { postId: post?.id, method: 'download_and_copy' });
  } catch (err) {
    if (err?.name !== 'AbortError') {
      showToast('Could not share post', 'error');
    }
  }
}

