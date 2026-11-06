import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  confirmIdentityLink,
  getMyIdentities,
  startIdentityLink,
  verifyIdentityLink,
} from '../api/client';
import { providerLabel } from '../utils/identityProviders';
import Icon from '../components/Icon';
import { getLinkingProviders } from '../utils/linkingProviders';

const CONNECTABLE = {
  google: { label: 'Google' },
  telegram: { label: 'Telegram' },
};

function errorMessage(error, provider) {
  const status = error?.status;
  const label = CONNECTABLE[provider]?.label || 'provider';
  switch (status) {
    case 400:
      return 'This connection attempt expired or is no longer valid. Please start again.';
    case 404:
      return 'This connection attempt is no longer available. Please start again.';
    case 401:
    case 403:
      return 'Your session has expired. Please sign in again.';
    case 409:
      return `That ${label} sign-in is already connected to another Well Circle account. Nothing was changed on this account.`;
    case 503:
      return `${label} verification is temporarily unavailable. Please try again shortly.`;
    default:
      break;
  }
  if (!status) {
    return error?.message || 'We could not reach Well Circle. Check your connection and try again.';
  }
  return 'We could not complete that connection. Please try again.';
}

/**
 * Account management surface for verified identity linking.
 *
 * Three explicit steps per provider — start a server-side challenge, verify a
 * fresh provider credential, then wait for the user's explicit confirmation.
 * The provider credential and the challenge stay in component memory only;
 * nothing is written to localStorage/sessionStorage and nothing is logged.
 *
 * The browser-auth adapters are registered by the website entry point. In the
 * Telegram Mini App no adapters are registered, so this screen stays read-only.
 */
