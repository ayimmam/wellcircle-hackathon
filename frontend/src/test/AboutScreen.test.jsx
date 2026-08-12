import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import AboutScreen from '../pages/AboutScreen';
import '../i18n';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../context/AuthContext';

const PLAIN_USER = { id: 'u1', telegram_id: 100000001, is_provider: false, is_super_admin: false };
const PROVIDER_USER = { id: 'u2', telegram_id: 100000002, is_provider: true, is_super_admin: false };
const ADMIN_USER = { id: 'u3', telegram_id: 100000003, is_provider: false, is_super_admin: true };

function renderAbout(user) {
  useAuth.mockReturnValue({ user });
  return render(
    <MemoryRouter initialEntries={['/about']}>
      <ThemeProvider>
        <Routes>
          <Route path="/about" element={<AboutScreen />} />
          <Route path="/provider-onboard" element={<div>Provider Onboard Screen</div>} />
          <Route path="/provider-dashboard" element={<div>Provider Dashboard Screen</div>} />
          <Route path="/admin" element={<div>Admin Screen</div>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('AboutScreen', () => {
  it('explains what the app is and the loop it runs on', () => {
    renderAbout(PLAIN_USER);
    expect(screen.getByText(/wellness in Addis Ababa stops being something you do alone/i)).toBeInTheDocument();
    ['Join a circle', 'Check in daily', 'Earn Legacy Points', 'Book and show up']
      .forEach(step => expect(screen.getByText(step)).toBeInTheDocument());
  });

  it('carries the provider pitch that used to sit in the burger menu', () => {
    renderAbout(PLAIN_USER);
    fireEvent.click(document.getElementById('about-become-provider-btn'));
    expect(screen.getByText('Provider Onboard Screen')).toBeInTheDocument();
  });

  it('hides the Manage section from users with no role for it', () => {
    renderAbout(PLAIN_USER);
    expect(screen.queryByText('Provider Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('routes providers to their dashboard', () => {
    renderAbout(PROVIDER_USER);
    fireEvent.click(screen.getByText('Provider Dashboard'));
    expect(screen.getByText('Provider Dashboard Screen')).toBeInTheDocument();
  });

  it('routes super admins to the admin area', () => {
    renderAbout(ADMIN_USER);
    fireEvent.click(screen.getByText('Admin'));
    expect(screen.getByText('Admin Screen')).toBeInTheDocument();
  });
});
