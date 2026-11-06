import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import AskWellCircle from '../components/AskWellCircle';
import { renderWithProviders } from './renderWithProviders';
import { getToken } from '../api/client';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getToken: vi.fn() };
});

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

const SESSION_RESPONSE = {
  session_id: 'server-session-1',
  experience: 'first_visit',
  welcome: {
    text: "🌿 Welcome to Well Circle — I'm Circler, your personal wellness concierge.",
    cards: [
      {
        id: 'events',
        label: 'Wellness events this week',
        prompt: 'Wellness events this week',
        needs_location: false,
      },
    ],
  },
  history: [],
  profile_name: null,
  anonymous_token: null,
  memory_available: true,
};

const SAVED_PREFS = {
  budget_etb: 500,
  neighbourhood: 'Old Airport',
  interests: ['yoga', 'swimming'],
};

const PROFILE_WITH_PREFS = {
  display_name: 'Selam',
  preferences: SAVED_PREFS,
  consent_recorded: true,
};

function isSettingsUrl(url, path) {
  return String(url).includes(`/ai/concierge/${path}`);
}

function requestWith(options, method) {
  return !options || options.method === method;
}

beforeEach(() => {
  localStorage.clear();
  getToken.mockReturnValue(null);
  // jsdom window.confirm: tests opt in per case.
  window.confirm = vi.fn(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function openChatAndSettings() {
  renderWithProviders(<AskWellCircle />);
  fireEvent.click(document.querySelector('.fab-ask'));
  await screen.findByText(/I'm Circler/);
  fireEvent.click(document.getElementById('circler-settings-btn'));
  await screen.findByRole('dialog', { name: 'Circler settings' });
}

describe('AskWellCircle — settings panel opening/closing', () => {
  it('opens from the header gear and loads the saved profile', async () => {
    global.fetch = vi.fn((url) => {
      if (isSettingsUrl(url, 'session')) return Promise.resolve(response(SESSION_RESPONSE));
      if (isSettingsUrl(url, 'profile')) return Promise.resolve(response(PROFILE_WITH_PREFS));
      return Promise.resolve(response({}));
    });

    await openChatAndSettings();

    expect(await screen.findByText(/Circler can use saved preferences/)).toBeInTheDocument();
    expect(screen.getAllByText(/up to ETB 500/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Old Airport/).length).toBeGreaterThan(0);
  });

  it('closes with the close button without closing the chat', async () => {
    global.fetch = vi.fn((url) => {
      if (isSettingsUrl(url, 'session')) return Promise.resolve(response(SESSION_RESPONSE));
      if (isSettingsUrl(url, 'profile')) return Promise.resolve(response(PROFILE_WITH_PREFS));
      return Promise.resolve(response({}));
    });

    await openChatAndSettings();
    fireEvent.click(document.getElementById('circler-settings-close'));

    await waitFor(() => {
      expect(document.getElementById('circler-settings-panel')).toBeNull();
    });
    // The chat itself is still open.
    expect(screen.getByText(/CIRCLER/)).toBeInTheDocument();
  });
});

describe('AskWellCircle — loading saved preferences', () => {
  it('shows saved preferences and keeps the toggle On with consent', async () => {
    global.fetch = vi.fn((url) => {
      if (isSettingsUrl(url, 'session')) return Promise.resolve(response(SESSION_RESPONSE));
      if (isSettingsUrl(url, 'profile')) return Promise.resolve(response(PROFILE_WITH_PREFS));
      return Promise.resolve(response({}));
    });

    await openChatAndSettings();
    const toggle = document.getElementById('circler-personalization-toggle');
    expect(await waitFor(() => toggle.getAttribute('aria-checked'))).toBe('true');
    expect(screen.getAllByText(/Interests: yoga, swimming/).length).toBeGreaterThan(0);
  });

  it('reports a load failure instead of fake settings', async () => {
    global.fetch = vi.fn((url) => {
      if (isSettingsUrl(url, 'session')) return Promise.resolve(response(SESSION_RESPONSE));
      if (isSettingsUrl(url, 'profile')) return Promise.resolve(response({}, { ok: false, status: 503 }));
      return Promise.resolve(response({}));
    });

    await openChatAndSettings();

    expect(
      await screen.findByText(/couldn't load your settings/,
      ),
    ).toBeInTheDocument();
  });
});

describe('AskWellCircle — saving preference edits', () => {
  it('sends the whole merged preferences set on save and updates the summary', async () => {
    const profileCalls = [];
    global.fetch = vi.fn((url, options = {}) => {
      if (isSettingsUrl(url, 'session')) return Promise.resolve(response(SESSION_RESPONSE));
      if (isSettingsUrl(url, 'profile')) {
        if (requestWith(options, 'PATCH')) {
          profileCalls.push(JSON.parse(options.body));
          return Promise.resolve(
            response({
              display_name: 'Selam',
              preferences: { budget_etb: 800, neighbourhood: 'Kazanchis' },
              consent_recorded: true,
            }),
          );
        }
        return Promise.resolve(response(PROFILE_WITH_PREFS));
      }
      return Promise.resolve(response({}));
    });

    await openChatAndSettings();

    fireEvent.click(document.getElementById('circler-edit-preferences'));
    const neighbourhood = document.getElementById('circler-pref-neighbourhood');
    fireEvent.change(neighbourhood, { target: { value: 'Kazanchis' } });
    const budget = document.getElementById('circler-pref-budget');
    fireEvent.change(budget, { target: { value: '800' } });
    fireEvent.click(document.getElementById('circler-prefs-save'));

    await screen.findByText(/Preferences saved\./);
    // The full set must be sent (PATCH replaces it), with the drafts applied.
    expect(profileCalls[0]).toEqual({
      consent: true,
      preferences: {
        budget_etb: 800,
        neighbourhood: 'Kazanchis',
        interests: ['yoga', 'swimming'],
      },
    });
  });

  it('rejects a nonsensical budget without calling the backend', async () => {
    const patchCalls = vi.fn();
    global.fetch = vi.fn((url, options = {}) => {
      if (isSettingsUrl(url, 'session')) return Promise.resolve(response(SESSION_RESPONSE));
      if (isSettingsUrl(url, 'profile') && requestWith(options, 'PATCH')) {
        patchCalls();
        return Promise.resolve(response(PROFILE_WITH_PREFS));
      }
      if (isSettingsUrl(url, 'profile')) return Promise.resolve(response(PROFILE_WITH_PREFS));
      return Promise.resolve(response({}));
    });

    await openChatAndSettings();
    fireEvent.click(document.getElementById('circler-edit-preferences'));
    fireEvent.change(document.getElementById('circler-pref-budget'), { target: { value: '-5' } });
    fireEvent.click(document.getElementById('circler-prefs-save'));

    expect(await screen.findByText(/Budget must be a whole number/)).toBeInTheDocument();
    expect(patchCalls).not.toHaveBeenCalled();
  });
});

describe('AskWellCircle — disabling personalization', () => {
  it('toggling off asks for confirmation and calls the withdrawal endpoint', async () => {
    const deleteCalls = [];
    global.fetch = vi.fn((url, options = {}) => {
      if (isSettingsUrl(url, 'session')) return Promise.resolve(response(SESSION_RESPONSE));
      if (isSettingsUrl(url, 'personalization') && requestWith(options, 'DELETE')) {
        deleteCalls.push(url);
        return Promise.resolve(response({ display_name: 'Selam', preferences: {}, consent_recorded: false }));
      }
      if (isSettingsUrl(url, 'profile')) return Promise.resolve(response(PROFILE_WITH_PREFS));
      return Promise.resolve(response({}));
    });

    await openChatAndSettings();
    fireEvent.click(document.getElementById('circler-personalization-toggle'));

    expect(window.confirm).toHaveBeenCalled();
    await screen.findByText(/Personalization is off/);
    expect(deleteCalls).toHaveLength(1);
    const toggle = document.getElementById('circler-personalization-toggle');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('cancelling the confirmation changes nothing', async () => {
    window.confirm = vi.fn(() => false);
    global.fetch = vi.fn((url, _options = {}) => {
      if (isSettingsUrl(url, 'session')) return Promise.resolve(response(SESSION_RESPONSE));
      if (isSettingsUrl(url, 'profile')) return Promise.resolve(response(PROFILE_WITH_PREFS));
      if (isSettingsUrl(url, 'personalization')) return Promise.resolve(response({}));
      return Promise.resolve(response({}));
    });

    await openChatAndSettings();
    // Wait for the panel to finish loading before acting on it.
    await screen.findByText(/up to ETB 500/);
    fireEvent.click(document.getElementById('circler-personalization-toggle'));

    expect(window.confirm).toHaveBeenCalled();
    expect(document.getElementById('circler-personalization-toggle').getAttribute('aria-checked')).toBe('true');
    // No DELETE request may have been made to any settings endpoint.
    const deleteCalls = global.fetch.mock.calls.filter(([, options]) => options?.method === 'DELETE');
    expect(deleteCalls).toHaveLength(0);
  });

  it('a failed withdrawal keeps the toggle On and shows an error', async () => {
    global.fetch = vi.fn((url, _options = {}) => {
      if (isSettingsUrl(url, 'session')) return Promise.resolve(response(SESSION_RESPONSE));
      if (isSettingsUrl(url, 'personalization')) return Promise.resolve(response({}, { ok: false, status: 503 }));
      if (isSettingsUrl(url, 'profile')) return Promise.resolve(response(PROFILE_WITH_PREFS));
      return Promise.resolve(response({}));
    });

    await openChatAndSettings();
    fireEvent.click(document.getElementById('circler-personalization-toggle'));

    expect(
      await screen.findByText(/That change couldn't be saved/),
    ).toBeInTheDocument();
    expect(document.getElementById('circler-personalization-toggle').getAttribute('aria-checked')).toBe('true');
  });
});

describe('AskWellCircle — deleting saved preferences', () => {
  it('deletes with confirmation and reports that data is gone', async () => {
    let deleted = false;
    global.fetch = vi.fn((url, _options = {}) => {
      if (isSettingsUrl(url, 'session')) return Promise.resolve(response(SESSION_RESPONSE));
      if (isSettingsUrl(url, 'preferences')) {
        deleted = true;
        return Promise.resolve(response({ display_name: 'Selam', preferences: {}, consent_recorded: true }));
      }
      if (isSettingsUrl(url, 'profile')) {
        return Promise.resolve(response(deleted ? { ...PROFILE_WITH_PREFS, preferences: {} } : PROFILE_WITH_PREFS));
      }
      return Promise.resolve(response({}));
    });

    await openChatAndSettings();
    fireEvent.click(document.getElementById('circler-delete-preferences'));

    expect(window.confirm).toHaveBeenCalled();
    await screen.findByText(/Saved preferences were deleted\./);
    // Consent stays recorded after a plain delete — only the data is gone.
    expect(document.getElementById('circler-personalization-toggle').getAttribute('aria-checked')).toBe('true');
  });
});

describe('AskWellCircle — clearing conversation history', () => {
  it('clears the server-side conversation and keeps the profile', async () => {
    let historyCleared = false;
    global.fetch = vi.fn((url, _options = {}) => {
      if (String(url).includes('/ai/concierge/session')) {
        return Promise.resolve(
          response({
            ...SESSION_RESPONSE,
            session_id: historyCleared ? 'fresh-session-2' : SESSION_RESPONSE.session_id,
          }),
        );
      }
      if (String(url).includes('/ai/concierge/history')) {
        historyCleared = true;
        return Promise.resolve(response({ cleared: true, session_id: 'fresh-session-2' }));
      }
      if (isSettingsUrl(url, 'profile')) {
        // Whatever happens to history, the profile is untouched.
        return Promise.resolve(response(PROFILE_WITH_PREFS));
      }
      return Promise.resolve(response({}));
    });

    await openChatAndSettings();
    fireEvent.click(document.getElementById('circler-clear-history'));

    expect(window.confirm).toHaveBeenCalled();
    await screen.findByText(/Conversation cleared\. Your profile was not affected\./);
    expect(localStorage.getItem('concierge_session_id')).toBe('fresh-session-2');
  });

  it('does not fake a clear when the backend fails', async () => {
    global.fetch = vi.fn((url, _options = {}) => {
      if (String(url).includes('/ai/concierge/session')) {
        return Promise.resolve(response(SESSION_RESPONSE));
      }
      if (String(url).includes('/ai/concierge/history')) {
        return Promise.resolve(response({}, { ok: false, status: 503 }));
      }
      if (isSettingsUrl(url, 'profile')) return Promise.resolve(response(PROFILE_WITH_PREFS));
      return Promise.resolve(response({}));
    });

    await openChatAndSettings();
    fireEvent.click(document.getElementById('circler-clear-history'));

    expect(await screen.findByText(/That change couldn't be saved/)).toBeInTheDocument();
    expect(localStorage.getItem('concierge_session_id')).toBe(SESSION_RESPONSE.session_id);
  });
});
