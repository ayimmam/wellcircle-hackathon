import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import ShareCard from '../components/ShareCard';
import { renderWithProviders } from './renderWithProviders';
import { track } from '../analytics';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

const EMOJI = /\p{Extended_Pictographic}/u;

/**
 * happy-dom has no canvas renderer, so getContext('2d') returns null and the
 * component bails out of drawing. Stub a recording context so the card's
 * actual painted text is assertable.
 */
let drawnText = [];
function installCanvasSpy() {
  drawnText = [];
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    canvas: {},
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(),
    fillText: (text) => drawnText.push(String(text)),
    measureText: () => ({ width: 100 }),
    set letterSpacing(_v) {},
    get letterSpacing() { return '0px'; },
  }));
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb) {
    cb(new Blob(['fake-png'], { type: 'image/png' }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  installCanvasSpy();
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  delete navigator.share;
  delete navigator.canShare;
});

describe('ShareCard — content', () => {
  it('renders a streak card with the day count as the hero stat', () => {
    renderWithProviders(<ShareCard milestone={{ type: 'streak', streak: 7, tier: 'sprout' }} onClose={vi.fn()} />);

    expect(document.getElementById('share-card-sheet')).toBeInTheDocument();
    expect(document.getElementById('share-card-caption').textContent).toContain('7-day streak');
    expect(drawnText).toContain('7');
    expect(drawnText).toContain('DAY STREAK');
    expect(track).toHaveBeenCalledWith('share_card_shown', { type: 'streak', streak: 7 });
  });

  it('renders personal-best copy for that milestone type', () => {
    renderWithProviders(<ShareCard milestone={{ type: 'personal_best', streak: 12, tier: 'grove' }} onClose={vi.fn()} />);

    expect(document.getElementById('share-card-caption').textContent).toContain('New personal best');
    expect(drawnText).toContain('12');
    expect(drawnText).toContain('DAY PERSONAL BEST');
  });

  it('renders "Just joined" on day one and a day count afterwards', () => {
    const { unmount } = renderWithProviders(
      <ShareCard milestone={{ type: 'joined', day: 1 }} onClose={vi.fn()} />
    );
    expect(document.getElementById('share-card-caption').textContent).toContain('Just joined Well Circle');
    expect(drawnText).toContain('DAY ONE');
    unmount();

    installCanvasSpy();
    renderWithProviders(<ShareCard milestone={{ type: 'joined', day: 42 }} onClose={vi.fn()} />);
    expect(document.getElementById('share-card-caption').textContent).toContain('Day 42 on Well Circle');
    expect(drawnText).toContain('42');
    expect(drawnText).toContain('DAYS IN');
  });

  it('attributes the card to the Telegram bot, not a website', () => {
    renderWithProviders(<ShareCard milestone={{ type: 'joined', day: 1 }} onClose={vi.fn()} />);

    expect(drawnText).toContain('@wellcirclebot on Telegram');
    expect(drawnText.join(' ')).not.toContain('wellcircle.app');
  });

  it('paints no emoji onto the card', () => {
    renderWithProviders(<ShareCard milestone={{ type: 'streak', streak: 7, tier: 'sprout' }} onClose={vi.fn()} />);

    drawnText.forEach(text => expect(text).not.toMatch(EMOJI));
    expect(document.getElementById('share-card-sheet').textContent).not.toMatch(EMOJI);
  });

  it('shows the next milestone to chase below the card', async () => {
    renderWithProviders(<ShareCard milestone={{ type: 'joined', day: 1 }} onClose={vi.fn()} />);
    const next = document.getElementById('share-card-next-milestone');

    // Before auth resolves there is no user, so the card falls back to the
    // first points tier rather than rendering an empty line.
    expect(next.textContent).toContain('100 more points to Sprout tier');

    // Once MOCK_USER (3-day streak) lands, the nearer streak goal takes over.
    await waitFor(
      () => expect(next.textContent).toContain('4 more days to a 7-day streak freeze'),
      { timeout: 2000 },
    );
    expect(next.querySelector('svg')).toBeInTheDocument();
  });
});

describe('ShareCard — actions', () => {
  it('closing calls onClose', () => {
    const onClose = vi.fn();
    renderWithProviders(<ShareCard milestone={{ type: 'streak', streak: 7 }} onClose={onClose} />);

    fireEvent.click(document.getElementById('share-card-close-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shares via the Web Share API with the bot handle in the text', async () => {
    navigator.share = vi.fn().mockResolvedValue(undefined);
    navigator.canShare = vi.fn(() => true);

    renderWithProviders(<ShareCard milestone={{ type: 'streak', streak: 7 }} onClose={vi.fn()} />);
    fireEvent.click(document.getElementById('share-card-share-btn'));

    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(navigator.share.mock.calls[0][0].text).toContain('@wellcirclebot on Telegram');
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith('share_card_shared', { type: 'streak', streak: 7 })
    );
  });

  it('falls back to download when Web Share is unavailable', async () => {
    renderWithProviders(<ShareCard milestone={{ type: 'streak', streak: 7 }} onClose={vi.fn()} />);
    fireEvent.click(document.getElementById('share-card-share-btn'));

    await waitFor(() =>
      expect(track).toHaveBeenCalledWith('share_card_downloaded', { type: 'streak', streak: 7 })
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('downloads directly and tracks the join card by day, not streak', async () => {
    renderWithProviders(<ShareCard milestone={{ type: 'joined', day: 1 }} onClose={vi.fn()} />);
    fireEvent.click(document.getElementById('share-card-download-btn'));

    await waitFor(() =>
      expect(track).toHaveBeenCalledWith('share_card_downloaded', { type: 'joined', day: 1 })
    );
  });

  it('does not show an error toast when the user cancels the share sheet', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    navigator.share = vi.fn().mockRejectedValue(abort);
    navigator.canShare = vi.fn(() => true);

    renderWithProviders(<ShareCard milestone={{ type: 'streak', streak: 7 }} onClose={vi.fn()} />);
    fireEvent.click(document.getElementById('share-card-share-btn'));

    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(document.querySelector('.toast-error')).toBeNull();
  });
});
