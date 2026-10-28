import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppShell } from '../App';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '@shared/context/ThemeContext';
import { MOCK_USER, MOCK_PROVIDERS, MOCK_EVENTS } from '@shared/data/mock';
import { setToken, getToken, getMe, joinCircleByCode } from '@shared/api/client';
import { SESSION_EXPIRED_EVENT } from '@shared/utils/platform';
import { takePostRedirect } from '../utils/session';
import { featureShareLink } from '@shared/utils/shareLinks';
import { shareCircleInvite } from '@shared/utils/circleInvite';
import '@shared/i18n';

vi.mock('@shared/analytics', () => ({ initAnalytics: vi.fn(), identifyUser: vi.fn(), track: vi.fn() }));
vi.mock('@shared/api/client', async importOriginal => ({
  ...await importOriginal(),
  getMe: vi.fn(),
  joinCircleByCode: vi.fn(),
}));

function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname + location.search}</output>; }
function mount(route, signedIn = true) {
  if (signedIn) localStorage.setItem('wc_token', 'saved-web-session');
  return render(<MemoryRouter initialEntries={[route]}><ThemeProvider><AuthProvider><AppShell /><Location /></AuthProvider></ThemeProvider></MemoryRouter>);
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); setToken(null);
  getMe.mockResolvedValue({ ...MOCK_USER, is_onboarded: true });
  joinCircleByCode.mockResolvedValue({ id: 'joined-circle', name: 'Our circle' });
});

describe('browser sessions and shared features', () => {
  it('uses browser login without Telegram initData and preserves a protected deep link', async () => {
    mount('/event/event-123/rsvp?src=share', false);
    expect(await screen.findByText('Continue with Google')).toBeInTheDocument();
    expect(sessionStorage.getItem('wc_post_redirect')).toBe('/event/event-123/rsvp?src=share');
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  it('renders the shared event RSVP feature on web', async () => {
    const event = MOCK_EVENTS[0];
    const { container } = mount(`/event/${event.id}/rsvp`);
    await waitFor(() => expect(container.querySelector('.route-fallback')).toBeNull());
    expect(await screen.findByText(event.service_name)).toBeInTheDocument();
    expect(container.querySelector('.error-boundary')).toBeNull();
  });

  it('renders the shared provider feature through the web session context', async () => {
    mount(`/provider/${MOCK_PROVIDERS[0].id}`);
    expect(await screen.findByText(MOCK_PROVIDERS[0].name)).toBeInTheDocument();
  });

  it.each([['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/data-deletion', 'Data Deletion']])('allows logged-out reading of %s', async (path, title) => {
    mount(path, false);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('keeps Telegram-only actions discoverable and support available', async () => {
    mount('/help', false);
    expect(await screen.findByRole('heading', { name: /Telegram bot features/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open well circle bot/i })).toHaveAttribute('href', 'https://t.me/WellCircleBot');
    expect(screen.getByRole('link', { name: /contact support/i })).toHaveAttribute('href', 'https://t.me/well_circle');
  });

  it('expires the web session and preserves the current route for sign-in', async () => {
    mount('/profile');
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/profile'));
    fireEvent(window, new Event(SESSION_EXPIRED_EVENT));
    expect(await screen.findByText('Continue with Google')).toBeInTheDocument();
    expect(localStorage.getItem('wc_token')).toBeNull();
    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem('wc_post_redirect')).toBe('/profile');
  });

  it('joins an authenticated invite once and removes the query string', async () => {
    mount('/circle/joined-circle?join=ABC123');
    await waitFor(() => expect(joinCircleByCode).toHaveBeenCalledWith('ABC123'));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/circle/joined-circle'));
    expect(joinCircleByCode).toHaveBeenCalledTimes(1);
  });

  it('shares circle invites as browser links', async () => {
    const share = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    shareCircleInvite({ id: 'circle-123', join_code: 'ABC123', name: 'Our circle' });
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: `${window.location.origin}/circle/circle-123?join=ABC123` }));
    delete navigator.share;
    expect(featureShareLink('post_post-123')).toBe(`${window.location.origin}/post/post-123`);
    expect(featureShareLink('event_event-123')).toBe(`${window.location.origin}/event/event-123/rsvp`);
  });

  it('lets browser users sign out without retaining the previous session', async () => {
    mount('/profile');
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('Continue with Google')).toBeInTheDocument();
    expect(localStorage.getItem('wc_token')).toBeNull();
    expect(getToken()).toBeNull();
  });

  it('retains an invite destination through first-time onboarding', async () => {
    localStorage.setItem('wc_token', 'new-session');
    sessionStorage.setItem('wc_post_redirect', '/circle/new-circle?join=NEW123');
    getMe.mockResolvedValue({ ...MOCK_USER, is_onboarded: false });
    let redirect;
    function CompleteOnboarding() {
      const { onboard, user } = useAuth();
      return <button disabled={!user} onClick={async () => { redirect = (await onboard({})).redirectTo; }}>Complete onboarding</button>;
    }
    render(<MemoryRouter initialEntries={['/onboarding']}><AuthProvider><CompleteOnboarding /></AuthProvider></MemoryRouter>);
    const complete = screen.getByRole('button', { name: 'Complete onboarding' });
    await waitFor(() => expect(complete).toBeEnabled());
    fireEvent.click(complete);
    await waitFor(() => expect(redirect).toBe('/circle/new-circle?join=NEW123'));
    expect(sessionStorage.getItem('wc_post_redirect')).toBeNull();
  });

  it('consumes only local return destinations', () => {
    sessionStorage.setItem('wc_post_redirect', '//evil.example/path');
    expect(takePostRedirect()).toBe('/home');
    sessionStorage.setItem('wc_post_redirect', '/post/post-123?from=share');
    expect(takePostRedirect()).toBe('/post/post-123?from=share');
    expect(takePostRedirect()).toBe('/home');
  });
});
