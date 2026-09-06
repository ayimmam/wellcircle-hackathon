import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import newLogo from '../new_logo.png';

export default function SplashScreen() {
  const { user, loading, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    if (!user.is_onboarded) {
      navigate('/onboarding', { replace: true });
    } else {
      navigate('/home', { replace: true });
    }
  }, [loading, user, error, navigate]);

  return (
    <div className="splash" id="splash-screen">
      <img src={newLogo} className="splash-logo" alt="Well Circle Logo" />
      <h1 className="splash-title">Well Circle</h1>
      <p className="splash-tagline">
        Your tribe, your wellness.<br />Now on the web.
      </p>
      <div className="splash-spinner" />
    </div>
  );
}
