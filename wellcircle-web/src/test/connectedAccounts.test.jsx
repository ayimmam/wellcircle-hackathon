import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConnectedAccounts from '@shared/pages/ConnectedAccounts';
import {
  getMyIdentities,
  startIdentityLink,
  verifyIdentityLink,
  confirmIdentityLink,
} from '@shared/api/client';
import { registerLinkingProviders, clearLinkingProviders } from '@shared/utils/linkingProviders';

vi.mock('@shared/api/client', async importOriginal => ({
  ...await importOriginal(),
  getMyIdentities: vi.fn(),
  startIdentityLink: vi.fn(),
  verifyIdentityLink: vi.fn(),
  confirmIdentityLink: vi.fn(),
}));

const googleSignIn = vi.fn();
const telegramPrepare = vi.fn();
const telegramSignIn = vi.fn();

const GOOGLE_IDENTITY = { provider: 'google', subject: 'google-subject-abc123', email: 'member@example.com' };
const TELEGRAM_IDENTITY = { provider: 'telegram', subject: 'telegram-subject-998877', email: null };
const TELEGRAM_WIDGET = { id: 99887766, first_name: 'Member', auth_date: 1700000000, hash: 'telegram-secret-hash' };
const ID_TOKEN = 'google-secret-id-token';

function mount() {
  return render(<MemoryRouter><ConnectedAccounts /></MemoryRouter>);
}

async function waitReady() {
  await screen.findByRole('heading', { name: 'Connected sign-ins' });
  await waitFor(() => expect(screen.getByRole('button', { name: /Connect Google/ })).toBeEnabled());
  await waitFor(() => expect(screen.getByRole('button', { name: /Connect Telegram/ })).toBeEnabled());
}

beforeEach(() => {
  googleSignIn.mockReset().mockResolvedValue(ID_TOKEN);
  telegramPrepare.mockReset().mockResolvedValue({});
  telegramSignIn.mockReset().mockResolvedValue(TELEGRAM_WIDGET);
  registerLinkingProviders({
    google: { configured: true, signIn: googleSignIn },
    telegram: { prepare: telegramPrepare, signIn: telegramSignIn },
  });
  getMyIdentities.mockReset().mockResolvedValue({ identities: [TELEGRAM_IDENTITY] });
  startIdentityLink.mockReset().mockResolvedValue({
    challenge_id: 'challenge-1', provider: 'google', expires_in: 300, expires_at: 1,
  });
  verifyIdentityLink.mockReset().mockResolvedValue({
    challenge_id: 'challenge-1', provider: 'google', subject: GOOGLE_IDENTITY.subject,
    email: GOOGLE_IDENTITY.email, expires_in: 300, requires_confirmation: true,
  });
  confirmIdentityLink.mockReset().mockResolvedValue({
    linked: true, already_linked: false, provider: 'google', subject: GOOGLE_IDENTITY.subject,
    user_id: 'user-1', identities: [TELEGRAM_IDENTITY, GOOGLE_IDENTITY],
  });
});

afterEach(() => {
  clearLinkingProviders();
});

it('loads and displays connected methods without exposing provider subjects', async () => {
  getMyIdentities.mockResolvedValue({ identities: [TELEGRAM_IDENTITY, GOOGLE_IDENTITY] });
  mount();
  await waitReady();

  const list = await screen.findByLabelText('Connected sign-in methods');
  expect(within(list).getByText('Google')).toBeInTheDocument();
  expect(within(list).getByText('Telegram')).toBeInTheDocument();
  expect(within(list).getByText('member@example.com')).toBeInTheDocument();
  expect(within(list).getAllByText('Connected', { selector: 'span.status-badge' })).toHaveLength(2);

  expect(screen.queryByText(GOOGLE_IDENTITY.subject)).not.toBeInTheDocument();
  expect(screen.queryByText(TELEGRAM_IDENTITY.subject)).not.toBeInTheDocument();
});

it('links Google only after explicit confirmation, then refreshes the list', async () => {
  getMyIdentities
    .mockResolvedValueOnce({ identities: [TELEGRAM_IDENTITY] })
    .mockResolvedValueOnce({ identities: [TELEGRAM_IDENTITY, GOOGLE_IDENTITY] });
  mount();
  await waitReady();

  fireEvent.click(screen.getByRole('button', { name: /Connect Google/ }));

  const confirmation = await screen.findByRole('heading', { name: 'Confirm connection' });
  expect(confirmation).toBeInTheDocument();
  expect(screen.getByText('member@example.com')).toBeInTheDocument();
  expect(startIdentityLink).toHaveBeenCalledWith('google');
  expect(googleSignIn).toHaveBeenCalledTimes(1);
  expect(verifyIdentityLink).toHaveBeenCalledWith('challenge-1', { google_id_token: ID_TOKEN });
  expect(confirmIdentityLink).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Confirm connection' }));

  await waitFor(() => expect(confirmIdentityLink).toHaveBeenCalledWith('challenge-1'));
  await waitFor(() => expect(getMyIdentities).toHaveBeenCalledTimes(2));
  expect(await screen.findByText(/Google connected/i)).toBeInTheDocument();
  const list = screen.getByLabelText('Connected sign-in methods');
  expect(within(list).getByText('member@example.com')).toBeInTheDocument();
});

