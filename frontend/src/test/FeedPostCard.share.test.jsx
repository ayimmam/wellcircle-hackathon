import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import FeedPostCard from '../components/feed/FeedPostCard';
import { renderWithProviders } from './renderWithProviders';
import { generatePostCardBlob } from '../utils/brandedCanvas';
import * as clientApi from '../api/client';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

let drawnText = [];
function installCanvasSpy() {
  drawnText = [];
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    canvas: {},
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(),
    fillText: (text) => drawnText.push(String(text)),
    measureText: () => ({ width: 120 }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    set letterSpacing(_v) {},
    get letterSpacing() { return '0px'; },
  }));
  HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb) {
    cb(new Blob(['fake-post-png'], { type: 'image/png' }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  installCanvasSpy();
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-post-card');
  global.URL.revokeObjectURL = vi.fn();
  if (navigator.clipboard) {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  } else {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  }
});

afterEach(() => {
  delete navigator.share;
  delete navigator.canShare;
});

const mockPostItem = {
  id: 'post-101',
  post: {
    id: 'post-101',
    content: 'Just ran 5k around the city! Feeling great.',
    activity_type: 'run',
    distance_km: 5.0,
    duration_min: 25,
    user: {
      id: 'user-202',
      name: 'Sarah Runner',
      telegram_handle: 'sarah_runs',
      photo_url: 'https://example.com/avatar.jpg',
    },
    created_at: new Date().toISOString(),
    reactions: { '🔥': 3 },
    viewer_reactions: [],
    reactors_preview: {},
    comments: [],
  },
};

describe('FeedPostCard & Branded Post Sharing', () => {
  it('renders the share button on the feed post card', () => {
    renderWithProviders(<FeedPostCard item={mockPostItem} />);
    const shareBtn = screen.getByRole('button', { name: /share post/i });
    expect(shareBtn).toBeInTheDocument();
  });

  it('generates a branded post card canvas containing author and @wellcirclebot watermark', async () => {
    const blob = await generatePostCardBlob(mockPostItem.post);
    expect(blob).toBeTruthy();
    expect(drawnText).toContain('WELL CIRCLE');
    expect(drawnText).toContain('Sarah Runner');
    expect(drawnText).toContain('@sarah_runs');
    expect(drawnText.some(t => t.includes('@WellCircleBot') || t.includes('@wellcirclebot'))).toBe(true);
  });

  it('calls sharePost API and Web Share API when user clicks share button', async () => {
    vi.spyOn(clientApi, 'sharePost').mockResolvedValue({ message: 'Success' });
    navigator.share = vi.fn().mockResolvedValue(undefined);
    navigator.canShare = vi.fn(() => true);

    renderWithProviders(<FeedPostCard item={mockPostItem} />);
    const shareBtn = screen.getByRole('button', { name: /share post/i });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(navigator.share).toHaveBeenCalled();
    });
  });

  it('falls back to download and clipboard copy when Web Share API is unavailable', async () => {
    renderWithProviders(<FeedPostCard item={mockPostItem} />);
    const shareBtn = screen.getByRole('button', { name: /share post/i });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('https://t.me/WellCircleBot?startapp=post_post-101')
      );
    });
  });
});
