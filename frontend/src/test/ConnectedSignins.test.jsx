import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConnectedSignins from '../components/ConnectedSignins';
import { providerLabel } from '../utils/identityProviders';
import { getMyIdentities } from '../api/client';

vi.mock('../api/client', async importOriginal => ({
  ...await importOriginal(),
  getMyIdentities: vi.fn(),
}));

beforeEach(() => {
  getMyIdentities.mockReset();
});

it('shows connected providers and verified email without exposing subjects', async () => {
  getMyIdentities.mockResolvedValue({
    identities: [
      { provider: 'google', subject: 'google-subject-xyz', email: 'member@example.com' },
      { provider: 'telegram', subject: 'telegram-subject-123', email: null },
    ],
  });

  render(<ConnectedSignins />);

  expect(await screen.findByText('Google')).toBeInTheDocument();
  expect(screen.getByText('member@example.com')).toBeInTheDocument();
  expect(screen.getByText('Telegram')).toBeInTheDocument();
  expect(screen.getByText('Connected')).toBeInTheDocument();
  expect(screen.queryByText('google-subject-xyz')).not.toBeInTheDocument();
  expect(screen.queryByText('telegram-subject-123')).not.toBeInTheDocument();
});

it('shows an empty state when no methods are linked', async () => {
  getMyIdentities.mockResolvedValue({ identities: [] });
  render(<ConnectedSignins />);
  expect(await screen.findByText('No sign-in methods connected yet.')).toBeInTheDocument();
});

it('shows a safe error and retries the read-only list', async () => {
  getMyIdentities
    .mockRejectedValueOnce(new Error('network down'))
    .mockResolvedValueOnce({ identities: [{ provider: 'telegram', subject: 'tg', email: null }] });

  render(<ConnectedSignins />);

  expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your sign-in methods/i);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

  await waitFor(() => expect(getMyIdentities).toHaveBeenCalledTimes(2));
  expect(await screen.findByText('Telegram')).toBeInTheDocument();
});

it('only offers Manage when the surface supplies an entry point', async () => {
  getMyIdentities.mockResolvedValue({ identities: [] });
  const onManage = vi.fn();
  const { unmount } = render(<ConnectedSignins onManage={onManage} />);
  await screen.findByText('No sign-in methods connected yet.');
  fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
  expect(onManage).toHaveBeenCalledTimes(1);

  unmount();
  render(<ConnectedSignins />);
  await screen.findByText('No sign-in methods connected yet.');
  expect(screen.queryByRole('button', { name: 'Manage' })).not.toBeInTheDocument();
});

it('labels unknown providers generically and never echoes a subject', () => {
  expect(providerLabel('google')).toBe('Google');
  expect(providerLabel('telegram')).toBe('Telegram');
  expect(providerLabel('something-else')).toBe('Sign-in method');
});
