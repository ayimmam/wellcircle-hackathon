import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import BurgerMenu from '../components/BurgerMenu';

// Drive the menu's user-dependent items by controlling the auth context.
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '../context/AuthContext';

function renderMenu({ user, isOpen = true } = {}) {
  useAuth.mockReturnValue({ user });
  const onClose = vi.fn();
  const utils = render(
    <MemoryRouter initialEntries={['/home']}>
      <BurgerMenu isOpen={isOpen} onClose={onClose} />
    </MemoryRouter>
  );
  return { ...utils, onClose };
}

const PLAIN_USER = { telegram_id: 100000001, is_provider: false, is_super_admin: false };
const PROVIDER_USER = { telegram_id: 100000002, is_provider: true, is_super_admin: false };
const ADMIN_USER = { telegram_id: 100000003, is_provider: false, is_super_admin: true };

describe('BurgerMenu', () => {
  it('renders nothing when closed', () => {
    renderMenu({ user: PLAIN_USER, isOpen: false });
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
  });

  it('shows core nav items for a plain user, without Dashboard or Admin', () => {
    renderMenu({ user: PLAIN_USER });
    ['Home', 'Explore', 'Communities', 'Points Store', 'Profile', 'Become Provider']
      .forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('shows Dashboard for providers', () => {
    renderMenu({ user: PROVIDER_USER });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('shows Admin for super admins', () => {
    renderMenu({ user: ADMIN_USER });
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('closes after navigating', async () => {
    const { onClose } = renderMenu({ user: PLAIN_USER });
    await userEvent.click(screen.getByText('Explore'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
