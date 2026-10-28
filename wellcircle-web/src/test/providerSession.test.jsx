import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { ProviderPortalAuthProvider, useProviderPortalAuth } from '@shared/context/ProviderPortalAuthContext';
import { getMe, setToken, getToken } from '@shared/api/client';
vi.mock('@shared/api/client', async original => ({ ...await original(), getMe: vi.fn() }));
function Probe() {
  const { providerUser, loginWithPassword } = useProviderPortalAuth();
  const navigate = useNavigate();
  return <><output>{providerUser?.name || 'No provider'}</output><button onClick={() => loginWithPassword('provider', 'test-only')}>Sign in</button><button onClick={() => navigate('/home')}>Consumer home</button></>;
}
function mount(route) { render(<MemoryRouter initialEntries={[route]}><ProviderPortalAuthProvider><Probe /></ProviderPortalAuthProvider></MemoryRouter>); }
beforeEach(() => { localStorage.clear(); setToken('consumer-token'); getMe.mockClear(); getMe.mockResolvedValue({ id: 'provider-user', name: 'Provider staff', is_provider: true }); });
it('ignores saved provider credentials on consumer routes', () => {
  localStorage.setItem('wc_provider_token', 'provider-token');
  mount('/home');
  expect(getToken()).toBe('consumer-token');
  expect(getMe).not.toHaveBeenCalled();
});
it('verifies a provider without reading the consumer cache and restores the consumer token on exit', async () => {
  localStorage.setItem('wc_provider_token', 'provider-token');
  mount('/provider-portal/overview');
  expect(await screen.findByText('Provider staff')).toBeInTheDocument();
  expect(getMe).toHaveBeenCalledWith({ uncached: true });
  expect(getToken()).toBe('provider-token');
  fireEvent.click(screen.getByRole('button', { name: 'Consumer home' }));
  expect(getToken()).toBe('consumer-token');
});
it('restores the consumer token after a fresh provider sign-in too', async () => {
  mount('/provider-portal/login');
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(getToken()).toBe('mock-provider-jwt-token'));
  fireEvent.click(screen.getByRole('button', { name: 'Consumer home' }));
  expect(getToken()).toBe('consumer-token');
});
