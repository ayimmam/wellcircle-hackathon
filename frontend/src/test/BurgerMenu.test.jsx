import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import BurgerMenu from '../components/BurgerMenu';

function renderMenu({ isOpen = true } = {}) {
  const onClose = vi.fn();
  const utils = render(
    <MemoryRouter initialEntries={['/home']}>
      <BurgerMenu isOpen={isOpen} onClose={onClose} />
    </MemoryRouter>
  );
  return { ...utils, onClose };
}

// Everything on the bottom nav (Home, Explore, Community, Profile) and the
// header (Notifications) is deliberately absent — repeating a destination that
// is already one tap away only makes the menu longer to scan.
const BOTTOM_NAV_AND_HEADER = ['Home', 'Explore', 'Communities', 'Community', 'Profile', 'Notifications'];

describe('BurgerMenu', () => {
  it('renders nothing when closed', () => {
    renderMenu({ isOpen: false });
    expect(screen.queryByText('Points Store')).not.toBeInTheDocument();
  });

  it('shows exactly the four destinations with no other permanent entry point', () => {
    renderMenu();
    ['Points Store', 'Bookings', 'Events', 'About']
      .forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
    expect(document.querySelectorAll('.burger-nav-item')).toHaveLength(4);
  });

  it('does not duplicate bottom-nav or header destinations', () => {
    renderMenu();
    BOTTOM_NAV_AND_HEADER.forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });
  });

  it('does not carry the provider or admin entry points — those live on About', () => {
    renderMenu();
    expect(screen.queryByText('Become Provider')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('closes after navigating', async () => {
    const { onClose } = renderMenu();
    await userEvent.click(screen.getByText('Points Store'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
