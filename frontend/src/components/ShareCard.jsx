import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { showToast } from './Toast';
import { track } from '../analytics';
import Icon from './Icon';

const SIZE = 1080;

/**
 * Renders a shareable milestone image (streak, tier, personal best) so a
 * proof-of-progress card users actually want to post — "people don't share
 * app features, they share proof." Triggered by useCheckin's `onMilestone`
 * callback on 7-day streak multiples and new personal bests.
 *
 * Draws onto a canvas rather than a screenshot-able DOM node so the same
 * asset works for both the Web Share API (as a File) and a plain download,
 * with no html-to-image dependency.
 */
export default function ShareCard({ milestone, onClose }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const { type, streak, tier, tierEmoji } = milestone;
  const headline = type === 'personal_best'
    ? t('New personal best!')
    : t('{{streak}}-day streak!', { streak });
  const subline = type === 'personal_best'
    ? t('{{streak}} days — my longest yet', { streak })
    : t('Every {{streak}} days earns a streak freeze', { streak });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // e.g. jsdom in tests, which doesn't implement canvas 2d rendering
    canvas.width = SIZE;
    canvas.height = SIZE;

    const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    gradient.addColorStop(0, '#0A5DC2');
    gradient.addColorStop(1, '#55A6FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';

    ctx.font = '600 44px system-ui, sans-serif';
    ctx.globalAlpha = 0.9;
    ctx.fillText('Well Circle', SIZE / 2, 140);
    ctx.globalAlpha = 1;

    ctx.font = '800 180px system-ui, sans-serif';
    ctx.fillText(`${tierEmoji || '🔥'}`, SIZE / 2, 440);

    ctx.font = '800 88px system-ui, sans-serif';
    ctx.fillText(headline, SIZE / 2, 620);

    ctx.font = '500 40px system-ui, sans-serif';
    ctx.globalAlpha = 0.85;
    ctx.fillText(subline, SIZE / 2, 690);
    ctx.globalAlpha = 1;

    if (tier) {
      ctx.font = '600 36px system-ui, sans-serif';
      ctx.globalAlpha = 0.8;
      ctx.fillText(t('{{tier}} tier', { tier: tier.charAt(0).toUpperCase() + tier.slice(1) }), SIZE / 2, 800);
      ctx.globalAlpha = 1;
    }

    ctx.font = '500 32px system-ui, sans-serif';
    ctx.globalAlpha = 0.7;
    ctx.fillText(user?.name ? `${user.name} · wellcircle.app` : 'wellcircle.app', SIZE / 2, SIZE - 80);
    ctx.globalAlpha = 1;
  }, [headline, subline, tier, tierEmoji, user?.name, t]);

  const toBlob = () => new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/png'));

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await toBlob();
      const file = new File([blob], 'wellcircle-streak.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Well Circle', text: headline });
        track('share_card_shared', { type, streak });
      } else {
        await handleDownload(blob);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') showToast(t('Could not share — try downloading instead'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (preBlob) => {
    setBusy(true);
    try {
      const blob = preBlob || await toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wellcircle-streak.png';
      a.click();
      URL.revokeObjectURL(url);
      track('share_card_downloaded', { type, streak });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    track('share_card_shown', { type, streak });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet" id="share-card-sheet">
        <div className="sheet-handle" />
        <div className="flex items-center justify-between mb-16">
          <h3 className="sheet-title" style={{ marginBottom: 0 }}>{t('Share your progress')}</h3>
          <button
            className="btn btn-icon btn-secondary"
            onClick={onClose}
            aria-label={t('Close')}
            id="share-card-close-btn"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <canvas
          ref={canvasRef}
          id="share-card-canvas"
          role="img"
          aria-label={`${headline} ${subline}`}
          style={{ width: '100%', borderRadius: 16, display: 'block', marginBottom: 8 }}
        />
        {/* Canvas text isn't screen-reader accessible — mirror it visibly too */}
        <p id="share-card-caption" className="text-secondary text-sm" style={{ textAlign: 'center', marginBottom: 16 }}>
          {headline} — {subline}
        </p>
        <div className="flex gap-8">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleShare} disabled={busy} id="share-card-share-btn">
            <Icon name="share" size={15} /> {t('Share')}
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleDownload()} disabled={busy} id="share-card-download-btn">
            <Icon name="download" size={15} /> {t('Download')}
          </button>
        </div>
      </div>
    </>
  );
}
