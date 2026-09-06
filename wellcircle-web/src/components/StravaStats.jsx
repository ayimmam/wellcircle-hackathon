function duration(seconds = 0) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

const statDefinitions = [
  // Aggregated backend distances are already expressed in kilometres.
  // distance_meters remains supported for older/mock payloads.
  ['distance', 'Distance', stats => `${(
    stats.distance_km
    ?? stats.distance
    ?? ((stats.distance_meters || 0) / 1000)
  ).toFixed(1)} km`],
  ['calories', 'Calories', stats => Math.round(stats.calories || 0).toLocaleString()],
  ['moving_time', 'Active time', stats => duration(stats.moving_time || stats.moving_time_seconds)],
  ['elevation', 'Elevation', stats => `${Math.round(stats.elevation || stats.total_elevation_gain || 0)} m`],
  ['activity_count', 'Activities', stats => stats.activity_count || 0],
];

export default function StravaStats({ stats, preview = false }) {
  if (!stats) return null;
  const visible = stats.visible_stats || [
    ...statDefinitions.map(([key]) => key).filter(key => Object.prototype.hasOwnProperty.call(stats, key)),
    ...(Object.prototype.hasOwnProperty.call(stats, 'recent_activities') ? ['recent_activities'] : []),
  ];
  const shown = statDefinitions.filter(([key]) => visible.includes(key));
  const activities = stats.recent_activities || [];

  return (
    <section className="strava-stats" aria-label={preview ? 'Strava stats preview' : 'Strava activity'}>
      <div className="strava-grid">
        {shown.map(([key, label, format]) => (
          <div className="strava-stat" key={key}>
            <strong>{format(stats)}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {visible.includes('recent_activities') && activities.length > 0 && (
        <div className="strava-activities">
          <h3>Recent Activities</h3>
          {activities.slice(0, 5).map(activity => (
            <div className="strava-activity" key={activity.id}>
              <div>
                <strong>{activity.name}</strong>
                <span>{activity.activity_type || activity.type} · {new Date(activity.start_date).toLocaleDateString()}</span>
              </div>
              <span>{(
                activity.distance_km
                ?? activity.distance
                ?? ((activity.distance_meters || 0) / 1000)
              ).toFixed(1)} km · {duration(activity.moving_time_seconds || activity.moving_time)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="strava-attribution" aria-label="Powered by Strava">
        <span className="strava-mark">STRAVA</span> Powered by Strava
      </div>
    </section>
  );
}
