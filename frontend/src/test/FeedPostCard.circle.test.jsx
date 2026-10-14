import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import FeedPostCard from '../components/feed/FeedPostCard';
import { renderWithProviders } from './renderWithProviders';

describe('circle post navigation', () => {
  it('shows the circle and opens its chat from the Home post card', () => {
    const circleId = '33333333-0000-0000-0000-000000000001';
    const post = {
      id: 'post-in-circle', content: 'Morning run', created_at: new Date().toISOString(),
      user: { id: 'author', name: 'Runner' },
      source: { kind: 'circle', id: circleId, name: 'Morning Runners' },
    };
    renderWithProviders(
      <Routes>
        <Route path="/" element={<FeedPostCard item={{ id: post.id, type: 'post', post }} />} />
        <Route path="/circle/:id" element={<div>Circle chat and Join Circle</div>} />
      </Routes>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Morning Runners circle chat' }));
    expect(screen.getByText('Circle chat and Join Circle')).toBeInTheDocument();
  });

  it('uses a square frame for a square photo', () => {
    const post = {
      id: 'photo-post', content: 'A photo', photo_url: 'https://example.com/photo.jpg',
      created_at: new Date().toISOString(), user: { id: 'author', name: 'Runner' },
    };
    renderWithProviders(<FeedPostCard item={{ id: post.id, type: 'post', post }} />);
    const image = document.querySelector('.post-photo');
    Object.defineProperty(image, 'naturalWidth', { value: 800, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 800, configurable: true });
    fireEvent.load(image);
    expect(image.parentElement).toHaveStyle({ aspectRatio: '1 / 1' });
  });
});
