import { useCallback, useEffect, useRef, useState } from 'react';
import { getMyIdentities } from '../api/client';
import { providerIcon, providerLabel } from '../utils/identityProviders';
import Icon from './Icon';

/**
 * Read-only list of the verified sign-in methods attached to the current
 * account. Used in both surfaces: the Telegram Mini App always renders it
 * read-only, the website adds a "Manage" entry point to the full linking
 * screen. It deliberately never receives or displays provider credentials.
 */
export default function ConnectedSignins({ onManage }) {
  const [status, setStatus] = useState('loading');
  const [identities, setIdentities] = useState([]);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await getMyIdentities();
      if (!mounted.current) return;
      setIdentities(Array.isArray(data?.identities) ? data.identities : []);
      setStatus('ready');
    } catch {
      if (!mounted.current) return;
      setIdentities([]);
      setStatus('error');
    }
  }, []);

  const retry = useCallback(() => {
    setStatus('loading');
    load();
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    // Defer the first read so the section paints its loading state before the
    // request resolves (and so the effect never sets state synchronously).
    const timer = setTimeout(load, 0);
    return () => { mounted.current = false; clearTimeout(timer); };
  }, [load]);

  return (
    <div className="profile-section" id="connected-signins-section">
      <div className="profile-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Sign-in methods</span>
        {onManage && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onManage} id="manage-signins-btn">
            Manage
          </button>
        )}
      </div>
      <div className="profile-card" aria-busy={status === 'loading'}>
        {status === 'loading' && (
          <p className="text-sm text-secondary" role="status">Loading sign-in methods…</p>
        )}

        {status === 'error' && (
          <div>
            <p className="text-sm" role="alert" style={{ color: 'var(--danger)' }}>
              Could not load your sign-in methods.
            </p>
            <button type="button" className="btn btn-secondary btn-sm mt-8" onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && identities.length === 0 && (
          <p className="text-sm text-secondary">No sign-in methods connected yet.</p>
        )}

        {status === 'ready' && identities.length > 0 && (
          <div className="flex-col gap-8" aria-label="Connected sign-in methods">
            {identities.map((identity, index) => (
              <div
                key={`${identity.provider}:${index}`}
                className="flex items-center gap-8"
                style={{ justifyContent: 'space-between' }}
              >
                <span className="inline-icon-text" style={{ fontSize: '0.9rem' }}>
                  <Icon name={providerIcon(identity.provider)} size={16} />
                  {providerLabel(identity.provider)}
                </span>
                <span className="text-sm text-secondary" style={{ textAlign: 'right' }}>
                  {identity.email || 'Connected'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
