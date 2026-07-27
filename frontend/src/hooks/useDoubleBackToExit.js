import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { showToast } from '../components/Toast';

let backPressCount = 0;
let backPressTimer = null;

export default function useDoubleBackToExit() {
  const location = useLocation();

  useEffect(() => {
    // We only want to intercept back presses on root/tab screens
    const isRootScreen = ['/home', '/explore', '/community', '/profile'].includes(location.pathname);
    
    if (isRootScreen) {
      // Push a dummy state so there's always something to pop
      window.history.pushState({ isDummy: true }, '');

      const handlePopState = (event) => {
        backPressCount += 1;
        
        if (backPressCount === 1) {
          // First back press: show toast and push dummy state again to prevent exit
          showToast('Swipe back again to exit');
          window.history.pushState({ isDummy: true }, '');
          
          backPressTimer = setTimeout(() => {
            backPressCount = 0;
          }, 2000);
        } else if (backPressCount === 2) {
          // Second back press within 2 seconds: let it close
          clearTimeout(backPressTimer);
          if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.close();
          } else {
            window.history.back(); // Or just let it pop normally
          }
        }
      };

      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
        clearTimeout(backPressTimer);
      };
    }
  }, [location.pathname]);
}