it('links Telegram only after explicit confirmation, sending the widget proof once', async () => {
  startIdentityLink.mockResolvedValue({ challenge_id: 'tg-challenge', provider: 'telegram' });
  verifyIdentityLink.mockResolvedValue({
    challenge_id: 'tg-challenge', provider: 'telegram', subject: 'telegram-subject-new',
    email: null, expires_in: 300, requires_confirmation: true,
  });
  getMyIdentities
    .mockResolvedValueOnce({ identities: [] })
    .mockResolvedValueOnce({ identities: [TELEGRAM_IDENTITY] });
  mount();
  await waitReady();

  fireEvent.click(screen.getByRole('button', { name: /Connect Telegram/ }));

  await screen.findByRole('heading', { name: 'Confirm connection' });
  expect(telegramSignIn).toHaveBeenCalledTimes(1);
  expect(verifyIdentityLink).toHaveBeenCalledWith('tg-challenge', { telegram_login: TELEGRAM_WIDGET });
  expect(confirmIdentityLink).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Confirm connection' }));
  await waitFor(() => expect(confirmIdentityLink).toHaveBeenCalledWith('tg-challenge'));
  await waitFor(() => expect(getMyIdentities).toHaveBeenCalledTimes(2));
  expect(await screen.findByText(/Telegram connected/i)).toBeInTheDocument();
});

it('cancelling the confirmation does not link or refresh anything', async () => {
  mount();
  await waitReady();

  fireEvent.click(screen.getByRole('button', { name: /Connect Google/ }));
  await screen.findByRole('heading', { name: 'Confirm connection' });
  expect(confirmIdentityLink).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(screen.queryByRole('heading', { name: 'Confirm connection' })).not.toBeInTheDocument();
  expect(confirmIdentityLink).not.toHaveBeenCalled();
  expect(getMyIdentities).toHaveBeenCalledTimes(1);
});

it('prevents duplicate submissions while a connection is in progress', async () => {
  let release;
  startIdentityLink.mockReturnValue(new Promise(resolve => { release = resolve; }));
  mount();
  await waitReady();

  const button = screen.getByRole('button', { name: /Connect Google/ });
  fireEvent.click(button);
  await waitFor(() => expect(startIdentityLink).toHaveBeenCalledTimes(1));
  expect(button).toBeDisabled();

  fireEvent.click(button);
  expect(startIdentityLink).toHaveBeenCalledTimes(1);

  release({ challenge_id: 'challenge-late', provider: 'google' });
  await waitFor(() => expect(googleSignIn).toHaveBeenCalledTimes(1));
});

it('offers a restart after the challenge expires', async () => {
  verifyIdentityLink.mockRejectedValue(Object.assign(new Error('expired'), { status: 400 }));
  mount();
  await waitReady();

  fireEvent.click(screen.getByRole('button', { name: /Connect Google/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/expired/i);
  expect(screen.queryByRole('heading', { name: 'Confirm connection' })).not.toBeInTheDocument();
  expect(confirmIdentityLink).not.toHaveBeenCalled();

  await waitFor(() => expect(screen.getByRole('button', { name: /Connect Google/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: /Connect Google/ }));
  await waitFor(() => expect(startIdentityLink).toHaveBeenCalledTimes(2));
});

it('shows an empty state when no methods are connected', async () => {
  getMyIdentities.mockResolvedValue({ identities: [] });
  mount();
  await waitReady();
  expect(await screen.findByText('No sign-in methods connected yet.')).toBeInTheDocument();
});

it('shows an ownership conflict when the provider belongs to another account', async () => {
  verifyIdentityLink.mockRejectedValue(Object.assign(new Error('conflict'), { status: 409 }));
  mount();
  await waitReady();

  fireEvent.click(screen.getByRole('button', { name: /Connect Google/ }));

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/another Well Circle account/i);
  expect(confirmIdentityLink).not.toHaveBeenCalled();
});

it('explains when a challenge is unavailable on 404 and allows a restart', async () => {
  verifyIdentityLink.mockRejectedValue(Object.assign(new Error('missing'), { status: 404 }));
  mount();
  await waitReady();

  fireEvent.click(screen.getByRole('button', { name: /Connect Google/ }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/no longer available/i);
  await waitFor(() => expect(screen.getByRole('button', { name: /Connect Google/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: /Connect Google/ }));
  await waitFor(() => expect(startIdentityLink).toHaveBeenCalledTimes(2));
});

it('asks the user to sign in again on 401', async () => {
  getMyIdentities.mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }));
  mount();

  expect(await screen.findByRole('alert')).toHaveTextContent(/sign in again/i);
});

it('respects Retry-After on 429 and keeps connect disabled during the cooldown', async () => {
  startIdentityLink.mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429, retryAfter: 30 }));
  mount();
  await waitReady();

  fireEvent.click(screen.getByRole('button', { name: /Connect Google/ }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/try again in 30s/i);
  expect(screen.getByRole('button', { name: /Connect Google/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Connect Telegram/ })).toBeDisabled();
});

it('explains a temporary provider verification outage on 503', async () => {
  verifyIdentityLink.mockRejectedValue(Object.assign(new Error('unavailable'), { status: 503 }));
  mount();
  await waitReady();

  fireEvent.click(screen.getByRole('button', { name: /Connect Google/ }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/temporarily unavailable/i);
});

it('never renders or logs raw provider credentials', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  mount();
  await waitReady();

  fireEvent.click(screen.getByRole('button', { name: /Connect Google/ }));
  await screen.findByRole('heading', { name: 'Confirm connection' });

  const pageText = document.body.textContent;
  expect(pageText).not.toContain(ID_TOKEN);
  expect(pageText).not.toContain(GOOGLE_IDENTITY.subject);
  expect(pageText).not.toContain(TELEGRAM_WIDGET.hash);
  expect(log).not.toHaveBeenCalled();
  log.mockRestore();
});
