import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginScreen from '../pages/LoginScreen';
import { useAuth } from '../context/AuthContext';
import { prepareTelegramLogin, signInWithTelegram } from '../utils/telegramLogin';
import { signInWithGoogle, prepareGoogleSignIn } from '../utils/firebaseGoogle';
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../utils/firebaseGoogle', () => ({ firebaseGoogleConfigured: true, prepareGoogleSignIn: vi.fn(), signInWithGoogle: vi.fn() }));
vi.mock('../utils/telegramLogin', () => ({ prepareTelegramLogin: vi.fn(), signInWithTelegram: vi.fn() }));
const telegramExchange = vi.fn();
const exchange = vi.fn();
beforeEach(() => {
  prepareTelegramLogin.mockReset().mockResolvedValue({});
  signInWithTelegram.mockReset().mockResolvedValue({ id: 123456789, auth_date: 1700000000, hash: 'signed' });
  telegramExchange.mockReset().mockResolvedValue({});
  prepareGoogleSignIn.mockReset().mockResolvedValue({});
  signInWithGoogle.mockReset().mockResolvedValue('firebase-google-token');
  exchange.mockReset().mockResolvedValue({});
  useAuth.mockReturnValue({ loginWithFirebase: exchange, loginWithTelegram: telegramExchange });
});
function mount() { return render(<MemoryRouter><LoginScreen /></MemoryRouter>); }
function signIn() { fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' })); }
it('opens Google sign-in and exchanges only the verified ID token', async () => {
  mount(); signIn();
  await waitFor(() => expect(exchange).toHaveBeenCalledWith('firebase-google-token'));
});
it('shows a cancelled popup without exchanging a credential', async () => {
  signInWithGoogle.mockRejectedValue(new Error('Sign-in was cancelled. Please try again.'));
  mount(); signIn();
  expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in was cancelled');
  expect(exchange).not.toHaveBeenCalled();
});
it('prevents duplicate sign-in while a popup is pending', () => {
  signInWithGoogle.mockImplementation(() => new Promise(() => {}));
  mount(); signIn();
  fireEvent.click(screen.getByRole('button', { name: 'Signing in...' }));
  expect(signInWithGoogle).toHaveBeenCalledTimes(1);
});
it('allows a failed backend exchange to be retried', async () => {
  exchange.mockRejectedValueOnce(new Error('Service temporarily unavailable'));
  mount(); signIn();
  expect(await screen.findByRole('alert')).toHaveTextContent('Service temporarily unavailable');
  signIn(); await waitFor(() => expect(exchange).toHaveBeenCalledTimes(2));
});
it('keeps Telegram, support and public legal links while removing all SMS controls', () => {
  mount();
  expect(screen.getByRole('button', { name: 'Continue with Telegram' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Help & support' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
  expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByText(/SMS|verification code|WhatsApp/)).not.toBeInTheDocument();
});

it('exchanges the official Telegram callback and reports backend failures visibly', async () => {
  telegramExchange.mockRejectedValueOnce(new Error('Invalid or expired Telegram login'));
  mount();
  const button = screen.getByRole('button', { name: 'Continue with Telegram' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid or expired Telegram login');
  expect(telegramExchange).toHaveBeenCalledWith({ id: 123456789, auth_date: 1700000000, hash: 'signed' });
});
it('does not exchange data after Telegram authorization is cancelled', async () => {
  signInWithTelegram.mockRejectedValueOnce(new Error('Telegram sign-in was cancelled'));
  mount(); const button = screen.getByRole('button', { name: 'Continue with Telegram' });
  await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
  expect(await screen.findByRole('alert')).toHaveTextContent('Telegram sign-in was cancelled');
  expect(telegramExchange).not.toHaveBeenCalled();
});
