export default function FeedEvent({ event }) {
  const timeAgo = getTimeAgo(event.created_at);

  const actionText = {
    join: <><strong>{event.user_name}</strong> joined the circle</>,
    checkin: <><strong>{event.user_name}</strong> checked in today</>,
    booking: (
      <>
        <strong>{event.user_name}</strong> booked{' '}
        {event.event_metadata?.service_name || 'a service'}
        {event.event_metadata?.amount && ` · ETB ${event.event_metadata.amount.toLocaleString()}`}
      </>
    )
  };

  const typeIcon = {
    join: '🤝',
    checkin: '✅',
    booking: '📅'
  };

  return (
    <div className="feed-event" id={`feed-event-${event.id}`}>
      <div className="feed-avatar">
        {event.user_photo ? (
          <img src={event.user_photo} alt={event.user_name} />
        ) : (
          event.user_name?.[0] || '?'
        )}
      </div>
      <div className="feed-content">
        <div className="feed-action">{actionText[event.event_type] || event.event_type}</div>
        <div className="feed-time">{timeAgo}</div>
      </div>
      <span className="feed-type-icon">{typeIcon[event.event_type] || '📌'}</span>
    </div>
  );
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
