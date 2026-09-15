import Icon from '../../components/Icon';
import StravaStats from '../../components/StravaStats';

const STRAVA_STATS = [
  ['distance', 'Distance'],
  ['calories', 'Calories'],
  ['moving_time', 'Active time'],
  ['elevation', 'Elevation'],
  ['activity_count', 'Activity count'],
  ['recent_activities', 'Recent activities'],
];

export default function IntegrationsSection({ strava, stravaBusy, connectStrava, handleDisconnectStrava, toggleStravaStat }) {
  return (
    <div className="profile-section">
      <div className="profile-section-title">Strava Activity</div>
      <div className="profile-card">
        {strava?.connected ? (
          <>
            <div className="flex justify-between items-center mb-16">
              <div><strong className="inline-icon-text"><Icon name="check" size={14} /> Connected to Strava</strong><p className="text-xs text-secondary">Choose what appears on your public profile.</p></div>
              <button className="btn btn-secondary btn-sm" disabled={stravaBusy} onClick={handleDisconnectStrava}>Disconnect</button>
            </div>
            <div className="strava-toggles">
              {STRAVA_STATS.map(([key, label]) => (
                <label className="checkbox-row" key={key}>
                  <input type="checkbox" checked={(strava.visible_stats || []).includes(key)} onChange={() => toggleStravaStat(key)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <h3 className="text-sm mt-16 mb-8">Public profile preview</h3>
            <StravaStats stats={strava} preview />
          </>
        ) : (
          <div className="strava-connect">
            <div className="strava-logo" aria-hidden="true">STRAVA</div>
            <p className="text-sm text-secondary mb-12">Connect Strava to share selected activity totals and recent workouts on your profile.</p>
            <button className="btn btn-strava btn-block" disabled={stravaBusy} onClick={connectStrava}>Connect with Strava</button>
          </div>
        )}
      </div>
    </div>
  );
}
