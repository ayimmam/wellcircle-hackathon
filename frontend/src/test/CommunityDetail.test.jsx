import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import CommunityDetail from '../pages/CommunityDetail';
import { renderWithProviders } from './renderWithProviders';

// Shanti Yoga Circle — already joined in the seed data (src/data/mock.js).
const JOINED_COMMUNITY_ID = '22222222-0000-0000-0000-000000000003';

vi.mock('../data/mock', async () => {
  const actual = await vi.importActual('../data/mock');
  return { ...actual, MOCK_FEED_EVENTS: [] };
});

describe('CommunityDetail — actionable empty state for the Live Feed', () => {
  it('offers a "Go check in" CTA that focuses the check-in button', async () => {
    renderWithProviders(
      <Routes><Route path="/community/:id" element={<CommunityDetail />} /></Routes>,
      { route: `/community/${JOINED_COMMUNITY_ID}` },
    );

    const cta = await screen.findByRole('button', { name: /go check in/i });
    fireEvent.click(cta);

    expect(document.getElementById('checkin-btn')).toHaveFocus();
  });
});
