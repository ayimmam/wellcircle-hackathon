import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import NotificationsScreen from '../pages/NotificationsScreen';
import PostDetail from '../pages/PostDetail';
import { MOCK_POSTS } from '../data/mock';
import { cacheKeys } from '../api/client';
import { write } from '../api/cache';
import { renderWithProviders } from './renderWithProviders';
import { useAuth } from '../context/AuthContext';

const post = MOCK_POSTS[0];
function AuthStatus() {
  const { user } = useAuth();
  return user ? <span>auth-ready</span> : null;
}
vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    getNotifications: async () => ({
      notifications: [{
        id: 'test-notification', title: 'New post', type: 'follower_post',
        is_read: false, created_at: new Date().toISOString(),
        action_url: '/post/44444444-0000-0000-0000-000000000001',
      }],
      unread_count: 1,
    }),
    markNotificationRead: () => new Promise(() => {}),
  };
});

describe('notification post navigation', () => {
  it('renders the exact cached post on the first destination paint while the read request is pending', async () => {
    renderWithProviders(
      <>
        <AuthStatus />
        <Routes>
          <Route path="/notifications" element={<NotificationsScreen />} />
          <Route path="/post/:id" element={<PostDetail />} />
        </Routes>
      </>,
      { route: '/notifications' },
    );
    const row = await screen.findByLabelText('New post');
    await screen.findByText('auth-ready');
    write(cacheKeys.post(post.id), post);
    fireEvent.click(row);
    expect(document.getElementById('post-detail')).toHaveTextContent(post.content);
    expect(screen.queryByText('Loading post…')).toBeNull();
  });
});
