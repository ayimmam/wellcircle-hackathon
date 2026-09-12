/**
 * MeetTheTeamSheet
 *
 * A native-style bottom sheet showcasing the 4 team members who built Well
 * Circle.  Uses the existing `.sheet` / `.sheet-overlay` / `.sheet-handle`
 * CSS primitives so the animation, overlay scrim, drag-indicator, and
 * dark-mode behaviour are automatically consistent with every other sheet in
 * the app.
 *
 * Portraits: drop real photos into /public/team/ and set `photo` on each
 * member object below.  Until real images arrive the component falls back to
 * a generated initials avatar so the layout is always fully rendered.
 *
 * Contact row icons use Lucide via the existing <Icon> component.
 * All three contact methods (LinkedIn, phone, email) are real anchor tags so
 * they work correctly inside Telegram's in-app browser without any JS shims.
 */

import Icon from './Icon';

// ─── Team data ──────────────────────────────────────────────────────────────
// Replace placeholder values with real data when you have it.
// `photo` must be a path relative to /public (e.g. '/team/yoni.jpg') or null.
const TEAM = [
  {
    id: 'anteneh',
    name: 'Anteneh Yimmam',
    role: 'Product Manager',
    photo: '/team/anteneh.JPG',
    linkedin: 'https://www.linkedin.com/in/anteneh-yimmam0/',
    email: 'anteneh@wellcircle.et',
  },
  {
    id: 'yonatan',
    name: 'Yonatan Berihun',
    role: 'Fullstack Software Engineer',
    photo: '/team/yonatan.png',
    linkedin: 'https://www.linkedin.com/in/yoni-berihun/',
    email: 'yonatan@wellcircle.et',
  },
  {
    id: 'bezawit',
    name: 'Bezawit Assefa',
    role: 'Data Engineer',
    photo: '/team/bezawit.jpg',
    linkedin: 'https://www.linkedin.com/in/bezawit-assefa-4964592aa/',
    email: 'bezawit@wellcircle.et',
  },
  {
    id: 'biniyam',
    name: 'Biniyam Fisseha',
    role: 'Software Developer',
    photo: '/team/biniyam.png',
    linkedin: 'https://www.linkedin.com/in/biniyam-fisseha/',
    email: 'biniyam@wellcircle.et',
  },

];

// ─── Initials avatar fallback ────────────────────────────────────────────────
const AVATAR_COLORS = ['#007AFF', '#059669', '#8B5CF6', '#E11D48'];

function InitialsAvatar({ name, index }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const bg = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <div
      aria-hidden="true"
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.15rem',
        fontWeight: 800,
        color: '#fff',
        letterSpacing: '0.02em',
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  );
}

// ─── Single team card ────────────────────────────────────────────────────────
function TeamCard({ member, index }) {
  return (
    <div className="team-card">
      {/* Portrait */}
      <div className="team-card-avatar">
        {member.photo ? (
          <img
            src={member.photo}
            alt={member.name}
            className="team-card-avatar-img"
          />
        ) : (
          <InitialsAvatar name={member.name} index={index} />
        )}
      </div>

      {/* Name + role */}
      <div className="team-card-name">{member.name}</div>
      <div className="team-card-role">{member.role}</div>

      {/* Contact row */}
      <div className="team-card-contacts">
        <a
          href={member.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="team-contact-btn"
          aria-label={`${member.name} on LinkedIn`}
        >
          <Icon name="linkedin" size={15} />
        </a>
        <a
          href={`mailto:${member.email}`}
          className="team-contact-btn"
          aria-label={`Email ${member.name}`}
        >
          <Icon name="mail" size={15} />
        </a>
      </div>
    </div>
  );
}

// ─── Bottom sheet ────────────────────────────────────────────────────────────
export default function MeetTheTeamSheet({ onClose }) {
  return (
    <>
      {/* Dimmed background — tap to dismiss */}
      <div
        className="sheet-overlay"
        onClick={onClose}
        aria-label="Close team sheet"
      />

      <div className="sheet" id="meet-the-team-sheet" role="dialog" aria-modal="true" aria-label="Meet the team">
        {/* Drag indicator */}
        <div className="sheet-handle" />

        {/* Header */}
        <div className="team-sheet-header">
          <h3 className="sheet-title" style={{ marginBottom: 0 }}>
            Meet the Team 👨💻
          </h3>
          <button
            className="btn btn-icon btn-secondary"
            onClick={onClose}
            aria-label="Close"
            id="team-sheet-close-btn"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <p className="team-sheet-sub">
          The people who shipped Well Circle, working day and night. 🚀
        </p>

        {/* 2 × 2 grid of cards */}
        <div className="team-grid">
          {TEAM.map((member, i) => (
            <TeamCard key={member.id} member={member} index={i} />
          ))}
        </div>
      </div>
    </>
  );
}
