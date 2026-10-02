import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { rankCommunities, communityActivityLabel } from '../utils/communityDiscovery';
import CommunityStartCard from '../components/CommunityStartCard';

vi.mock('../analytics', () => ({ track: vi.fn() }));

function Location() {
  const location = useLocation();
  return <output>{location.pathname}:{location.state?.tab}</output>;
}

describe('community activation', () => {
  it('keeps relevance ahead of popularity and participation ahead of lifetime size', () => {
    const communities = [
      { id: 'unrelated', category: 'gym', active_members_7d: 100 },
      { id: 'quiet', category: 'yoga', member_count: 500 },
      { id: 'active', category: 'yoga', active_members_7d: 3, member_count: 5 },
    ];
    expect(rankCommunities(communities, ['yoga']).map(c => c.id)).toEqual(['active', 'quiet', 'unrelated']);
    expect(communities[0].id).toBe('unrelated');
    expect(communityActivityLabel(communities[1])).toBeNull();
    expect(communityActivityLabel({ active_members_7d: 0 })).toContain('Be the first');
  });

  it('opens Explore when there are no available communities', () => {
    render(<MemoryRouter><CommunityStartCard user={{}} /><Location /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Find a community' }));
    expect(screen.getByText('/community:explore')).toBeInTheDocument();
  });

  it('opens the relevant community directly', () => {
    render(<MemoryRouter><CommunityStartCard user={{ interest_categories: ['yoga'] }} communities={[
      { id: 'gym', name: 'Gym', category: 'gym', active_members_7d: 100 },
      { id: 'yoga', name: 'Yoga', category: 'yoga', active_members_7d: 2 },
    ]} /><Location /></MemoryRouter>);
    expect(screen.getByText('2 members checked in this week')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Meet this community' }));
    expect(screen.getByText('/community/yoga:')).toBeInTheDocument();
  });
});
