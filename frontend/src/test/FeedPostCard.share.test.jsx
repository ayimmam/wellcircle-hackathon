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
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
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
  delete window.Telegram;
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
    const repostBtn = screen.getByRole('button', { name: /repost/i });
    expect(repostBtn).toHaveClass('post-action-btn-square');
    expect(repostBtn).toHaveTextContent('');
  });

  it('puts author credit and the bot post link on the shared image', async () => {
    const blob = await generatePostCardBlob(mockPostItem.post);
    expect(blob).toBeTruthy();
    expect(drawnText).toContain('WELL CIRCLE');
    expect(drawnText).toContain('Sarah Runner');
    expect(drawnText).toContain('@sarah_runs');
    expect(drawnText.some(t => t.includes('@WellCircleBot') || t.includes('@wellcirclebot'))).toBe(true);
    expect(drawnText).toContain('https://t.me/WellCircleBot?startapp=post_post-101');
  });

  it('opens the native share sheet with the post image and bot link', async () => {
    vi.spyOn(clientApi, 'sharePost').mockResolvedValue({ message: 'Success' });
    navigator.share = vi.fn().mockResolvedValue(undefined);
    navigator.canShare = vi.fn(() => true);

    renderWithProviders(<FeedPostCard item={mockPostItem} />);
    const shareBtn = screen.getByRole('button', { name: /share post/i });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(navigator.share).toHaveBeenCalledWith(expect.objectContaining({
        files: [expect.objectContaining({ name: 'wellcircle-post-post-101.png', type: 'image/png' })],
        text: expect.stringContaining('https://t.me/WellCircleBot?startapp=post_post-101'),
      }));
      expect(navigator.canShare).toHaveBeenCalledWith({ files: [expect.any(File)] });
      expect(clientApi.sharePost).toHaveBeenCalledWith('post-101');
    });
  });

  it('downloads the image and copies the bot link when file sharing is unavailable', async () => {
    renderWithProviders(<FeedPostCard item={mockPostItem} />);
    const shareBtn = screen.getByRole('button', { name: /share post/i });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://t.me/WellCircleBot?startapp=post_post-101'
      );
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });
  });

  it('saves the image in Telegram when its WebView cannot share files', async () => {
    const openTelegramLink = vi.fn();
    window.Telegram = { WebApp: { openTelegramLink, expand: vi.fn(), ready: vi.fn(), initDataUnsafe: {} } };
    renderWithProviders(<FeedPostCard item={mockPostItem} />);
    fireEvent.click(screen.getByRole('button', { name: /share post/i }));
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled());
    expect(openTelegramLink).not.toHaveBeenCalled();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://t.me/WellCircleBot?startapp=post_post-101');
  });

  it('saves the image if a WebView rejects file sharing', async () => {
    navigator.share = vi.fn().mockRejectedValue(new TypeError('files unsupported'));
    navigator.canShare = vi.fn(() => true);
    renderWithProviders(<FeedPostCard item={mockPostItem} />);
    fireEvent.click(screen.getByRole('button', { name: /share post/i }));
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://t.me/WellCircleBot?startapp=post_post-101');
  });

  it('does not record a share when the native sheet is cancelled', async () => {
    vi.spyOn(clientApi, 'sharePost').mockResolvedValue({});
    navigator.share = vi.fn().mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
    navigator.canShare = vi.fn(() => true);
    renderWithProviders(<FeedPostCard item={mockPostItem} />);
    fireEvent.click(screen.getByRole('button', { name: /share post/i }));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(clientApi.sharePost).not.toHaveBeenCalled();
  });

  it('reposts to the feed and opens the new post', async () => {
    vi.spyOn(clientApi, 'repostPost').mockResolvedValue({ id: 'new-post' });
    renderWithProviders(<FeedPostCard item={mockPostItem} />);
    fireEvent.click(screen.getByRole('button', { name: /repost/i }));
    await waitFor(() => expect(clientApi.repostPost).toHaveBeenCalledWith('post-101'));
  });
});
