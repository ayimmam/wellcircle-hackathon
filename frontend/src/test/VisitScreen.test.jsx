import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VisitScreen, { sanitizeSrc, telegramLink, webAppLink } from '../pages/VisitScreen';
import i18n from '../i18n';
import { track } from '../analytics';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

// The QR-stand landing is the one screen a visitor reaches with no session and
// no app, so the two exits (bot deep link / web) must be correct offline.
function renderVisit(entry = '/visit') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/visit" element={<VisitScreen />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  i18n.changeLanguage('en');
});

describe('VisitScreen', () => {
  it('offers both answers to the Telegram question', () => {
    renderVisit();
    expect(screen.getByText('Do you have Telegram?')).toBeInTheDocument();
    expect(screen.getByText('Yes — open in Telegram')).toBeInTheDocument();
    expect(screen.getByText('No — continue on the web')).toBeInTheDocument();
  });

  it('links "yes" to the bot, and tags it with ?src when the QR carries one', () => {
    renderVisit();
    expect(screen.getByText('Yes — open in Telegram').getAttribute('href'))
      .toBe('https://t.me/WellCircleBot');

    cleanup();
    renderVisit('/visit?src=boston-day-spa');
    expect(screen.getByText('Yes — open in Telegram').getAttribute('href'))
      .toBe('https://t.me/WellCircleBot?startapp=src_boston-day-spa');
  });

  // wellcircle.et is the Mini App build and its auth demands Telegram
  // initData, so the "no" answer has to leave this origin entirely.
  it('links "no" to the standalone web app, not to this origin', () => {
    renderVisit();
    expect(screen.getByText('No — continue on the web').getAttribute('href'))
      .toBe('https://app.wellcircle.et');

    cleanup();
    renderVisit('/visit?src=boston-day-spa');
    expect(screen.getByText('No — continue on the web').getAttribute('href'))
      .toBe('https://app.wellcircle.et/?src=boston-day-spa');
  });

  it('switches the page to Amharic', async () => {
    renderVisit();
    await userEvent.click(screen.getByText('አማርኛ'));
    expect(screen.getByText('ቴሌግራም አለዎት?')).toBeInTheDocument();
  });

  it('reports the scan and the chosen branch to analytics', async () => {
    renderVisit('/visit?src=boston-day-spa');
    expect(track).toHaveBeenCalledWith('visit_page_viewed', {
      src: 'boston-day-spa',
      tagged: true,
      in_telegram: false,
    });

    await userEvent.click(screen.getByText('Yes — open in Telegram'));
    expect(track).toHaveBeenCalledWith('visit_choice_telegram', {
      src: 'boston-day-spa',
      lang: 'en',
    });

    await userEvent.click(screen.getByText('No — continue on the web'));
    expect(track).toHaveBeenCalledWith('visit_choice_web', {
      src: 'boston-day-spa',
      lang: 'en',
    });
  });

  it('marks an untagged scan as untagged rather than dropping the event', () => {
    renderVisit();
    expect(track).toHaveBeenCalledWith('visit_page_viewed', {
      src: null,
      tagged: false,
      in_telegram: false,
    });
  });

  it('drops characters Telegram would reject from the src tag', () => {
    expect(sanitizeSrc('boston day/spa?x=1')).toBe('bostondayspax1');
    expect(sanitizeSrc('a'.repeat(200)).length).toBe(56);
    expect(telegramLink('  ')).toBe('https://t.me/WellCircleBot');
    expect(telegramLink(null)).toBe('https://t.me/WellCircleBot');
    expect(webAppLink('boston day/spa')).toBe('https://app.wellcircle.et/?src=bostondayspa');
    expect(webAppLink(null)).toBe('https://app.wellcircle.et');
  });
});
