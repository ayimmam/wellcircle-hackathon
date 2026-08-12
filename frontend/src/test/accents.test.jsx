import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ProfileScreen from '../pages/ProfileScreen';
import { renderWithProviders } from './renderWithProviders';
import { ACCENTS } from '../context/ThemeContext';

// Vitest runs from the frontend/ package root.
const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');

function renderProfile() {
  return renderWithProviders(
    <Routes>
      <Route path="/profile" element={<ProfileScreen />} />
    </Routes>,
    { route: '/profile' }
  );
}

beforeEach(() => {
  delete document.documentElement.dataset.accent;
  localStorage.removeItem('wellcircle-accent');
});

describe('Accent palettes', () => {
  it('offers a pink option', () => {
    expect(ACCENTS.map(a => a.key)).toContain('pink');
  });

  it('every selectable accent has a light and a dark palette in the stylesheet', () => {
    ACCENTS.filter(a => a.key !== 'blue').forEach(({ key }) => {
      // 'blue' is the Telegram UI Kit default baked into the theme blocks and
      // deliberately has no [data-accent] block of its own.
      expect(css).toContain(`[data-accent="${key}"]`);
      expect(css).toContain(`[data-theme="dark"][data-accent="${key}"]`);
    });
  });

  it('picking pink stamps the root element and persists', async () => {
    renderProfile();
    await screen.findByText('Legacy Points');

    fireEvent.click(document.getElementById('accent-pink-btn'));
    expect(document.documentElement.dataset.accent).toBe('pink');
    expect(localStorage.getItem('wellcircle-accent')).toBe('pink');
  });
});

describe('Profile layout', () => {
  it('puts Appearance directly after Milestones', async () => {
    renderProfile();
    await screen.findByText('Legacy Points');

    const titles = [...document.querySelectorAll('.profile-section-title')].map(el => el.textContent);
    expect(titles.indexOf('Appearance')).toBe(titles.indexOf('Milestones') + 1);
  });

  it('drops the entries that now live in the menu or on About', async () => {
    renderProfile();
    await screen.findByText('Legacy Points');

    expect(document.getElementById('redeem-btn')).toBeNull();
    expect(document.getElementById('provider-dashboard-link')).toBeNull();
    expect(screen.queryByText('View Booking History')).not.toBeInTheDocument();
  });
});
