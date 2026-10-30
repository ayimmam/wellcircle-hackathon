import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

import { getToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { track } from '../analytics';

// Server-owned fallback only. The live list and welcome copy come from
// GET /ai/concierge/session so all three clients stay in sync.
const FALLBACK_SUGGESTIONS = [
  { id: 'events', label: 'Wellness events this week', prompt: 'Wellness events this week', needs_location: false },
  { id: 'gyms', label: 'Affordable gyms around me', prompt: 'Affordable gyms around me', needs_location: true },
  { id: 'yoga', label: 'Yoga classes this week', prompt: 'Yoga classes this week', needs_location: false },
  { id: 'nutrition', label: 'Nutrition coaching options', prompt: 'Nutrition coaching options', needs_location: false },
];

// Production-default concierge endpoint. Overridable for local/testing
// environments via ?api=<url> on the page URL or VITE_CONCIERGE_URL at build
// time; anything absent or non-http(s) falls back to production. Evaluated on
// render so a per-test/per-page URL change takes effect on reload.
const DEFAULT_CONCIERGE_URL = 'https://well-circle-concierge.vercel.app/ai/concierge';
const readConciergeUrl = () => {
  const fromParam = new URLSearchParams(window.location.search).get('api');
  const fromEnv = import.meta.env.VITE_CONCIERGE_URL;
  const candidate = fromParam || fromEnv;
  if (candidate && /^https?:\/\//.test(candidate)) return candidate;
  return DEFAULT_CONCIERGE_URL;
};
const ANONYMOUS_HEADER = 'X-Circler-Anonymous-Token';

export default function AskWellCircle() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const conciergeUrl = readConciergeUrl();
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- Settings panel state (personalization + conversation) ---------------
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Server profile shape: { display_name, preferences, consent_recorded }.
  // Never assumed present until GET /ai/concierge/profile answers.
  const [profileState, setProfileState] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsStatus, setSettingsStatus] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [editingPrefs, setEditingPrefs] = useState(false);
  const [prefsDraft, setPrefsDraft] = useState({ neighbourhood: '', budget: '', interests: '' });

  // Persisted per-device session id so the backend can remember the last
  // few turns of this conversation across app opens/reloads.
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('concierge_session_id') || null;
  });
  const [anonymousToken, setAnonymousToken] = useState(() => {
    return localStorage.getItem('concierge_anonymous_token') || null;
  });

  // Conversation content is server-authoritative. Local storage no longer
  // invents a greeting or restores stale messages before the server answers.
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  // A failed conversation bootstrap (outage or stale deployed service),
  // surfaced as a one-click retry. Auth failures are excluded: resending the
  // same request cannot recover those.
  const [sessionLoadFailed, setSessionLoadFailed] = useState(false);
  const bootstrapRef = useRef(0);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (isOpen && tg?.BackButton) {
      tg.BackButton.show();
      tg.disableClosingConfirmation?.();
      const handler = () => setIsOpen(false);
      tg.onEvent('backButtonClicked', handler);
      return () => {
        tg.offEvent('backButtonClicked', handler);
        // Restore visibility logic for the underlying screen
        if (['/home', '/'].includes(window.location.pathname)) {
          tg.BackButton.hide();
          tg.enableClosingConfirmation?.();
        }
      };
    }
  }, [isOpen]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  /**
   * Opening the chat loads the server's welcome/history decision. This is a
   * GET, not a fake chat turn: opening the widget must never call the model or
   * append an unsolicited assistant message.
   */
  const loadConversation = async ({ sid = sessionId, anon = anonymousToken } = {}) => {
    const attempt = ++bootstrapRef.current;
    const userToken = getToken();

    const request = (requestSessionId, requestAnon, authToken) => {
      const headers = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      else if (requestAnon) headers[ANONYMOUS_HEADER] = requestAnon;
      const query = requestSessionId
        ? `?session_id=${encodeURIComponent(requestSessionId)}`
        : '';
      return fetch(`${conciergeUrl}/session${query}`, {
        headers,
        cache: 'no-store',
      });
    };

    try {
      let res = await request(sid, anon, userToken);

      if (res.status === 401 && !userToken && anon) {
        localStorage.removeItem('concierge_anonymous_token');
        localStorage.removeItem('concierge_session_id');
        setAnonymousToken(null);
        setSessionId(null);
        res = await request(null, null, null);
      } else if (res.status === 403) {
        localStorage.removeItem('concierge_session_id');
        setSessionId(null);
        res = await request(null, userToken ? null : anon, userToken);
      }

      if (!res.ok) {
        throw new Error(res.status === 401 ? 'AUTH_REQUIRED' : 'SESSION_LOAD_FAILED');
      }

      const data = await res.json();
      if (attempt !== bootstrapRef.current) return;
      setSessionLoadFailed(false);

      if (data.anonymous_token) {
        setAnonymousToken(data.anonymous_token);
        localStorage.setItem('concierge_anonymous_token', data.anonymous_token);
      }
      if (data.session_id) {
        setSessionId(data.session_id);
        localStorage.setItem('concierge_session_id', data.session_id);
      }

      if (Array.isArray(data.history) && data.history.length > 0) {
        setMessages(
          data.history.map((message, index) => ({
            id: `history-${index}`,
            text: message.content,
            sender: message.role === 'user' ? 'user' : 'assistant',
          })),
        );
        setSuggestions([]);
      } else if (data.welcome?.text) {
        setMessages([{ id: 'welcome', text: data.welcome.text, sender: 'assistant' }]);
        setSuggestions(
          Array.isArray(data.welcome.cards) && data.welcome.cards.length > 0
            ? data.welcome.cards
            : FALLBACK_SUGGESTIONS,
        );
      } else {
        // Returning conversation with no stored history yet, or a temporary
        // outage. Do not repeat a greeting in either case.
        setMessages([]);
        setSuggestions([]);
      }
    } catch (e) {
      if (attempt !== bootstrapRef.current) return;
      setSessionLoadFailed(e?.message !== 'AUTH_REQUIRED');
      setMessages([{
        id: 'session-error',
        text: e?.message === 'AUTH_REQUIRED'
          ? 'Your session has expired. Please sign in again.'
          : "I couldn't load your conversation. Please try again.",
        sender: 'assistant',
      }]);
      setSuggestions([]);
    }
  };

  useEffect(() => {
    if (isOpen) loadConversation();
    // loadConversation intentionally reads the current persisted credentials.
  }, [isOpen]);

  const handleSend = async (override) => {
    const raw = override ?? input;
    if (!raw.trim() || isLoading) return;

    const userMsg = raw.trim();
    bootstrapRef.current += 1;
    setInput('');
    setSuggestions([]);
    setMessages(prev => [...prev, { id: Date.now(), text: userMsg, sender: 'user' }]);
    setIsLoading(true);

    try {
      const userToken = getToken();
      const postConcierge = async (sid, anonToken, authToken) => {
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        } else if (anonToken) {
          headers[ANONYMOUS_HEADER] = anonToken;
        }
        const payload = { message: userMsg };
        if (sid) payload.session_id = sid;
        return fetch(conciergeUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      };

      let res = await postConcierge(sessionId, anonymousToken, userToken);

      if (res.status === 401 && !userToken && anonymousToken) {
        // Expired/tampered anonymous credential: drop it and obtain a new
        // anonymous identity. Never do this for an invalid user token.
        localStorage.removeItem('concierge_anonymous_token');
        localStorage.removeItem('concierge_session_id');
        setAnonymousToken(null);
        setSessionId(null);
        res = await postConcierge(null, null, null);
      } else if (res.status === 403) {
        // The stored session id belongs to an earlier identity or a
        // pre-ownership row. Start a fresh conversation, never reuse it.
        localStorage.removeItem('concierge_session_id');
        setSessionId(null);
        res = await postConcierge(
          null,
          userToken ? null : anonymousToken,
          userToken,
        );
      }

      if (!res.ok) {
        if (res.status === 401) throw new Error('AUTH_REQUIRED');
        throw new Error('CONCIERGE_REQUEST_FAILED');
      }

      let data = await res.json();

      // Persist the anonymous credential and the server-issued session id so
      // later turns stay bound to the same identity.
      if (data.anonymous_token) {
        setAnonymousToken(data.anonymous_token);
        localStorage.setItem('concierge_anonymous_token', data.anonymous_token);
      }
      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
        localStorage.setItem('concierge_session_id', data.session_id);
      }

      // The server is the only source of truth for the reply, provider/event
      // ids, and the fallback data source. Do not swap in an unrelated live
      // provider here: that would break the server-side grounding guarantee.
      // The server returns exactly one reply bubble per successful turn.
      if (data.reply && data.reply.trim().length > 0) {
        setMessages(prev => [...prev, {
          id: Date.now() + 2,
          text: data.reply,
          sender: 'assistant',
          provider: data.provider_name ? { id: data.provider_id, name: data.provider_name, data_source: data.data_source } : null,
          event: data.event_name ? { id: data.event_id, name: data.event_name, providerId: data.event_provider_id, data_source: data.data_source } : null
        }]);
      }
    } catch (e) {
      const text = e?.message === 'AUTH_REQUIRED'
        ? 'Your session has expired. Please sign in again.'
        : "Sorry, I'm having trouble connecting right now.";
      setMessages(prev => [...prev, { id: Date.now() + 2, text, sender: 'assistant' }]);
    }
    
    setIsLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleChipTap = (chip) => {
    const prompt = chip.prompt || chip.label;
    track('concierge_chip_click', { chip: chip.label });
    if (chip.needs_location) {
      const area = user?.location_neighborhood;
      if (area) {
        handleSend(prompt.replace(/\bme\b/i, area));
      } else {
        setInput(prompt.replace(/\bme\b/i, ''));
        inputRef.current?.focus();
      }
      return;
    }
    handleSend(prompt);
  };

  // --- Settings panel logic -------------------------------------------------
  // All settings requests re-resolve the credential on every call: the same
  // Authorization / X-Circler-Anonymous-Token rules as the chat requests, and
  // the backend derives ownership from it — no client-supplied owner id.
  const settingsFetch = (path, options = {}) => {
    const userToken = getToken();
    const headers = { ...options.headers };
    if (userToken) {
      headers.Authorization = `Bearer ${userToken}`;
    } else if (anonymousToken) {
      headers[ANONYMOUS_HEADER] = anonymousToken;
    }
    return fetch(`${conciergeUrl}${path}`, { cache: 'no-store', ...options, headers });
  };

  const authErrorMessage = (error, fallback) => (
    error?.message === 'AUTH_REQUIRED'
      ? 'Your session has expired. Reopen the chat to continue.'
      : fallback
  );

  const applyProfileState = (data) => {
    setProfileState({
      display_name: data?.display_name ?? null,
      preferences: data?.preferences && typeof data.preferences === 'object' ? data.preferences : {},
      consent_recorded: !!data?.consent_recorded,
    });
  };

  // Runs one settings mutation. UI only updates after a confirmed backend
  // success — a failed request is reported and changes nothing.
  const runSettingsAction = async (action, request) => {
    setBusyAction(action);
    setSettingsError('');
    setSettingsStatus('');
    try {
      const res = await request();
      if (!res.ok) {
        throw new Error(res.status === 401 ? 'AUTH_REQUIRED' : 'SETTINGS_REQUEST_FAILED');
      }
      const data = await res.json();
      track('circler_settings_action', { action });
      return data;
    } catch (e) {
      setSettingsError(authErrorMessage(e, "That change couldn't be saved. Please try again."));
      return null;
    } finally {
      setBusyAction('');
    }
  };

  const loadProfile = async () => {
    setSettingsLoading(true);
    setSettingsError('');
    setSettingsStatus('');
    setEditingPrefs(false);
    try {
      const res = await settingsFetch('/profile');
      if (!res.ok) {
        throw new Error(res.status === 401 ? 'AUTH_REQUIRED' : 'SETTINGS_REQUEST_FAILED');
      }
      const data = await res.json();
      if (!isOpen) return;
      applyProfileState(data);
      track('circler_settings_action', { action: 'load' });
    } catch (e) {
      setProfileState(null);
      setEditingPrefs(false);
      setSettingsError(authErrorMessage(
        e,
        "Circler couldn't load your settings. Please try again.",
      ));
    } finally {
      setSettingsLoading(false);
    }
  };

  const openSettings = () => {
    setSettingsOpen(true);
    setSettingsStatus('');
    setSettingsError('');
    loadProfile();
  };

  const handleTogglePersonalization = async () => {
    if (busyAction || settingsLoading) return;
    if (profileState?.consent_recorded) {
      // Disabling withdraws consent AND deletes saved preferences on the
      // server. Say so plainly before doing it.
      if (!window.confirm(
        'Turning off personalization deletes your saved preferences. '
        + 'Your profile name is kept. Continue?',
      )) return;
      const data = await runSettingsAction('personalization-off', () =>
        settingsFetch('/personalization', { method: 'DELETE' }));
      if (data) {
        applyProfileState(data);
        setEditingPrefs(false);
        setSettingsStatus('Personalization is off. Saved preferences were deleted.');
      }
    } else {
      const data = await runSettingsAction('personalization-on', () =>
        settingsFetch('/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consent: true,
            preferences: profileState?.preferences ?? {},
          }),
        }));
      if (data) {
        applyProfileState(data);
        setSettingsStatus('Personalization is on. Add preferences below so Circler can use them.');
      }
    }
  };

  const startEditingPreferences = () => {
    const preferences = profileState?.preferences ?? {};
    setPrefsDraft({
      neighbourhood: typeof preferences.neighbourhood === 'string' ? preferences.neighbourhood : '',
      budget: preferences.budget_etb != null ? String(preferences.budget_etb) : '',
      interests: Array.isArray(preferences.interests) ? preferences.interests.join(', ') : '',
    });
    setEditingPrefs(true);
    setSettingsStatus('');
    setSettingsError('');
  };

  const cancelEditingPreferences = () => {
    if (busyAction === 'save') return;
    setEditingPrefs(false);
    setSettingsError('');
  };

  const handleSavePreferences = async () => {
    if (busyAction || !profileState?.consent_recorded) return;
    const neighbourhood = prefsDraft.neighbourhood.trim();
    const budgetText = prefsDraft.budget.trim();
    const interests = prefsDraft.interests
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    let budget = null;
    if (budgetText) {
      budget = Number(budgetText);
      if (!Number.isInteger(budget) || budget < 0 || budget > 100000000) {
        setSettingsError('Budget must be a whole number of ETB between 0 and 100000000.');
        return;
      }
    }

    // The profile PATCH replaces the whole saved set, so send the complete
    // merged object — never a partial draft that would silently drop the
    // other saved fields.
    const next = { ...(profileState.preferences ?? {}) };
    delete next.neighbourhood;
    delete next.budget_etb;
    delete next.interests;
    if (neighbourhood) next.neighbourhood = neighbourhood;
    if (budget != null) next.budget_etb = budget;
    if (interests.length > 0) next.interests = interests;

    const data = await runSettingsAction('save', () =>
      settingsFetch('/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: true, preferences: next }),
      }));
    if (data) {
      applyProfileState(data);
      setEditingPrefs(false);
      setSettingsStatus('Preferences saved.');
    }
  };

  const handleDeletePreferences = async () => {
    if (busyAction || !profileState?.consent_recorded) return;
    if (!window.confirm('Delete your saved preferences? Circler will no longer use them.')) return;
    const data = await runSettingsAction('delete-preferences', () =>
      settingsFetch('/preferences', { method: 'DELETE' }));
    if (data) {
      applyProfileState(data);
      setEditingPrefs(false);
      setSettingsStatus('Saved preferences were deleted.');
    }
  };

  const handleClearHistory = async () => {
    if (busyAction || settingsLoading) return;
    if (!sessionId) {
      setSettingsStatus('The conversation is already clear.');
      return;
    }
    if (!window.confirm(
      'Clear the current conversation? Your profile name and saved preferences are not affected.',
    )) return;

    const data = await runSettingsAction('clear-history', () =>
      settingsFetch(`/history?session_id=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      }));
    if (data) {
      // The next conversation uses the fresh server-issued id; the anonymous
      // credential (and therefore the profile) is intentionally kept.
      setSessionId(data.session_id);
      localStorage.setItem('concierge_session_id', data.session_id);
      setSettingsStatus('Conversation cleared. Your profile was not affected.');
      loadConversation({ sid: data.session_id, anon: anonymousToken });
    }
  };

  const savedPreferenceParts = (() => {
    const preferences = profileState?.preferences ?? {};
    const parts = [];
    if (preferences.budget_etb != null) parts.push(`Budget: up to ETB ${preferences.budget_etb}`);
    if (preferences.neighbourhood) parts.push(`Area: ${preferences.neighbourhood}`);
    if (Array.isArray(preferences.interests) && preferences.interests.length > 0) {
      parts.push(`Interests: ${preferences.interests.join(', ')}`);
    }
    if (preferences.notes) parts.push(`Notes: ${preferences.notes}`);
    return parts;
  })();

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setSettingsOpen(false);
            setIsOpen(true);
          }}
          style={{
            position: 'fixed',
            bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 20px)',
            right: 'calc(50% - 215px + 20px)', // max-width 430px adjustment
            background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
            color: 'var(--text-on-accent)',
            border: 'none',
            borderRadius: '50%',
            width: '56px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-lg), 0 0 15px var(--accent-glow)',
            cursor: 'pointer',
            zIndex: 100
          }}
          className="fab-ask"
        >
          <Icon name="message-circle" size={24} />
        </button>
      )}
      
      <style>{`
        @media (max-width: 430px) {
          .fab-ask {
            right: 20px !important;
          }
        }
      `}</style>

      {/* Chat Modal */}
      {isOpen && (
        <>
          <div className="burger-overlay" onClick={() => setIsOpen(false)} style={{ zIndex: 200 }} />
          <div style={{
            position: 'fixed',
            inset: 0,
            maxWidth: '430px',
            margin: '0 auto',
            backgroundColor: 'var(--bg-primary)',
            zIndex: 201,
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px',
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 'calc(var(--tg-content-safe-area-inset-top, 0px) + var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + 16px)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="burger-logo" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="message-circle" size={18} />
                </div>
                <div>
                  <div className="burger-brand-name">CIRCLER</div>
                  <div className="burger-brand-sub">POWERED BY WELL CIRCLE</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="burger-close"
                  id="circler-settings-btn"
                  style={{
                    width: '36px',
                    height: '36px',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                  }}
                  onClick={openSettings}
                  aria-label="Circler settings"
                  aria-haspopup="dialog"
                  title="Circler settings"
                >
                  <Icon name="settings" size={18} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              paddingBottom: '20px'
            }}>
              {messages
                .filter(msg => msg.text && msg.text.trim().length > 0)
                .map((msg) => (
                <div key={msg.id} style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: msg.sender === 'user' 
                      ? 'var(--radius-xl) var(--radius-xl) var(--radius-sm) var(--radius-xl)' 
                      : 'var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-sm)',
                    background: msg.sender === 'user' 
                      ? 'linear-gradient(135deg, var(--accent), var(--accent-dark))' 
                      : 'var(--bg-card)',
                    color: msg.sender === 'user' ? 'var(--text-on-accent)' : 'var(--text-primary)',
                    border: msg.sender === 'user' ? 'none' : '1px solid var(--border-card)',
                    boxShadow: 'var(--shadow-sm)',
                    fontSize: '0.95rem',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.text}
                  </div>
                  
                  {msg.provider && (
                    <div style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                      <button
                        className="chip"
                        onClick={() => {
                          setIsOpen(false);
                          if (msg.provider.id && msg.provider.data_source === 'live') {
                            navigate(`/provider/${msg.provider.id}`);
                          } else {
                            navigate('/explore', { state: { search: msg.provider.name } });
                          }
                        }}
                        style={{ fontSize: '0.8rem', padding: '6px 12px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Icon name="map-pin" size={13} /> {msg.provider.name}
                      </button>
                    </div>
                  )}
                  {msg.event && (
                    <div style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
                      <button
                        className="chip"
                        onClick={() => {
                          setIsOpen(false);
                          if (
                            msg.event.id
                            && msg.event.providerId
                            && msg.event.data_source === 'live'
                          ) {
                            navigate(
                              `/booking/${msg.event.providerId}?event_id=${msg.event.id}`,
                              {
                                state: {
                                  eventId: msg.event.id,
                                  eventServiceName: msg.event.name,
                                },
                              },
                            );
                          } else {
                            // Fallback ids are not real provider rows.
                            navigate('/events');
                          }
                        }}
                        style={{ fontSize: '0.8rem', padding: '6px 12px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Icon name="calendar" size={13} /> {msg.event.name}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div style={{ alignSelf: 'flex-start', background: 'var(--bg-card)', border: '1px solid var(--border-card)', padding: '12px 16px', borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-sm)' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', background: 'var(--text-tertiary)', borderRadius: '50%', animation: 'typingPulse 1s infinite' }} />
                    <div style={{ width: '8px', height: '8px', background: 'var(--text-tertiary)', borderRadius: '50%', animation: 'typingPulse 1s infinite 0.2s' }} />
                    <div style={{ width: '8px', height: '8px', background: 'var(--text-tertiary)', borderRadius: '50%', animation: 'typingPulse 1s infinite 0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

              {sessionLoadFailed && (
                <div style={{ display: 'flex', marginBottom: '12px' }}>
                  <button
                    type="button"
                    className="chip"
                    id="concierge-retry-load"
                    onClick={() => loadConversation()}
                  >
                    {t('Try again')}
                  </button>
                </div>
              )}

            {/* Input Area */}
            <div style={{
              padding: '12px 16px',
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(20px)',
              borderTop: '1px solid var(--border-subtle)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)'
            }}>
              {suggestions.length > 0 && (
                <div
                  id="concierge-chips"
                  style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}
                >
                  {suggestions.map(chip => (
                    <button
                      key={chip.id || chip.label}
                      className="chip"
                      onClick={() => handleChipTap(chip)}
                      id={`concierge-chip-${(chip.id || chip.label).replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      {t(chip.label)}
                    </button>
                  ))}
                </div>
              )}
              <div style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center'
              }}>
                <input
                  ref={inputRef}
                  className="input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about wellness services..."
                  style={{ flex: 1, borderRadius: 'var(--radius-full)', padding: '12px 20px' }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  style={{
                    width: '46px',
                    height: '46px',
                    padding: 0,
                    borderRadius: '50%',
                    flexShrink: 0
                  }}
                >
                  <Icon name="send" size={18} />
                </button>
              </div>
            </div>

            {/* Circler settings — personalization + conversation controls. */}
            {settingsOpen && (
              <div
                id="circler-settings-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Circler settings"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--bg-primary)',
                  zIndex: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                <div style={{
                  padding: '16px',
                  background: 'var(--bg-glass)',
                  backdropFilter: 'blur(20px)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 'calc(var(--tg-content-safe-area-inset-top, 0px) + var(--tg-safe-area-inset-top, env(safe-area-inset-top, 0px)) + 16px)'
                }}>
                  <div className="burger-brand-name">CIRCLER SETTINGS</div>
                  <button
                    type="button"
                    className="burger-close"
                    id="circler-settings-close"
                    style={{
                      width: '36px',
                      height: '36px',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-secondary)'
                    }}
                    onClick={() => setSettingsOpen(false)}
                    aria-label="Close settings"
                  >
                    <Icon name="x" size={18} />
                  </button>
                </div>

                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px',
                  display: 'grid',
                  gap: '20px',
                  alignContent: 'start'
                }}>
                  {settingsLoading && (
                    <p id="circler-settings-loading" role="status" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Loading your settings…
                    </p>
                  )}

                  {!settingsLoading && settingsError && (
                    <div id="circler-settings-error" role="alert" style={{ display: 'grid', gap: '10px' }}>
                      <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', margin: 0 }}>{settingsError}</p>
                      <button type="button" className="chip" onClick={loadProfile} id="circler-settings-retry">
                        Try again
                      </button>
                    </div>
                  )}

                  {busyAction && !settingsError && (
                    <p id="circler-settings-busy" role="status" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                      Saving your changes…
                    </p>
                  )}

                  {settingsStatus && (
                    <p id="circler-settings-status" role="status" style={{ color: 'var(--text-primary)', fontSize: '0.85rem', margin: 0 }}>
                      {settingsStatus}
                    </p>
                  )}

                  {!settingsLoading && profileState && (
                    <>
                      <section aria-label="Personalization">
                        <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>
                          {t('Personalization')}
                        </h4>
                        <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                          {t('Circler can use saved preferences — like budget or neighbourhood — to personalize recommendations. Turning it off deletes them; your name is kept.')}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '0.9rem' }}>{t('Circler personalization')}</span>
                          <button
                            type="button"
                            role="switch"
                            id="circler-personalization-toggle"
                            aria-checked={profileState.consent_recorded}
                            className="chip"
                            onClick={handleTogglePersonalization}
                            disabled={!!busyAction || settingsLoading}
                            style={{ minWidth: '56px' }}
                          >
                            {profileState.consent_recorded ? t('On') : t('Off')}
                          </button>
                        </div>

                        {profileState.consent_recorded && (
                          <div id="circler-saved-prefs" style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
                            <p id="circler-saved-prefs-summary" style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                              {savedPreferenceParts.length === 0
                                ? t('No preferences saved yet.')
                                : savedPreferenceParts.join(' · ')}
                            </p>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {!editingPrefs && (
                                <button
                                  type="button"
                                  className="chip"
                                  id="circler-edit-preferences"
                                  onClick={startEditingPreferences}
                                  disabled={!!busyAction}
                                >
                                  {savedPreferenceParts.length === 0 ? t('Add preferences') : t('Edit preferences')}
                                </button>
                              )}
                              <button
                                type="button"
                                className="chip"
                                id="circler-delete-preferences"
                                onClick={handleDeletePreferences}
                                disabled={!!busyAction}
                              >
                                {t('Delete saved preferences')}
                              </button>
                            </div>

                            {editingPrefs && (
                              <div
                                id="circler-prefs-editor"
                                style={{
                                  display: 'grid',
                                  gap: '10px',
                                  padding: '12px',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: '14px',
                                  background: 'var(--bg-card)'
                                }}
                              >
                                <label style={{ display: 'grid', gap: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  {t('Neighbourhood')}
                                  <input
                                    className="input"
                                    id="circler-pref-neighbourhood"
                                    value={prefsDraft.neighbourhood}
                                    maxLength={100}
                                    onChange={(e) => setPrefsDraft((d) => ({ ...d, neighbourhood: e.target.value }))}
                                  />
                                </label>
                                <label style={{ display: 'grid', gap: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  {t('Budget per visit (ETB)')}
                                  <input
                                    className="input"
                                    id="circler-pref-budget"
                                    type="number"
                                    min="0"
                                    inputMode="numeric"
                                    value={prefsDraft.budget}
                                    onChange={(e) => setPrefsDraft((d) => ({ ...d, budget: e.target.value }))}
                                  />
                                </label>
                                <label style={{ display: 'grid', gap: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  {t('Interests (comma-separated)')}
                                  <input
                                    className="input"
                                    id="circler-pref-interests"
                                    value={prefsDraft.interests}
                                    maxLength={400}
                                    onChange={(e) => setPrefsDraft((d) => ({ ...d, interests: e.target.value }))}
                                  />
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    id="circler-prefs-save"
                                    onClick={handleSavePreferences}
                                    disabled={!!busyAction}
                                    style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                                  >
                                    {busyAction === 'save' ? t('Saving…') : t('Save preferences')}
                                  </button>
                                  <button
                                    type="button"
                                    className="chip"
                                    onClick={cancelEditingPreferences}
                                    disabled={!!busyAction}
                                  >
                                    {t('Cancel')}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </section>

                      <section aria-label="Conversation">
                        <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>{t('Conversation')}</h4>
                        <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                          {t('The current conversation is kept for up to 24 hours of inactivity. Clearing it starts a fresh chat — your profile name and saved preferences are not affected.')}
                        </p>
                        <button
                          type="button"
                          className="chip"
                          id="circler-clear-history"
                          onClick={handleClearHistory}
                          disabled={!!busyAction || settingsLoading}
                        >
                          {busyAction === 'clear-history' ? t('Clearing…') : t('Clear conversation history')}
                        </button>
                      </section>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
      <style>{`
        @keyframes typingPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </>
  );
}
