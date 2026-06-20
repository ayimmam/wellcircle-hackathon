import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import '../i18n';

/**
 * Render a component tree inside the same provider stack the real app uses
 * (Theme + Auth + i18n) but under a MemoryRouter so tests can start at any
 * route. Returns RTL utilities plus the router so callers can assert location.
 */
export function renderWithProviders(ui, { route = '/', routes } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider>
        <AuthProvider>{ui}</AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

export default renderWithProviders;