export default function ConnectedAccounts() {
  const navigate = useNavigate();
  const providers = getLinkingProviders();
  const googleAdapter = providers?.google;
  const telegramAdapter = providers?.telegram;
  const linkingAvailable = Boolean(googleAdapter || telegramAdapter);

  const [identities, setIdentities] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(null);
  const [progress, setProgress] = useState('');
  const [pending, setPending] = useState(null);
  const [notice, setNotice] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [telegramReady, setTelegramReady] = useState(false);
  const [telegramSetupError, setTelegramSetupError] = useState('');
  const mounted = useRef(true);
  const actionBusy = useRef(false);

  const applyIdentities = useCallback((list) => {
    setIdentities(Array.isArray(list) ? list : []);
  }, []);

  const loadIdentities = useCallback(async () => {
    try {
      const data = await getMyIdentities();
      if (!mounted.current) return;
      applyIdentities(data?.identities);
      setLoadState('ready');
    } catch (error) {
      if (!mounted.current) return;
      setLoadState('error');
      setLoadError(errorMessage(error));
    }
  }, [applyIdentities]);

  const retryLoad = useCallback(() => {
    setLoadState('loading');
    setLoadError('');
    loadIdentities();
  }, [loadIdentities]);

  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(loadIdentities, 0);
    return () => { mounted.current = false; clearTimeout(timer); };
  }, [loadIdentities]);

  useEffect(() => {
    if (!telegramAdapter?.prepare) return undefined;
    let active = true;
    telegramAdapter.prepare()
      .then(() => { if (active) { setTelegramReady(true); setTelegramSetupError(''); } })
      .catch((error) => { if (active) setTelegramSetupError(error?.message || 'Telegram is unavailable right now.'); });
    return () => { active = false; };
  }, [telegramAdapter]);

  // Retry-After countdown: keep the buttons disabled for exactly the time the
  // backend asked us to wait.
  useEffect(() => {
    if (!cooldownUntil || nowTick >= cooldownUntil) return undefined;
    const id = setTimeout(() => setNowTick(Date.now()), 1000);
    return () => clearTimeout(id);
  }, [cooldownUntil, nowTick]);

  const refreshIdentities = useCallback(async () => {
    try {
      const data = await getMyIdentities();
      if (!mounted.current) return;
      applyIdentities(data?.identities);
      setLoadState('ready');
    } catch {
      // The confirm response already carried the authoritative list; a failed
      // background refresh must not turn a successful link into an error.
    }
  }, [applyIdentities]);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000));
  const cooling = cooldownLeft > 0;
  const blocked = Boolean(busy) || Boolean(pending) || cooling;

  const handleError = useCallback((error, provider) => {
    if (error?.status === 429) {
      const seconds = Math.max(1, Math.ceil(Number(error.retryAfter) || 60));
      setNotice(null);
      setNowTick(Date.now());
      setCooldownUntil(Date.now() + seconds * 1000);
      return;
    }
    setNotice({ tone: 'error', text: errorMessage(error, provider) });
  }, []);

  const beginLink = useCallback(async (provider) => {
    if (actionBusy.current || blocked) return;
    const meta = CONNECTABLE[provider];
    if (!meta) return;
    if (provider === 'google' && !googleAdapter?.configured) return;
    if (provider === 'telegram' && (!telegramAdapter || !telegramReady)) return;

    actionBusy.current = true;
    setNotice(null);
    setPending(null);
    setBusy(provider);
    setProgress('Starting a secure connection…');
    try {
      const challenge = await startIdentityLink(provider);
      const challengeId = challenge?.challenge_id;
      if (!challengeId) throw new Error('Well Circle did not return a connection challenge. Please try again.');

      if (provider === 'google') {
        setProgress('Opening Google…');
        const idToken = await googleAdapter.signIn();
        setProgress('Checking your Google account…');
        const verified = await verifyIdentityLink(challengeId, { google_id_token: idToken });
        setPending({ provider, challengeId, email: verified?.email || null });
      } else {
        setProgress('Opening Telegram…');
        const widgetData = await telegramAdapter.signIn();
        setProgress('Checking your Telegram account…');
        await verifyIdentityLink(challengeId, { telegram_login: widgetData });
        setPending({ provider, challengeId, email: null });
      }
      setProgress('');
    } catch (error) {
      setProgress('');
      handleError(error, provider);
    } finally {
      actionBusy.current = false;
      if (mounted.current) setBusy(null);
    }
  }, [blocked, googleAdapter, handleError, telegramAdapter, telegramReady]);

  const confirmLink = useCallback(async () => {
    if (!pending || busy || actionBusy.current) return;
    const { challengeId, provider } = pending;
    actionBusy.current = true;
    setBusy('confirm');
    setProgress('Connecting this sign-in method…');
    try {
      const result = await confirmIdentityLink(challengeId);
      if (!mounted.current) return;
      applyIdentities(result?.identities);
      if (Array.isArray(result?.identities)) setLoadState('ready');
      setPending(null);
      setNotice({
        tone: 'success',
        text: result?.already_linked
          ? `${CONNECTABLE[provider]?.label || 'That'} is already connected to this account.`
          : `${CONNECTABLE[provider]?.label || 'Sign-in method'} connected. You can now use it to sign in to this account.`,
      });
      // The confirm response is authoritative, but re-read the list so this
      // page always reflects the server's current state.
      await refreshIdentities();
    } catch (error) {
      if (!mounted.current) return;
      setPending(null);
      handleError(error, provider);
    } finally {
      actionBusy.current = false;
      if (mounted.current) {
        setBusy(null);
        setProgress('');
      }
    }
  }, [applyIdentities, busy, handleError, pending, refreshIdentities]);

  const cancelPending = useCallback(() => {
    if (busy) return;
    setPending(null);
    setNotice(null);
  }, [busy]);

  return (
    <div className="page" id="connected-accounts-page">
      <button
        type="button"
        className="btn btn-icon btn-secondary mb-16"
        onClick={() => navigate('/profile')}
        aria-label="Back to profile"
        id="connected-accounts-back"
      >
        <Icon name="chevron-left" size={20} />
      </button>
      <h1 className="section-title mb-8">Connected sign-ins</h1>
      <p className="text-sm text-secondary mb-16">
        Add another way to sign in to this Well Circle account. Connecting a method does not sign you in
        or out, and it never merges accounts.
      </p>

      {notice && (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          id="link-notice"
          className="text-sm mb-16"
          style={{ color: notice.tone === 'error' ? 'var(--danger)' : 'var(--success)' }}
        >
          {notice.text}
        </p>
      )}

      {cooling && (
        <p role="alert" id="link-cooldown" className="text-sm mb-16" style={{ color: 'var(--danger)' }}>
          Too many connection attempts. Try again in {cooldownLeft}s.
        </p>
      )}

      <div className="card mb-16" id="connected-identities-card">
        <div className="card-body">
          <h2 className="card-title text-sm mb-12">Connected methods</h2>

          {loadState === 'loading' && (
            <p className="text-sm text-secondary" role="status">Loading connected sign-ins…</p>
          )}

          {loadState === 'error' && (
            <div>
              <p className="text-sm" role="alert" style={{ color: 'var(--danger)' }}>{loadError}</p>
              <button type="button" className="btn btn-secondary btn-sm mt-12" onClick={retryLoad} id="retry-identities-btn">
                Try again
              </button>
            </div>
          )}

          {loadState === 'ready' && identities.length === 0 && (
            <p className="text-sm text-secondary">No sign-in methods connected yet.</p>
          )}

          {loadState === 'ready' && identities.length > 0 && (
            <div className="flex-col gap-12" aria-label="Connected sign-in methods" id="connected-identities-list">
              {identities.map((identity, index) => (
                <div
                  key={`${identity.provider}:${index}`}
                  className="flex items-center gap-8"
                  style={{ justifyContent: 'space-between' }}
                >
                  <span className="inline-icon-text" style={{ fontSize: '0.9rem' }}>
                    <Icon name={identity.provider === 'google' ? 'mail' : identity.provider === 'telegram' ? 'send' : 'shield'} size={16} />
                    {providerLabel(identity.provider)}
                  </span>
                  <span className="flex items-center gap-8">
                    <span className="text-sm text-secondary" style={{ textAlign: 'right' }}>
                      {identity.email || 'Connected'}
                    </span>
                    <span className="status-badge success">Connected</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {pending ? (
        <div className="card mb-16" id="link-confirmation-card">
          <div className="card-body">
            <h2 className="card-title text-sm mb-8">Confirm connection</h2>
            <p className="text-sm mb-8">
              Connect <strong>{CONNECTABLE[pending.provider]?.label}</strong>
              {pending.email ? <> — <strong>{pending.email}</strong></> : ''} to this Well Circle account?
            </p>
            <p className="text-xs text-secondary mb-16">
              We verified this sign-in method. Nothing will be linked until you confirm below.
            </p>
            <div className="flex gap-8">
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmLink}
                disabled={busy === 'confirm'}
                aria-busy={busy === 'confirm'}
                id="confirm-link-btn"
              >
                {busy === 'confirm' ? 'Connecting…' : 'Confirm connection'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cancelPending}
                disabled={busy === 'confirm'}
                id="cancel-link-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : !linkingAvailable ? (
        <div className="card mb-16" id="connect-methods-card">
          <div className="card-body">
            <h2 className="card-title text-sm mb-8">Connect another method</h2>
            <p className="text-sm text-secondary">
              Connecting a new sign-in method is available on the Well Circle website. This screen is
              read-only inside the Telegram Mini App.
            </p>
          </div>
        </div>
      ) : (
        <div className="card mb-16" id="connect-methods-card">
          <div className="card-body">
            <h2 className="card-title text-sm mb-4">Connect another method</h2>
            <p className="text-xs text-secondary mb-16">
              You will be asked to confirm after Google or Telegram verifies the account.
            </p>

            <button
              type="button"
              className="btn btn-secondary btn-block mb-8"
              onClick={() => beginLink('google')}
              disabled={blocked || !googleAdapter?.configured}
              aria-busy={busy === 'google'}
              id="connect-google-btn"
            >
              <Icon name="mail" size={16} />
              <span style={{ marginLeft: 8 }}>
                {busy === 'google' ? 'Connecting Google…' : 'Connect Google'}
              </span>
            </button>
            {!googleAdapter?.configured && (
              <p className="text-xs text-secondary mb-8" role="status">
                Google sign-in is not available on this website. Use Telegram or contact support.
              </p>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => beginLink('telegram')}
              disabled={blocked || !telegramAdapter || !telegramReady}
              aria-busy={busy === 'telegram'}
              id="connect-telegram-btn"
            >
              <Icon name="send" size={16} />
              <span style={{ marginLeft: 8 }}>
                {busy === 'telegram' ? 'Connecting Telegram…' : 'Connect Telegram'}
              </span>
            </button>
            {telegramSetupError && (
              <div role="status" className="mt-8">
                <p className="text-xs text-secondary">{telegramSetupError}</p>
                <button
                  type="button"
                  className="btn-link"
                  onClick={async () => {
                    setTelegramSetupError('');
                    try {
                      await telegramAdapter?.prepare?.();
                      if (mounted.current) setTelegramReady(true);
                    } catch (error) {
                      if (mounted.current) setTelegramSetupError(error?.message || 'Telegram is unavailable right now.');
                    }
                  }}
                >
                  Retry Telegram
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {progress && (
        <p className="text-sm text-secondary" role="status" aria-live="polite" id="link-progress">
          {progress}
        </p>
      )}

      <p className="text-xs text-secondary">
        To remove a sign-in method, contact support. Removing a method is not available yet.
      </p>
    </div>
  );
}
