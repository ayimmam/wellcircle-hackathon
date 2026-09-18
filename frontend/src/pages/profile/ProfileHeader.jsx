import { useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import Icon from '../../components/Icon';
import SmartImage from '../../components/SmartImage';
import VerifiedBadge from '../../components/VerifiedBadge';
import AvatarPicker, { dicebearUrl } from '../../components/AvatarPicker';
import TierProgressArc from '../../components/TierProgressArc';
import { useAuth } from '../../context/AuthContext';
import { changeProfilePhoto } from '../../api/client';
import { compressImage, ImageTooLargeError } from '../../utils/imageCompress';
import { showToast } from '../../components/Toast';
import useDismissOnEscape from '../../hooks/useDismissOnEscape';

const PHOTO_CHANGE_COST = 10;

// Identity, tier, and the two social counts, on one card. The bio sits
// behind an explicit Edit action: a permanently open textarea made the top
// of the screen read as a form rather than as a profile.
export default function ProfileHeader({
  user, tier, navigate, t,
  bio, setBio, editingBio, setEditingBio, savingBio, saveBio,
}) {
  const { setUser, updateProfile } = useAuth();
  const [costNoticeOpen, setCostNoticeOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const fileInputRef = useRef(null);
  useDismissOnEscape(() => setCostNoticeOpen(false), costNoticeOpen);
  useDismissOnEscape(() => setAvatarPickerOpen(false), avatarPickerOpen);

  const avatarSeed = user.avatar_vibe || user.telegram_handle || user.id || 'wellcircle';
  const hasPhoto = !!user.photo_url;

  const handlePickPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    let compressed;
    try {
      compressed = await compressImage(file, { maxBytes: 2_000_000 });
    } catch (err) {
      showToast(err instanceof ImageTooLargeError ? err.message : 'Could not read that photo', 'error');
      return;
    }

    // WS9 of docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md — swap the avatar and
    // drop the points badge immediately, before the upload+charge request
    // resolves; a failure restores both.
    const previousPhotoUrl = user.photo_url;
    const previousBalance = user.points_balance || 0;
    const localUrl = URL.createObjectURL(compressed);
    setUser(prev => (prev ? {
      ...prev,
      photo_url: localUrl,
      points_balance: Math.max(0, (prev.points_balance || 0) - PHOTO_CHANGE_COST),
    } : prev));

    try {
      const res = await changeProfilePhoto(compressed);
      setUser(prev => (prev ? { ...prev, photo_url: res.photo_url, points_balance: res.points_balance } : prev));
    } catch (err) {
      setUser(prev => (prev ? { ...prev, photo_url: previousPhotoUrl, points_balance: previousBalance } : prev));
      showToast(err.message || 'Could not change your photo', 'error');
    } finally {
      URL.revokeObjectURL(localUrl);
    }
  };

  const handleVibeSelect = async (vibeId) => {
    try {
      await updateProfile({ avatar_vibe: vibeId });
      setUser(prev => prev ? { ...prev, avatar_vibe: vibeId } : prev);
      setAvatarPickerOpen(false);
      showToast('Avatar updated!', 'success');
    } catch {
      showToast('Could not update avatar', 'error');
    }
  };

  return (
    <div className="profile-header">
      <div className="profile-avatar" style={{ position: 'relative' }}>
        {hasPhoto ? (
          <SmartImage
            src={user.photo_url}
            alt={user.name}
            width={72}
            priority
            fallback={
              <div className="profile-avatar-dicebear">
                <img src={dicebearUrl(avatarSeed, 72)} alt={user.name} width={72} height={72} />
              </div>
            }
          />
        ) : (
          <div className="profile-avatar-dicebear">
            <img src={dicebearUrl(avatarSeed, 72)} alt={user.name} width={72} height={72} />
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePickPhoto}
          style={{ display: 'none' }}
          id="profile-photo-input"
        />
        <button
          type="button"
          className="btn btn-icon btn-secondary"
          onClick={() => setAvatarPickerOpen(true)}
          aria-label="Edit avatar"
          id="profile-photo-camera-btn"
          style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Icon name="camera" size={14} />
        </button>
      </div>
      <h1 className="profile-name">{user.name} {user.is_verified_trainer && <VerifiedBadge compact />}</h1>
      <p className="profile-handle">@{user.telegram_handle}</p>

      {/* Tier progress arc replaces plain tier chip */}
      <TierProgressArc points={user.points_balance || 0} tier={tier} />

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

      {costNoticeOpen && (
        <div className="modal-overlay" onClick={() => setCostNoticeOpen(false)}>
          <div className="modal-card" onClick={event => event.stopPropagation()} id="profile-photo-cost-notice">
            <h2 className="card-title mb-8">Change your photo?</h2>
            <p className="text-sm text-secondary mb-16">Changing your photo costs {PHOTO_CHANGE_COST} points.</p>
            <div className="flex gap-8">
              <button className="btn btn-secondary" onClick={() => setCostNoticeOpen(false)}>{t('Cancel')}</button>
              <button
                className="btn btn-primary"
                onClick={() => { setCostNoticeOpen(false); fileInputRef.current?.click(); }}
                id="profile-photo-cost-notice-continue"
              >
                Choose photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar picker sheet */}
      <AnimatePresence>
        {avatarPickerOpen && (
          <AvatarPicker
            currentVibe={user.avatar_vibe}
            currentPhotoUrl={user.photo_url}
            onVibeSelect={handleVibeSelect}
            onPhotoClick={() => { setAvatarPickerOpen(false); setCostNoticeOpen(true); }}
            onClose={() => setAvatarPickerOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
