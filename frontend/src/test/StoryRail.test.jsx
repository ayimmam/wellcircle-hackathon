import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StoryRail from '../components/stories/StoryRail';

const story = (over = {}) => ({
  id: 'st-1',
  circle_id: 'c-1',
  circle_name: 'Zen Seekers',
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
  has_unseen: true,
  story_count: 1,
  stories: [story()],
  latest_at: story().created_at,
  ...over,
});

describe('StoryRail', () => {
  it('renders nothing when there are no stories and no add tile', () => {
    const { container } = render(<StoryRail groups={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('marks an unseen group with the green ring and a seen group without it', () => {
    render(
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
    const { rerender } = render(<StoryRail groups={[group()]} canAddStory />);
    expect(document.getElementById('story-add-tile')).toBeInTheDocument();

    rerender(<StoryRail groups={[group({ is_mine: true })]} canAddStory />);
    expect(document.getElementById('story-add-tile')).not.toBeInTheDocument();
  });

  it('drops groups whose stories have all gone', () => {
    render(<StoryRail groups={[group({ stories: [] })]} />);
    expect(document.getElementById('story-rail')).not.toBeInTheDocument();
  });

  it('opens the viewer on tap and reports the first story as viewed', async () => {
    const onViewed = vi.fn();
    render(<StoryRail groups={[group()]} onViewed={onViewed} />);

    fireEvent.click(screen.getByLabelText("Hana Girma's story"));

    await waitFor(() => {
      expect(document.getElementById('story-viewer')).toBeInTheDocument();
    });
    expect(onViewed).toHaveBeenCalledWith('st-1');
  });
});

describe('StoryViewer', () => {
  const twoStories = group({
    story_count: 2,
    stories: [story(), story({ id: 'st-1b', created_at: new Date().toISOString() })],
  });

  it('advances through a group and closes at the end', async () => {
    const onClose = vi.fn();
    render(<StoryRail groups={[twoStories]} onViewed={() => {}} />);
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
    expect(onClose).not.toHaveBeenCalled(); // rail owns the open state
  });

  it('shows a viewer count and a delete control only on your own story', async () => {
    const onDelete = vi.fn();
    render(
      <StoryRail
        groups={[group({ is_mine: true, stories: [story({ is_mine: true, view_count: 7 })] })]}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByLabelText("Hana Girma's story"));
    await waitFor(() => expect(document.getElementById('story-viewer')).toBeInTheDocument());

    expect(screen.getByText('7')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Delete story'));
    expect(onDelete).toHaveBeenCalledWith('st-1');
  });

  it('hides the viewer count on someone else’s story', async () => {
    render(<StoryRail groups={[group()]} />);
    fireEvent.click(screen.getByLabelText("Hana Girma's story"));
    await waitFor(() => expect(document.getElementById('story-viewer')).toBeInTheDocument());

    expect(document.querySelector('.story-viewer-count')).toBeNull();
    expect(screen.queryByLabelText('Delete story')).toBeNull();
  });
});
