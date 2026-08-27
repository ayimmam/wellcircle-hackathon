import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { track } from '../analytics';
import newLogo from '../new_logo.png';

// The landing behind the printed QR stands in partner studios
// (wellcircle.et/visit). A scan lands here with no app, no session and often
// no Telegram, so the page asks exactly one question — "Do you have
// Telegram?" — and sends each answer somewhere that works:
//   yes -> the bot deep link, which opens the Mini App
//   no  -> app.wellcircle.et, the standalone web app
//
// The "no" answer must leave this origin: wellcircle.et is the Mini App build,
// whose auth requires Telegram initData, so routing a Telegram-less visitor to
// "/" here would dead-end them on the "initData is missing" error card.
//
// Deliberately no auto-detection: a browser cannot reliably tell whether
// Telegram is installed, and a wrong guess strands the visitor on an app-store
// page. Two buttons always.

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'WellCircleBot';
const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL || 'https://app.wellcircle.et';

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

/** Same stand tag on the web half of the funnel, so both answers stay
 *  attributable to the QR they came from. */
export function webAppLink(src) {
  const clean = sanitizeSrc(src);
  return clean ? `${WEB_APP_URL}/?src=${clean}` : WEB_APP_URL;
}

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'am', label: 'አማርኛ' },
];

export default function VisitScreen() {
  const [params] = useSearchParams();
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState(i18n.language === 'am' ? 'am' : 'en');

  const src = sanitizeSrc(params.get('src'));
  const link = useMemo(() => telegramLink(src), [src]);
  const webLink = useMemo(() => webAppLink(src), [src]);

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

  // Both answers are plain links out of this origin. The clicks are not
  // intercepted — PostHog's 250ms flush plus its pagehide handler carry the
  // event, and swallowing the navigation to guarantee delivery would cost more
  // than an occasionally dropped event.
  const onTelegram = () => track('visit_choice_telegram', { src: src || null, lang });
  const onWeb = () => track('visit_choice_web', { src: src || null, lang });

  return (
    <div className="visit">
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
        <img src={newLogo} className="visit-logo" alt="Well Circle" width={96} height={96} />
        <h1 className="visit-title">{t('Welcome to Well Circle')}</h1>
        <p className="visit-tagline">
          {t('Your tribe, your wellness.')}<br />{t('Right where you chat.')}
        </p>

        <h2 className="visit-question">{t('Do you have Telegram?')}</h2>

        <div className="visit-actions">
          <a
            className="btn btn-primary visit-btn visit-btn-telegram"
            href={link}
            id="visit-telegram-btn"
            onClick={onTelegram}
          >
            {t('Yes — open in Telegram')}
          </a>
          <a
            className="btn btn-secondary visit-btn"
            href={webLink}
            id="visit-web-btn"
            onClick={onWeb}
          >
            {t("No — continue on the web")}
          </a>
        </div>

        <p className="visit-note">{t('Free to join. No app download needed.')}</p>
      </div>

      <p className="visit-footer">wellcircle.et</p>
    </div>
  );
}
