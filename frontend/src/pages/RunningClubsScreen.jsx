import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { runningClubs } from '../data/runningClubs';
import '../components/feed/RunningClubsCard.css';

// Real anchors remain usable in browsers, with native Telegram navigation in the Mini App.
function ClubLink({ href, children, className = 'running-clubs-button' }) {
  function open(event) {
    const app = window.Telegram?.WebApp;
    const method = href.startsWith('https://t.me/') ? 'openTelegramLink' : 'openLink';
    if (href.startsWith('tel:') || import.meta.env.VITE_APP_SURFACE === 'web' || !app?.initData || typeof app[method] !== 'function') return;
    try {
      app[method](href);
      event.preventDefault();
    } catch { /* Leave the anchor's browser fallback available. */ }
  }
  return <a className={className} href={href} target={href.startsWith('tel:') ? undefined : '_blank'} rel="noopener noreferrer" onClick={open}>{children}</a>;
}

function DetailRows({ rows }) {
  return <dl className="running-clubs-rows">{rows.map(([label, value]) => (
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
  ))}</dl>;
}

export default function RunningClubsScreen() {
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const trigger = useRef(null);
  const firstOption = useRef(null);
  const club = runningClubs.find(item => item.id === selected);

  function pick(id) {
    setSelected(id);
    setExpanded(false);
    trigger.current?.focus();
  }

  return (
    <div className="page running-clubs" id="running-clubs-screen">
      <Link to="/home" className="running-clubs-reset">‹ Back to Home</Link>
      <h1>Running Communities</h1>
      <p>Find your crew in Addis Ababa and Hawassa. Contact the organizers to confirm the next session.</p>
      <div className="running-clubs-card running-clubs-body">
        <h2 id="running-clubs-label" className="running-clubs-eyebrow">Choose a community</h2>
        <button type="button" className="running-clubs-trigger" ref={trigger}
          aria-expanded={expanded} aria-controls="running-clubs-options"
          onClick={() => setExpanded(value => !value)}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setExpanded(true); requestAnimationFrame(() => firstOption.current?.focus()); }
            if (event.key === 'Escape') setExpanded(false);
          }}>
          {club?.image && <img src={club.image} alt="" width="40" height="40" />}
          <span>{club?.name || 'Choose a club'}</span><span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
        </button>
        <div id="running-clubs-options" hidden={!expanded} aria-labelledby="running-clubs-label"
          onKeyDown={event => {
            if (event.key === 'Escape') { setExpanded(false); trigger.current?.focus(); }
          }}>
          <div className="running-clubs-options">
            {runningClubs.map((item, index) => (
              <button key={item.id} type="button" ref={index === 0 ? firstOption : undefined}
                className={`running-clubs-option${selected === item.id ? ' is-selected' : ''}`}
                aria-pressed={selected === item.id} onClick={() => pick(item.id)}>
                {item.image ? <img src={item.image} alt="" width="40" height="40" loading="lazy" /> : <span className="running-clubs-initial" aria-hidden="true">{item.name[0]}</span>}
                <span>{item.name}<small>{item.city} · {item.subtitle}</small></span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {club && <article className="running-clubs-card" aria-label={club.name}>
        {club.image && <img className="running-clubs-hero" src={club.image} alt={club.name} width="600" height="220" loading="lazy" />}
        <div className="running-clubs-body">
          <div className="running-clubs-tags"><span>{club.city}</span>{club.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
          <h3>{club.name}</h3><p>{club.description}</p>
          <DetailRows rows={club.details} />
          {club.walk && <div className="running-clubs-walk">
            <h4>Wednesday Evening Walk</h4>
            <p>Previous announcement — not an upcoming event. Contact the club for the next walk.</p>
            <DetailRows rows={[
              ['Previous date', '18/02/2019 (Ethiopian calendar)'],
              ['Meet / depart', '12:00 / 12:35 (as announced; confirm the time convention with the club)'],
              ['Meet at', <>ፒያሳ መኮንን ባቅላባ ቤት · <ClubLink className="running-clubs-map" href="https://maps.app.goo.gl/5YEbz5rm8hppxf8p6?g_st=ipc">View map</ClubLink></>],
              ['Distance', '2–3 km · about 30–40 minutes'],
              ['Wear', 'Comfortable clothing and shoes'],
            ]} />
            <ClubLink href={club.url} className="running-clubs-button running-clubs-outline">Check Telegram for the Next Walk</ClubLink>
          </div>}
          {club.phones?.map(phone => <ClubLink key={phone} href={`tel:+251${phone.slice(1)}`}>Call {phone}</ClubLink>)}
          {club.url ? <ClubLink href={club.url}>{club.action}</ClubLink> : club.missingContact ? <p className="running-clubs-contact">{club.missingContact}</p> : null}
          <button type="button" className="running-clubs-reset" onClick={() => { setSelected(null); setExpanded(true); trigger.current?.focus(); }}>Back to all clubs</button>
        </div>
      </article>}

      <aside className="running-clubs-card running-clubs-body running-clubs-reminder">
        <h3>Before You Head Out</h3>
        <p>Schedules are a guide and may change. Contact the club by phone, Telegram or TikTok to confirm the next session, meeting point, local start time and any entrance fees before heading out.</p>
      </aside>
    </div>
  );
}
