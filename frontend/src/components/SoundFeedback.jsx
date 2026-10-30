import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSoundEnabled, subscribeSound, setSoundEnabled, unlockSound, playSound } from '../utils/sound';

export function SoundToggle() {
  const enabled = useSyncExternalStore(subscribeSound, getSoundEnabled, () => false);
  const { t } = useTranslation();
  return (
    <button type="button" className="burger-nav-item" aria-pressed={enabled}
      data-ui-sound="off" onClick={() => {
        setSoundEnabled(!enabled);
        if (!enabled) { unlockSound(); playSound('tap'); }
      }}>
      <span className="burger-nav-icon" aria-hidden="true">{enabled ? '♪' : '♩'}</span>
      <span className="burger-nav-label">{t('Interface sounds')}
        <small className="burger-nav-desc">{enabled ? t('On · tap to mute') : t('Off · tap to enable')}</small>
      </span>
    </button>
  );
}

export default function SoundFeedback() {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname) playSound('navigate');
    previousPath.current = pathname;
  }, [pathname]);
  useEffect(() => {
    const prepare = event => {
      if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
      unlockSound();
    };
    const activate = event => {
      const control = event.target.closest?.('button, a[href], [role="button"], [role="tab"], [role="switch"]');
      if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;
      unlockSound();
      if (event.defaultPrevented || control.dataset.uiSound === 'off'
        || control.matches('[aria-current="page"], [aria-selected="true"], .nav-item.active, .burger-nav-item.active')) return;
      // One cue per activation, including keyboard and assistive technology clicks.
      playSound(control.dataset.uiSound || 'tap');
    };
    document.addEventListener('click', activate);
    document.addEventListener('pointerdown', prepare, { passive: true });
    document.addEventListener('keydown', prepare);
    const sync = event => {
      if (event.key === 'wellcircle-sound') setSoundEnabled(event.newValue !== 'off');
    };
    window.addEventListener('storage', sync);
    return () => {
      document.removeEventListener('click', activate);
      document.removeEventListener('pointerdown', prepare);
      document.removeEventListener('keydown', prepare);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return null;
}
