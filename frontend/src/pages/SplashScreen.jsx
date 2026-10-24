import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import ErrorScreen from '../components/ErrorScreen';
import newLogo from '../new_logo.png';

export default function SplashScreen() {
  const { user, loading, error, login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (loading) return;
    if (error || !user) return;

    if (!user.is_onboarded) {
      navigate('/onboarding', { replace: true });
    } else {
      navigate('/home', { replace: true });
    }
  }, [loading, user, error, navigate]);

  return (
    <div className="splash" id="splash-screen">
      <img src={newLogo} className="splash-logo" alt="Well Circle Logo" width={88} height={88} />
      <h1 className="splash-title">Well Circle</h1>
      <p className="splash-tagline">
        {t('Your tribe, your wellness.')}<br />{t('Right where you chat.')}
      </p>
      {error ? (
        <ErrorScreen variant="auth" onRetry={() => login()} retryLabel="Retry" />
      ) : (
        <div className="splash-spinner" />
      )}
    </div>
  );
}
