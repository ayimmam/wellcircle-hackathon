import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { track } from '../analytics';
import newLogo from '../new_logo.png';

// The landing behind the printed QR stands in partner studios
// (wellcircle.et/visit). A scan lands here with no app, no session and often
// no Telegram, so the page asks exactly one question — "Do you have
// Telegram?" — and sends each answer somewhere that works:
//   yes -> the bot deep link, which opens the Mini App
//   no  -> "/" , the normal web entry (splash decides where they go next)
//
// Deliberately no auto-detection: a browser cannot reliably tell whether
// Telegram is installed, and a wrong guess strands the visitor on an app-store
// page. Two buttons always.

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'WellCircleBot';

// Each stand can carry its own QR (…/visit?src=boston-day-spa) so scans are
// attributable. Telegram's startapp payload only accepts A-Za-z0-9_- and 64
// chars, so anything else is dropped rather than producing a dead link.
const SRC_MAX = 56;
export function sanitizeSrc(raw) {
  if (!raw) return '';
  return String(raw).replace(/[^A-Za-z0-9_-]/g, '').slice(0, SRC_MAX);
}

export function telegramLink(src) {
  const clean = sanitizeSrc(src);
  const base = `https://t.me/${BOT_USERNAME}`;
  return clean ? `${base}?startapp=src_${clean}` : base;
}

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'am', label: 'አማርኛ' },
];

export default function VisitScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState(i18n.language === 'am' ? 'am' : 'en');

  const src = sanitizeSrc(params.get('src'));
  const link = useMemo(() => telegramLink(src), [src]);

  // Scan -> choice is the whole funnel this page exists to measure, so the
  // view fires once per mount (StrictMode double-invokes effects in dev; the
  // ref keeps that from double-counting) and each button reports its answer.
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track('visit_page_viewed', {
      src: src || null,
      tagged: Boolean(src),
      in_telegram: Boolean(window.Telegram?.WebApp?.initData),
    });
  }, [src]);

  // The stand is bilingual, so the page it points at must be too. The scanner
  // has never opened Well Circle, so there is no saved preference to read —
  // the toggle below is the only signal, and it drives i18n for the session.
  useEffect(() => {
    if (i18n.language !== lang) i18n.changeLanguage(lang);
  }, [lang, i18n]);

  // Keep the source tag on the web path as well, so the "no Telegram" half of
  // the funnel stays attributable to the same stand.
  const goToWeb = () => {
    track('visit_choice_web', { src: src || null, lang });
    navigate(src ? `/?src=${src}` : '/', { replace: true });
  };

  // Fires on the way out to t.me. The click is not intercepted — PostHog's
  // 250ms flush plus its pagehide handler carry the event, and swallowing the
  // navigation to guarantee delivery would cost more than a dropped event.
  const onTelegram = () => track('visit_choice_telegram', { src: src || null, lang });

  return (
    <div className="visit-screen">
      <div className="visit-lang" role="group" aria-label="Language">
        {LANGS.map(l => (
          <button
            key={l.code}
            type="button"
            className={`visit-lang-btn${lang === l.code ? ' is-active' : ''}`}
            aria-pressed={lang === l.code}
            onClick={() => {
              setLang(l.code);
              track('visit_language_switched', { lang: l.code, src: src || null });
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="visit-card">
        <img src={newLogo} className="visit-logo" alt="Well Circle" />
        <h1 className="visit-title">{t('Welcome to Well Circle')}</h1>
        <p className="visit-tagline">
          {t('Your tribe, your wellness.')}<br />{t('Right where you chat.')}
        </p>

        <h2 className="visit-question">{t('Do you have Telegram?')}</h2>

        <a
          className="btn btn-primary visit-btn"
          href={link}
          id="visit-telegram-btn"
          onClick={onTelegram}
        >
          {t('Yes — open in Telegram')}
        </a>
        <button
          type="button"
          className="btn visit-btn visit-btn-secondary"
          onClick={goToWeb}
          id="visit-web-btn"
        >
          {t("No — continue on the web")}
        </button>

        <p className="visit-note">{t('Free to join. No app download needed.')}</p>
      </div>
    </div>
  );
}
