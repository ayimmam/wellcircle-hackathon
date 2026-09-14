import Icon from '../../components/Icon';
import SmartImage from '../../components/SmartImage';
import VerifiedBadge from '../../components/VerifiedBadge';

// Identity, tier, and the two social counts, on one card. The bio sits
// behind an explicit Edit action: a permanently open textarea made the top
// of the screen read as a form rather than as a profile.
export default function ProfileHeader({
  user, tier, navigate, t,
  bio, setBio, editingBio, setEditingBio, savingBio, saveBio,
}) {
  return (
    <div className="profile-header">
      <div className="profile-avatar">
        <SmartImage
          src={user.photo_url}
          alt={user.name}
          width={72}
          priority
          fallback={<Icon name="user" size={36} strokeWidth={1.5} />}
        />
      </div>
      <h1 className="profile-name">{user.name} {user.is_verified_trainer && <VerifiedBadge compact />}</h1>
      <p className="profile-handle">@{user.telegram_handle}</p>

      <div className="profile-tier">
        <Icon name="leaf" size={15} style={{ color: tier.color }} />
        <span>{tier.name}</span>
      </div>

      {editingBio ? (
        <div className="profile-bio-editor">
          <textarea
            className="input"
            maxLength={300}
            value={bio}
            onChange={event => setBio(event.target.value)}
            placeholder="Share your wellness journey..."
            aria-label="Profile bio"
            autoFocus
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-secondary">{bio.length}/300</span>
            <div className="flex gap-8">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setBio(user.bio || ''); setEditingBio(false); }}
              >
                {t('Cancel')}
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={savingBio || bio === (user.bio || '')}
                onClick={saveBio}
                id="save-bio-btn"
              >
                {savingBio ? 'Saving…' : 'Save bio'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="profile-bio-display">
          {user.bio
            ? <p className="profile-bio-text">{user.bio}</p>
            : <p className="profile-bio-text empty">{t('Share your wellness journey…')}</p>}
          <button
            className="profile-bio-edit-btn"
            onClick={() => setEditingBio(true)}
            id="edit-bio-btn"
            aria-label="Edit bio"
          >
            <Icon name="pencil" size={14} /> {user.bio ? t('Edit') : t('Add a bio')}
          </button>
        </div>
      )}

      <div className="profile-connections">
        <button onClick={() => navigate(`/users/${user.id}/followers`)}><strong>{user.follower_count || 0}</strong> Followers</button>
        <span>·</span>
        <button onClick={() => navigate(`/users/${user.id}/following`)}><strong>{user.following_count || 0}</strong> Following</button>
      </div>
    </div>
  );
}
