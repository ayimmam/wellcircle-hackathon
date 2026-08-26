import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import ForYouScreen from '../pages/ForYouScreen';
import CircleDetailScreen from '../pages/CircleDetailScreen';
import { renderWithProviders } from './renderWithProviders';
import { MOCK_STORIES, MOCK_CIRCLES } from '../data/mock';

vi.mock('../analytics', () => ({
  initAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  track: vi.fn(),
}));

// The circle the mock user owns and has joined — the only one whose
// member-gated rail and owner-only banner controls are reachable.
const JOINED_CIRCLE = MOCK_CIRCLES[1];

describe('For You — story rail', () => {
  it('paints the rail from the home payload, grouped by person', async () => {
    renderWithProviders(
      <Routes><Route path="/home" element={<ForYouScreen />} /></Routes>,
      { route: '/home' }
    );

    await waitFor(() => {
      expect(document.getElementById('story-rail')).toBeInTheDocument();
    });

    // Two authors in MOCK_STORIES, three stories — the rail shows one ring
    // per author, which is the whole point of grouping.
    const authors = new Set(MOCK_STORIES.map(s => s.user_id));
    expect(document.querySelectorAll('#story-rail .story-item')).toHaveLength(authors.size);
    expect(screen.getByLabelText("Hana Girma's story")).toBeInTheDocument();
  });

  it('plays a person’s stories oldest-first when their ring is tapped', async () => {
    renderWithProviders(
      <Routes><Route path="/home" element={<ForYouScreen />} /></Routes>,
      { route: '/home' }
    );
    await waitFor(() => expect(document.getElementById('story-rail')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Hana Girma's story"));

    await waitFor(() => expect(document.getElementById('story-viewer')).toBeInTheDocument());
    // Hana posted two of the three mock stories.
    expect(document.querySelectorAll('.story-progress-track')).toHaveLength(2);
    expect(document.querySelector('.story-viewer-meta').textContent).toContain('Zen Seekers');
    expect(document.querySelector('.story-viewer-footer').textContent).toMatch(/Disappears in \d+[hd]/);
  });
});

describe('Circle detail — banner and stories', () => {
  function renderCircle(id) {
    return renderWithProviders(
      <Routes><Route path="/circle/:id" element={<CircleDetailScreen />} /></Routes>,
      { route: `/circle/${id}` }
    );
  }

  it('shows the banner and, for the owner, the control to change it', async () => {
    renderCircle(JOINED_CIRCLE.id);

    await waitFor(() => {
      expect(document.getElementById('circle-banner')).toBeInTheDocument();
    });
    const edit = document.getElementById('circle-banner-edit');
    expect(edit).toBeInTheDocument();
    expect(edit.textContent).toContain('Change');
  });

  it('offers the story composer to members', async () => {
    renderCircle(JOINED_CIRCLE.id);

    await waitFor(() => {
      expect(document.getElementById('story-composer-btn')).toBeInTheDocument();
    });
  });

  it('hides the banner edit control on a circle the user does not own', async () => {
    // MOCK_CIRCLES[0] is owned by someone else and not joined.
    renderCircle(MOCK_CIRCLES[0].id);

    await waitFor(() => {
      expect(document.getElementById('circle-detail-screen')).toBeInTheDocument();
    });
    expect(document.getElementById('circle-banner-edit')).not.toBeInTheDocument();
    // Non-members get no rail and no composer either.
    expect(document.getElementById('story-composer-btn')).not.toBeInTheDocument();
  });
});
