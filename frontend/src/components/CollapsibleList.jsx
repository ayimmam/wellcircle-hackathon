import { useState } from 'react';
import Icon from './Icon';

/**
 * Renders the first `max` items, with a minimal arrow to expand and see the
 * rest — Profile's Recent Activity and Joined Circles sections (WS4 of
 * docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md) were showing up to 5 items each
 * unconditionally, which read as a wall of history on a screen meant to be
 * scannable at a glance.
 *
 * `items`/`renderItem` follow the usual list-render contract (`renderItem`
 * returns one element per item, keyed by the caller); this component only
 * owns the show-more/show-less toggle.
 *
 * @param {{items: any[], renderItem: (item: any, index: number) => JSX.Element,
 *          max?: number, keyFn?: (item: any, index: number) => string|number}} props
 */
export default function CollapsibleList({ items, renderItem, max = 2, keyFn }) {
  const [expanded, setExpanded] = useState(false);

  if (!items || items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, max);
  const hasMore = items.length > max;

  return (
    <>
      {visible.map((item, i) => (
        <div key={keyFn ? keyFn(item, i) : i}>{renderItem(item, i)}</div>
      ))}
      {hasMore && (
        <button
          type="button"
          className="collapsible-list-toggle"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
            background: 'none', border: 'none', padding: '8px 4px',
            color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} />
          {expanded ? 'Show less' : `Show ${items.length - max} more`}
        </button>
      )}
    </>
  );
}
