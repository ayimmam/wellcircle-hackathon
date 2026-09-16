import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StoryRail from '../components/stories/StoryRail';

// Public, user-level stories (WS1 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md)
// — no circle scoping. StoryViewer uses useNavigate() (the author-name link
// and the Follow button both route), so anything that can open it needs a
// Router in the tree.

const story = (over = {}) => ({
  id: 'st-1',
  user_id: 'u-1',
  user_name: 'Hana Girma',
  user_photo_url: null,
  image_url: 'https://images.unsplash.com/photo-1',
  created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
  expires_at: new Date(Date.now() + 60 * 3600 * 1000).toISOString(),
  seen: false,
  view_count: null,
  is_mine: false,
  ...over,
});

const group = (over = {}) => ({
  user_id: 'u-1',
  user_name: 'Hana Girma',
  user_photo_url: null,
  is_mine: false,
  is_following: false,
  has_unseen: true,
  story_count: 1,
  stories: [story()],
  latest_at: story().created_at,
  ...over,
});

function renderRail(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('StoryRail', () => {
  it('renders nothing when there are no stories and no add tile', () => {
    const { container } = render(<StoryRail groups={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('marks an unseen group with the green ring and a seen group without it', () => {
    renderRail(
      <StoryRail
        groups={[
          group(),
          group({
            user_id: 'u-2',
            user_name: 'Dawit Bekele',
            has_unseen: false,
            stories: [story({ id: 'st-2', user_id: 'u-2', seen: true })],
          }),
        ]}
      />
    );
    expect(document.querySelectorAll('.story-ring--unseen')).toHaveLength(1);
    expect(document.querySelectorAll('.story-ring--seen')).toHaveLength(1);
  });

  it('shows an add tile only when the viewer can post and has no story yet', () => {
    const { rerender } = render(
      <MemoryRouter><StoryRail groups={[group()]} canAddStory /></MemoryRouter>
    );
    expect(document.getElementById('story-add-tile')).toBeInTheDocument();

    rerender(
      <MemoryRouter><StoryRail groups={[group({ is_mine: true })]} canAddStory /></MemoryRouter>
    );
    expect(document.getElementById('story-add-tile')).not.toBeInTheDocument();
  });

  it('drops groups whose stories have all gone', () => {
    render(<StoryRail groups={[group({ stories: [] })]} />);
    expect(document.getElementById('story-rail')).not.toBeInTheDocument();
  });

  it('opens the viewer on tap and reports the first story as viewed', async () => {
    const onViewed = vi.fn();
    renderRail(<StoryRail groups={[group()]} onViewed={onViewed} />);

    fireEvent.click(screen.getByLabelText("Hana Girma's story"));

    await waitFor(() => {
      expect(document.getElementById('story-viewer')).toBeInTheDocument();
    });
    expect(onViewed).toHaveBeenCalledWith('st-1');
  });

  it('shows a progress arc and no viewer for a pending upload; tapping a failed one retries', () => {
    const onRetryFailed = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <StoryRail
          groups={[group({ is_mine: true, stories: [story({ is_mine: true, pending: true, progress: 40 })] })]}
          canAddStory
          onRetryFailed={onRetryFailed}
        />
      </MemoryRouter>
    );
    expect(document.querySelector('.story-ring--pending')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Your story'));
    expect(document.getElementById('story-viewer')).not.toBeInTheDocument(); // nothing to play yet

    rerender(
      <MemoryRouter>
        <StoryRail
          groups={[group({ is_mine: true, stories: [story({ is_mine: true, failed: true })] })]}
          canAddStory
          onRetryFailed={onRetryFailed}
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('Retry posting your story'));
    expect(onRetryFailed).toHaveBeenCalledTimes(1);
  });
});

describe('StoryViewer', () => {
  const twoStories = group({
    story_count: 2,
    stories: [story(), story({ id: 'st-1b', created_at: new Date().toISOString() })],
  });

  it('advances through a group and closes at the end', async () => {
    renderRail(<StoryRail groups={[twoStories]} onViewed={() => {}} />);
    fireEvent.click(screen.getByLabelText("Hana Girma's story"));
    await waitFor(() => expect(document.getElementById('story-viewer')).toBeInTheDocument());

    // One progress bar per story in the group.
    expect(document.querySelectorAll('.story-progress-track')).toHaveLength(2);

    fireEvent.click(screen.getByLabelText('Next story'));
    fireEvent.click(screen.getByLabelText('Next story'));

    // Past the last story of the last group, the viewer closes.
    await waitFor(() => {
      expect(document.getElementById('story-viewer')).not.toBeInTheDocument();
    });
  });

  it('shows a viewer count and a delete control only on your own story', async () => {
    const onDelete = vi.fn();
    renderRail(
      <StoryRail
        groups={[group({ is_mine: true, stories: [story({ is_mine: true, view_count: 7 })] })]}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByLabelText('Your story'));
    await waitFor(() => expect(document.getElementById('story-viewer')).toBeInTheDocument());

    expect(screen.getByText('7')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Delete story'));
    expect(onDelete).toHaveBeenCalledWith('st-1');
  });

  it('hides the viewer count and the Follow button on your own story', async () => {
    renderRail(
      <StoryRail groups={[group({ is_mine: true })]} />
    );
    fireEvent.click(screen.getByLabelText('Your story'));
    await waitFor(() => expect(document.getElementById('story-viewer')).toBeInTheDocument());

    expect(document.querySelector('.story-viewer-count')).toBeNull();
    expect(screen.queryByRole('button', { name: /follow/i })).toBeNull();
  });

  it("shows a Follow button on someone else's story, and Following once toggled", async () => {
    renderRail(<StoryRail groups={[group({ is_following: false })]} />);
    fireEvent.click(screen.getByLabelText("Hana Girma's story"));
    await waitFor(() => expect(document.getElementById('story-viewer')).toBeInTheDocument());

    const followBtn = screen.getByRole('button', { name: 'Follow' });
    fireEvent.click(followBtn);
    // Optimistic — flips before any request resolves.
    expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument();
  });
});
