import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminGuard from '../components/AdminGuard';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../context/AuthContext';

function renderGuard(authValue) {
  useAuth.mockReturnValue(authValue);
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <div data-testid="admin-content">Admin area</div>
            </AdminGuard>
          }
        />
        <Route path="/home" element={<div data-testid="home">Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const ADMIN = { telegram_id: 1, is_super_admin: true };
const PLAIN = { telegram_id: 100000001, is_super_admin: false };

describe('AdminGuard', () => {
  it('shows a loading skeleton while auth resolves', () => {
    const { container } = renderGuard({ user: null, loading: true, login: vi.fn() });
    expect(container.querySelector('.skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  it('shows an error + retry when sign-in fails', async () => {
    const login = vi.fn();
    renderGuard({ user: null, loading: false, error: 'Sign-in failed', login });
    expect(screen.getByText(/sign-in failed/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(login).toHaveBeenCalled();
  });

  it('redirects non-admins to /home', () => {
    renderGuard({ user: PLAIN, loading: false, login: vi.fn() });
    expect(screen.getByTestId('home')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  it('renders admin content for a super admin', () => {
    renderGuard({ user: ADMIN, loading: false, login: vi.fn() });
    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
  });
});
