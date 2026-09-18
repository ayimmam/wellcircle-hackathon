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
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

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
