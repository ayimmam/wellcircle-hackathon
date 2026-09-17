import Icon from '../../components/Icon';
import VerifiedBadge from '../../components/VerifiedBadge';
import PhoneInput from '../../components/PhoneInput';
import CollapsibleList from '../../components/CollapsibleList';
import { parsePhone } from '../../utils/phone';
import { clickableDivProps } from '../../utils/a11y';

export default function AccountSection({
  user, t, navigate,
  pointsHistory, joinedCommunities, milestoneBadges,
  trainerStatus, verificationExpires,
  editingPhone, setEditingPhone, phoneEditResult, setPhoneEditResult, updateProfile, showToast,
  setShowBugReport,
}) {
  return (
    <>
      {/* Points Stats */}
      <div className="profile-section">
        <div className="profile-section-title" style={{ display: 'flex', alignItems: 'center' }}>
          Legacy Points
        </div>
        <div className="profile-card">
          <div className="profile-stat-row">
            <div>
              <div className="profile-stat-value">{user.points_balance || 0}</div>
              <div className="profile-stat-label">Balance</div>
            </div>
            <div>
              <div className="profile-stat-value" style={{ color: 'var(--accent)' }}>
                {pointsHistory?.items?.filter(i => i.points > 0).reduce((sum, i) => sum + i.points, 0) || 0}
              </div>
              <div className="profile-stat-label">Earned</div>
            </div>
            <div>
              <div className="profile-stat-value" style={{ color: 'var(--secondary)' }}>
                {joinedCommunities.length}
              </div>
              <div className="profile-stat-label">Circles</div>
            </div>
          </div>
        </div>
      </div>

      {/* Milestone badges — derived from existing fields (join date, tier,
          longest streak), not a separate achievements table. */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Milestones')}</div>
        <div className="profile-card" style={{ padding: '12px 14px' }}>
          <div className="flex gap-8" style={{ flexWrap: 'wrap' }} id="profile-milestone-badges">
            {milestoneBadges.map(badge => (
              <span
                key={badge.id}
                className="points-chip"
                id={`milestone-badge-${badge.id}`}
                title={badge.label}
              >
                <Icon name={badge.icon} size={13} />
                <span>{badge.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Points History — collapsed to 2 with a minimal expand arrow (WS4 of
          docs/AUDIT_IMPLEMENTATION_PLAN_SEP2026.md); the 5-item ceiling this
          already had is what "Show more" reveals. */}
      {pointsHistory?.items?.length > 0 && (
        <div className="profile-section">
          <div className="profile-section-title">{t('Recent Activity')}</div>
          <div className="profile-card" id="recent-activity-list">
            <CollapsibleList
              items={pointsHistory.items.slice(0, 5)}
              keyFn={(_, i) => i}
              renderItem={(item, i) => (
                <div
                  className="confirmation-row"
                  style={i === Math.min(4, pointsHistory.items.length - 1) ? { borderBottom: 'none' } : {}}
                >
                  <div>
                    <span className="inline-icon-text" style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      {item.action === 'checkin' ? <><Icon name="check" size={13} /> Check-in</>
                        : item.action === 'decay' ? <><Icon name="chart" size={13} /> Decay</>
                        : item.action === 'profile_photo' ? <><Icon name="camera" size={13} /> Profile photo</>
                        : item.action}
                    </span>
                    {item.community_name && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginLeft: 8 }}>
                        {item.community_name}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontWeight: 700,
                    color: item.points > 0 ? 'var(--accent)' : 'var(--danger)',
                    fontSize: '0.88rem'
                  }}>
                    {item.points > 0 ? `+${item.points}` : item.points}
                  </span>
                </div>
              )}
            />
          </div>
        </div>
      )}

      {/* Joined Circles — the strongest re-entry hook on this screen, so it
          sits with the other "what you're part of" content. Also collapsed
          to 2 with an expand arrow (WS4). */}
      {joinedCommunities.length > 0 && (
        <div className="profile-section">
          <div className="profile-section-title">{t('Joined Circles')}</div>
          <div className="flex-col gap-8" id="joined-circles-list">
            <CollapsibleList
              items={joinedCommunities}
              keyFn={c => c.id}
              renderItem={c => (
                <div
                  className="profile-card"
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                  aria-label={c.name}
                  {...clickableDivProps(() => navigate(`/community/${c.id}`))}
                >
                  <Icon name="leaf" size={20} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{c.name}</div>
                    <div className="inline-icon-text" style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}><Icon name="users" size={12} /> {c.member_count}</div>
                  </div>
                  <Icon name="chevron-right" size={16} className="text-tertiary" style={{ color: 'var(--text-tertiary)' }} />
                </div>
              )}
            />
          </div>
        </div>
      )}

      <div className="profile-section">
        <div className="profile-section-title">Trainer Verification</div>
        <div className="profile-card">
          {user.is_verified_trainer ? (
            <div>
              <VerifiedBadge />
              {verificationExpires && <p className="text-sm text-secondary mt-8">Valid until {new Date(verificationExpires).toLocaleDateString()}</p>}
              {verificationExpires && new Date(verificationExpires).getTime() - Date.now() < 30 * 86400000 && <button className="btn btn-secondary btn-sm mt-12" onClick={() => navigate('/trainer/verify')}>Renew</button>}
            </div>
          ) : trainerStatus?.status === 'pending' ? (
            <div className="flex justify-between items-center"><span>Verification pending</span><span className="status-badge pending">Under review</span></div>
          ) : trainerStatus?.status === 'approved' ? (
            <div><VerifiedBadge /><p className="text-sm text-secondary mt-8">Verification approved. Refreshing your profile badge…</p></div>
          ) : trainerStatus?.status === 'rejected' ? (
            <div>
              <strong>Application needs attention</strong>
              <p className="text-sm text-secondary mt-8">{trainerStatus.rejection_reason || 'Your application was not approved.'}</p>
              <button className="btn btn-primary btn-sm mt-12" onClick={() => navigate('/trainer/verify')}>Review and apply again</button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-secondary mb-12">Show your credentials, build trust, and unlock paid-circle eligibility.</p>
              <button className="btn btn-primary btn-block" onClick={() => navigate('/trainer/verify')}>Get Verified</button>
            </div>
          )}
        </div>
      </div>

      {/* Contact phone */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Contact')}</div>
        <div className="profile-card">
          {editingPhone ? (
            <div>
              <PhoneInput value={parsePhone(user?.phone_number)} onChange={setPhoneEditResult} />
              <div className="flex gap-8" style={{ marginTop: 10 }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!phoneEditResult.valid}
                  onClick={() => {
                    updateProfile({ phone_number: phoneEditResult.e164 }).then(() => {
                      showToast('Phone number updated', 'success');
                      setEditingPhone(false);
                    });
                  }}
                  id="save-phone-btn"
                >
                  {t('Save')}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditingPhone(false)}>
                  {t('Cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '0.95rem' }}>
                {user?.phone_number || <span style={{ color: 'var(--text-secondary)' }}>{t('No phone number saved')}</span>}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingPhone(true)} id="edit-phone-btn">
                {t('Edit')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Support */}
      <div className="profile-section">
        <div className="profile-section-title">{t('Support')}</div>
        <div
          className="profile-card"
          {...clickableDivProps(() => setShowBugReport(true))}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
          aria-label={t('Report a problem')}
          id="report-bug-row"
        >
          <Icon name="message-circle" size={20} />
          <div style={{ flex: 1, fontSize: '0.88rem', fontWeight: 600 }}>{t('Report a bug')}</div>
          <Icon name="chevron-right" size={16} className="text-tertiary" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </div>
    </>
  );
}
