import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { INTEREST_CATEGORIES, EXERCISE_FREQUENCIES, MOCK_COMMUNITIES } from '../data/mock';
import { track } from '../analytics';
import { getCircles, createCircle, joinCircle } from '../api/client';
import { shareCircleInvite } from '../utils/circleInvite';
import { showToast } from '../components/Toast';

const STEPS = ['name', 'goal', 'interest', 'frequency', 'circles'];
// Smart default: most users land mid-scale, and a pre-selected card means the
// Next button is never dead on this step. Interest is deliberately NOT
// defaulted — it drives circle suggestions, so a wrong default poisons them.
const DEFAULT_FREQUENCY = 'sometimes';

export default function OnboardingFlow() {
  const { user, onboard } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    goal: '',
    interest_categories: [],
    exercise_frequency: DEFAULT_FREQUENCY,
    suggested_circle_ids: []
  });

  // Real (user-created) circles — separate from the interest-matched
  // Community suggestions below. Joining/creating one happens immediately
  // (not deferred to final submit), matching how circles already work
  // everywhere else in the app (CircleDetailScreen).
  const [availableCircles, setAvailableCircles] = useState([]);
  const [committedCircle, setCommittedCircle] = useState(null); // created/joined this session
  const [newCircleName, setNewCircleName] = useState('');
  const [creatingCircle, setCreatingCircle] = useState(false);
  const [joiningCircleId, setJoiningCircleId] = useState(null);

  useEffect(() => {
    getCircles().then(res => setAvailableCircles(res.circles || [])).catch(() => {});
  }, []);

  useEffect(() => {
    track('onboarding_step_view', {
      step: STEPS[step],
      step_index: step,
      defaulted: STEPS[step] === 'frequency',
    });
  }, [step]);

  const currentStep = STEPS[step];
  const canNext = () => {
    if (currentStep === 'name') return formData.name.trim().length > 0;
    if (currentStep === 'goal') return true; // optional
    if (currentStep === 'interest') return formData.interest_categories.length > 0;
    if (currentStep === 'frequency') return formData.exercise_frequency !== '';
    if (currentStep === 'circles') return true; // optional
    return false;
  };

  const toggleInterest = (value) => {
    setFormData(prev => ({
      ...prev,
      interest_categories: prev.interest_categories.includes(value)
        ? prev.interest_categories.filter(v => v !== value)
        : [...prev.interest_categories, value]
    }));
  };

  const suggestedCircles = MOCK_COMMUNITIES.filter(
    c => formData.interest_categories.includes(c.category)
  ).slice(0, 4);

  const joinableCircles = availableCircles
    .filter(c => !c.is_joined && !c.is_private && c.id !== committedCircle?.id)
    .slice(0, 4);

  const handleJoinCircle = async (circle) => {
    setJoiningCircleId(circle.id);
    try {
      const res = await joinCircle(circle.id);
      setCommittedCircle({ id: circle.id, name: circle.name, join_code: res.join_code });
      track('circle_joined', { circle_id: circle.id, source: 'onboarding' });
      showToast(`Joined ${circle.name}!`, 'success');
    } catch {
      showToast('Could not join circle', 'error');
    } finally {
      setJoiningCircleId(null);
    }
  };

  const handleCreateCircle = async () => {
    if (!newCircleName.trim()) return;
    setCreatingCircle(true);
    try {
      const res = await createCircle({ name: newCircleName.trim() });
      setCommittedCircle({ id: res.id, name: res.name, join_code: res.join_code });
      track('circle_created', { source: 'onboarding' });
      showToast(`"${res.name}" created!`, 'success');
      setNewCircleName('');
    } catch {
      showToast('Could not create circle', 'error');
    } finally {
      setCreatingCircle(false);
    }
  };

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
      return;
    }
    // Final step — submit
    setLoading(true);
    try {
      const res = await onboard(formData);
      track('onboarding_complete', {
        circles_joined: formData.suggested_circle_ids.length,
        has_goal: formData.goal.trim().length > 0,
        frequency_changed_from_default: formData.exercise_frequency !== DEFAULT_FREQUENCY,
        welcome_points: res?.welcome_points ?? 0,
      });
      // justOnboarded → HomeScreen shows the one-time completion banner
      navigate('/home', { replace: true, state: { justOnboarded: true } });
    } catch (err) {
      console.error('Onboarding failed:', err);
      alert(err.message || 'Onboarding failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const toggleCircle = (id) => {
    setFormData(prev => ({
      ...prev,
      suggested_circle_ids: prev.suggested_circle_ids.includes(id)
        ? prev.suggested_circle_ids.filter(x => x !== id)
        : [...prev.suggested_circle_ids, id]
    }));
  };

  return (
    <div className="onboarding" id="onboarding-screen">
      {/* Progress dots — the name step renders as already done (endowed
          progress: Telegram gave us the name, so the journey starts at 1/5) */}
      <div className="onboarding-progress">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`progress-dot ${i === step ? 'active' : ''} ${(i < step || i === 0) ? 'done' : ''}`.trim()}
          />
        ))}
      </div>
      {step === 0 && (
        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 6 }}>
          1 of {STEPS.length} already done ✓
        </p>
      )}

      {/* Step content */}
      <div className="onboarding-step" key={currentStep}>
        {currentStep === 'name' && (
          <>
            <div className="onboarding-emoji">👋</div>
            <h2 className="onboarding-title">What's your name?</h2>
            <p className="onboarding-subtitle">
              {formData.name
                ? 'We got this from Telegram — just confirm, or change how others see you.'
                : 'This is how others will see you in Well Circle communities.'}
            </p>
            <input
              className="onboarding-input"
              placeholder="Enter your name"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              autoFocus
              id="onboarding-name-input"
            />
          </>
        )}

        {currentStep === 'goal' && (
          <>
            <div className="onboarding-emoji">🎯</div>
            <h2 className="onboarding-title">What's your wellness goal?</h2>
            <p className="onboarding-subtitle">
              This helps us personalise your experience. You can skip this.
            </p>
            <input
              className="onboarding-input"
              placeholder="e.g. Lose weight and stay consistent"
              value={formData.goal}
              onChange={e => setFormData(prev => ({ ...prev, goal: e.target.value }))}
              autoFocus
              id="onboarding-goal-input"
            />
          </>
        )}

        {currentStep === 'interest' && (
          <>
            <div className="onboarding-emoji">💡</div>
            <h2 className="onboarding-title">What interests you most?</h2>
            <p className="onboarding-subtitle">
              Pick as many as you like — we'll suggest the best circles for you.
            </p>
            <div className="option-grid">
              {INTEREST_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  className={`option-card ${formData.interest_categories.includes(cat.value) ? 'selected' : ''}`}
                  onClick={() => toggleInterest(cat.value)}
                  id={`interest-${cat.value}`}
                >
                  <div className="option-card-emoji">{cat.emoji}</div>
                  <div className="option-card-label">{cat.label}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {currentStep === 'frequency' && (
          <>
            <div className="onboarding-emoji">💪</div>
            <h2 className="onboarding-title">How often do you exercise?</h2>
            <p className="onboarding-subtitle">
              No judgment — we're here to help you grow.
            </p>
            <div className="flex-col gap-8">
              {EXERCISE_FREQUENCIES.map(freq => (
                <button
                  key={freq.value}
                  className={`option-card ${formData.exercise_frequency === freq.value ? 'selected' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, exercise_frequency: freq.value }))}
                  style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
                  id={`frequency-${freq.value}`}
                >
                  <span style={{ fontSize: '1.4rem' }}>{freq.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div className="option-card-label">{freq.label}</div>
                    <div className="option-card-desc">{freq.desc}</div>
                  </div>
                  {freq.value === DEFAULT_FREQUENCY && (
                    <span
                      className="chip"
                      style={{ padding: '3px 8px', fontSize: '0.65rem', fontWeight: 700 }}
                      id="most-popular-chip"
                    >
                      Most popular
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {currentStep === 'circles' && (
          <>
            <div className="onboarding-emoji">🤝</div>
            <h2 className="onboarding-title">Join a circle</h2>
            <p className="onboarding-subtitle">
              Circles are small accountability groups — check in together, cheer each other on, and stay consistent as a team.
            </p>

            {suggestedCircles.length > 0 && (
              <>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', margin: '4px 0 8px' }}>
                  Recommended for you
                </div>
                <div className="flex-col gap-8 mb-16">
                  {suggestedCircles.map(c => (
                    <button
                      key={c.id}
                      className={`option-card ${formData.suggested_circle_ids.includes(c.id) ? 'selected' : ''}`}
                      onClick={() => toggleCircle(c.id)}
                      style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
                      id={`circle-${c.id}`}
                    >
                      <span style={{ fontSize: '1.4rem' }}>🌿</span>
                      <div style={{ flex: 1 }}>
                        <div className="option-card-label">{c.name}</div>
                        <div className="option-card-desc">by {c.provider_name} · 👥 {c.member_count}</div>
                      </div>
                      {formData.suggested_circle_ids.includes(c.id) && (
                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {joinableCircles.length > 0 && (
              <>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', margin: '4px 0 8px' }}>
                  Available Circles
                </div>
                <div className="flex-col gap-8 mb-16">
                  {joinableCircles.map(c => (
                    <div
                      key={c.id}
                      className="option-card"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'default' }}
                      id={`available-circle-${c.id}`}
                    >
                      <span style={{ fontSize: '1.4rem' }}>🌀</span>
                      <div style={{ flex: 1 }}>
                        <div className="option-card-label">{c.name}</div>
                        <div className="option-card-desc">👥 {c.member_count} members</div>
                      </div>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleJoinCircle(c)}
                        disabled={joiningCircleId === c.id}
                        id={`join-circle-${c.id}-btn`}
                      >
                        {joiningCircleId === c.id ? '…' : 'Join'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', margin: '4px 0 8px' }}>
              Or start your own
            </div>
            <div className="flex gap-8 mb-16">
              <input
                className="onboarding-input"
                placeholder="Circle name"
                value={newCircleName}
                onChange={e => setNewCircleName(e.target.value)}
                style={{ flex: 1 }}
                id="new-circle-name-input"
              />
              <button
                className="btn btn-secondary"
                onClick={handleCreateCircle}
                disabled={!newCircleName.trim() || creatingCircle}
                id="create-circle-btn"
              >
                {creatingCircle ? '…' : 'Create'}
              </button>
            </div>

            {committedCircle && (
              <div className="card mb-16" id="onboarding-circle-invite-card">
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: 1, fontSize: '0.85rem' }}>
                    You're in <b>{committedCircle.name}</b> — invite friends?
                  </span>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => shareCircleInvite(committedCircle, { source: 'onboarding' })}
                    id="onboarding-invite-btn"
                  >
                    📤 Invite
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="onboarding-actions">
        {step > 0 && (
          <button className="btn btn-secondary" onClick={handleBack} style={{ flex: 1 }}>
            Back
          </button>
        )}
        <button
          className="btn btn-primary btn-block"
          onClick={handleNext}
          disabled={!canNext() || loading}
          style={{ flex: step > 0 ? 2 : 1 }}
          id="onboarding-next-btn"
        >
          {loading ? 'Setting up...' : step === STEPS.length - 1 ? "Let's Go! 🚀" : (currentStep === 'goal' || currentStep === 'circles') ? 'Skip / Next →' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
