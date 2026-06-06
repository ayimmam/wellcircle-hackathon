import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { INTEREST_CATEGORIES, EXERCISE_FREQUENCIES, MOCK_COMMUNITIES } from '../data/mock';

const STEPS = ['name', 'goal', 'interest', 'frequency', 'circles'];

export default function OnboardingFlow() {
  const { user, onboard } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    goal: '',
    interest_category: '',
    exercise_frequency: '',
    suggested_circle_ids: []
  });

  const currentStep = STEPS[step];
  const canNext = () => {
    if (currentStep === 'name') return formData.name.trim().length > 0;
    if (currentStep === 'goal') return true; // optional
    if (currentStep === 'interest') return formData.interest_category !== '';
    if (currentStep === 'frequency') return formData.exercise_frequency !== '';
    if (currentStep === 'circles') return true; // optional
    return false;
  };

  const suggestedCircles = MOCK_COMMUNITIES.filter(
    c => c.category === formData.interest_category
  ).slice(0, 4);

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
      return;
    }
    // Final step — submit
    setLoading(true);
    try {
      await onboard(formData);
      navigate('/home', { replace: true });
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
      {/* Progress dots */}
      <div className="onboarding-progress">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`progress-dot ${i === step ? 'active' : i < step ? 'done' : ''}`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="onboarding-step" key={currentStep}>
        {currentStep === 'name' && (
          <>
            <div className="onboarding-emoji">👋</div>
            <h2 className="onboarding-title">What's your name?</h2>
            <p className="onboarding-subtitle">
              This is how others will see you in Well Circle communities.
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
              Pick your main wellness interest. We'll suggest the best circles for you.
            </p>
            <div className="option-grid">
              {INTEREST_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  className={`option-card ${formData.interest_category === cat.value ? 'selected' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, interest_category: cat.value }))}
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
            <div className="onboarding-emoji">📊</div>
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
                  <div>
                    <div className="option-card-label">{freq.label}</div>
                    <div className="option-card-desc">{freq.desc}</div>
                  </div>
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
              Here are some communities based on your interests. This is optional — you can join later too.
            </p>
            <div className="flex-col gap-8">
              {suggestedCircles.length > 0 ? suggestedCircles.map(c => (
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
              )) : (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-text">No circles found for your interest yet.</div>
                </div>
              )}
            </div>
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
