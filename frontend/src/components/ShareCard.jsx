import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { showToast } from './Toast';
import { track } from '../analytics';
import { getNextMilestone } from '../utils/milestones';
import Icon from './Icon';

const SIZE = 1080;

/**
 * Renders a shareable milestone image (joined, streak, tier, personal best)
 * so a proof-of-progress card users actually want to post — "people don't
 * share app features, they share proof." Triggered by useCheckin's
 * `onMilestone` callback (streak/personal-best) or shown once per user on
 * their first Home load (joined — see ForYouScreen's JOIN_CARD_SEEN_KEY).
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

  const { type, streak, day, tier } = milestone;
  // The hero is a single number with a quiet caps label under it — the stat
  // carries the message, so the card reads as a record rather than a sticker.
  const statValue = type === 'joined' ? day : streak;
  const statLabel = type === 'joined'
    ? (day <= 1 ? t('Day one') : t('Days in'))
    : type === 'personal_best'
      ? t('Day personal best')
      : t('Day streak');
  const headline = type === 'joined'
    ? (day <= 1 ? t('Just joined Well Circle') : t('Day {{day}} on Well Circle', { day }))
    : type === 'personal_best'
      ? t('New personal best')
      : t('{{streak}}-day streak', { streak });
  const subline = type === 'joined'
    ? t('The start of my wellness journey')
    : type === 'personal_best'
      ? t('My longest streak yet')
      : t('Showing up, one day at a time');
  const nextMilestone = getNextMilestone(user);
  const analyticsProps = type === 'joined' ? { type, day } : { type, streak };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // e.g. jsdom in tests, which doesn't implement canvas 2d rendering
    canvas.width = SIZE;
    canvas.height = SIZE;

    // Deep, low-chroma gradient — reads closer to a premium training app than
    // the brighter in-product accent does.
    const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    gradient.addColorStop(0, '#0B1220');
    gradient.addColorStop(1, '#0A5DC2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';

    // letterSpacing is ignored on engines that don't support it (falls back to
    // normal tracking) — worth setting for the caps lines where it matters most.
    const caps = (text, y, size, alpha, spacing) => {
      ctx.font = `600 ${size}px system-ui, -apple-system, sans-serif`;
      ctx.letterSpacing = `${spacing}px`;
      ctx.globalAlpha = alpha;
      ctx.fillText(text.toUpperCase(), SIZE / 2, y);
      ctx.letterSpacing = '0px';
      ctx.globalAlpha = 1;
    };

    caps('Well Circle', 130, 34, 0.7, 6);

    // Hairline rule under the wordmark
    ctx.globalAlpha = 0.25;
    ctx.fillRect(SIZE / 2 - 60, 168, 120, 2);
    ctx.globalAlpha = 1;

    ctx.font = '800 340px system-ui, -apple-system, sans-serif';
    ctx.fillText(String(statValue), SIZE / 2, 560);

    caps(statLabel, 640, 40, 0.85, 8);

    ctx.font = '500 40px system-ui, -apple-system, sans-serif';
    ctx.globalAlpha = 0.75;
    ctx.fillText(subline, SIZE / 2, 740);
    ctx.globalAlpha = 1;

    if (tier) {
      caps(t('{{tier}} tier', { tier }), 830, 30, 0.6, 5);
    }

    if (user?.name) {
      ctx.font = '600 36px system-ui, -apple-system, sans-serif';
      ctx.globalAlpha = 0.9;
      // Keep a long name from running off the card edges
      let name = user.name;
      const maxWidth = SIZE - 160;
      while (name.length > 4 && ctx.measureText(name).width > maxWidth) {
        name = `${name.slice(0, -2).trimEnd()}…`;
      }
      ctx.fillText(name, SIZE / 2, SIZE - 130);
      ctx.globalAlpha = 1;
    }

    ctx.font = '500 30px system-ui, -apple-system, sans-serif';
    ctx.globalAlpha = 0.65;
    ctx.fillText('@wellcirclebot on Telegram', SIZE / 2, SIZE - 72);
    ctx.globalAlpha = 1;
  }, [statValue, statLabel, subline, tier, user?.name, t]);

  const toBlob = () => new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/png'));

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = await toBlob();
      const file = new File([blob], `wellcircle-${type}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Well Circle',
          text: `${headline} — @wellcirclebot on Telegram`,
        });
        track('share_card_shared', analyticsProps);
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
      a.download = `wellcircle-${type}.png`;
      a.click();
      URL.revokeObjectURL(url);
      track('share_card_downloaded', analyticsProps);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    track('share_card_shown', analyticsProps);
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
        <p id="share-card-caption" className="text-secondary text-sm" style={{ textAlign: 'center', marginBottom: 4 }}>
          {headline} — {subline}
        </p>
        <p
          id="share-card-next-milestone"
          className="text-secondary text-xs"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}
        >
          <Icon name={nextMilestone.icon} size={13} />
          {t('Next up')}: {nextMilestone.label}
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
