import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toast';

let backPressCount = 0;
let backPressTimer = null;

export default function useDoubleBackToExit() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const isRootScreen = ['/home', '/explore', '/community', '/profile'].includes(location.pathname);
    
    // Always push a dummy state so we can intercept the physical back button
    window.history.pushState({ isDummy: true }, '');

    const handlePopState = (event) => {
      if (!isRootScreen) {
        // If not on a root screen, physical back button should just go back in React Router
        navigate(-1);
        return;
      }

      // Root screen logic: Double back to exit
      backPressCount += 1;
      
      if (backPressCount === 1) {
        showToast('Swipe back again to exit');
        window.history.pushState({ isDummy: true }, '');
        
        backPressTimer = setTimeout(() => {
          backPressCount = 0;
        }, 2000);
      } else if (backPressCount === 2) {
        clearTimeout(backPressTimer);
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.close();
        } else {
          window.history.back();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearTimeout(backPressTimer);
    };
  }, [location.pathname, navigate]);
}
