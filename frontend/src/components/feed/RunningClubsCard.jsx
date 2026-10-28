import { Link } from 'react-router-dom';
import './RunningClubsCard.css';

export default function RunningClubsCard() {
  return (
    <section className="running-clubs" aria-label="Running communities" id="running-clubs-pinned">
      <div className="running-clubs-card">
        <img className="running-clubs-banner" src="/running-clubs/ban.jpg" alt="Great Ethiopian Run runners at the race start" width="600" height="180" fetchPriority="high" />
        <div className="running-clubs-body">
          <span className="running-clubs-eyebrow">Pinned · Addis Ababa &amp; Hawassa</span>
          <h2>GreatRun 10K — Find your running community</h2>
          <p>Train together and build your confidence one run at a time. Find running and fitness communities in Addis Ababa and Hawassa.</p>
          <Link to="/running-clubs" className="running-clubs-button">Explore Running Communities</Link>
        </div>
      </div>
    </section>
  );
}
