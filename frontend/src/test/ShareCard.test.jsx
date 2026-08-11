import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ShareCard from '../components/ShareCard';
import { renderWithProviders } from './renderWithProviders';
import { track } from '../analytics';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

// jsdom doesn't implement canvas rendering — stub just enough of the
// pipeline the component actually calls (toBlob) for share/download.
beforeEach(() => {
  vi.clearAllMocks();
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb) {
    cb(new Blob(['fake-png'], { type: 'image/png' }));
  });
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();
});

describe('ShareCard', () => {
  it('renders streak-milestone copy and fires the shown analytics event', () => {
    renderWithProviders(<ShareCard milestone={{ type: 'streak', streak: 7, tier: 'sprout', tierEmoji: '🌿' }} onClose={vi.fn()} />);
    expect(document.getElementById('share-card-sheet')).toBeInTheDocument();
    expect(screen.getByText('7-day streak!')).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('share_card_shown', { type: 'streak', streak: 7 });
  });

  it('renders personal-best copy for that milestone type', () => {
    renderWithProviders(<ShareCard milestone={{ type: 'personal_best', streak: 12, tier: 'grove', tierEmoji: '🌳' }} onClose={vi.fn()} />);
    expect(screen.getByText('New personal best!')).toBeInTheDocument();
  });

  it('closing calls onClose', () => {
    const onClose = vi.fn();
    renderWithProviders(<ShareCard milestone={{ type: 'streak', streak: 7 }} onClose={onClose} />);
    fireEvent.click(document.getElementById('share-card-close-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('download falls back to an anchor click and tracks it when Web Share is unavailable', async () => {
    const originalShare = navigator.share;
    // Ensure no Web Share API in this environment, matching most desktop test runs
    delete navigator.share;

    renderWithProviders(<ShareCard milestone={{ type: 'streak', streak: 7 }} onClose={vi.fn()} />);
    fireEvent.click(document.getElementById('share-card-download-btn'));

    await waitFor(() =>
      expect(track).toHaveBeenCalledWith('share_card_downloaded', { type: 'streak', streak: 7 })
    );

    if (originalShare) navigator.share = originalShare;
  });
});
