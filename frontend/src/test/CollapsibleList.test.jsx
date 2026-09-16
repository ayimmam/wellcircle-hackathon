import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CollapsibleList from '../components/CollapsibleList';

const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

describe('CollapsibleList', () => {
  it('shows only the first `max` items, with a toggle to reveal the rest', () => {
    render(
      <CollapsibleList
        items={items}
        max={2}
        keyFn={i => i.id}
        renderItem={i => <span>Item {i.id}</span>}
      />
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.queryByText('Item 3')).toBeNull();
    expect(screen.queryByText('Item 4')).toBeNull();
    expect(screen.queryByText('Item 5')).toBeNull();

    const toggle = screen.getByRole('button', { name: /show 3 more/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);

    expect(screen.getByText('Item 3')).toBeInTheDocument();
    expect(screen.getByText('Item 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show less/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders no toggle when there are at most `max` items', () => {
    render(
      <CollapsibleList
        items={items.slice(0, 2)}
        max={2}
        keyFn={i => i.id}
        renderItem={i => <span>Item {i.id}</span>}
      />
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders nothing for an empty or missing list', () => {
    const { container: empty } = render(
      <CollapsibleList items={[]} renderItem={i => <span>{i}</span>} />
    );
    expect(empty.firstChild).toBeNull();

    const { container: missing } = render(
      <CollapsibleList items={undefined} renderItem={i => <span>{i}</span>} />
    );
    expect(missing.firstChild).toBeNull();
  });
});
