import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/Toast';
import { COUNTRY_CODES, validatePhone } from '../utils/phone';
import newLogo from '../new_logo.png';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'WellCircleBot';
const BOT_ID = import.meta.env.VITE_TELEGRAM_BOT_ID || '7851608933';

export default function LoginScreen() {
  const { user, loginWithWhatsAppStart, loginWithWhatsAppVerify, loginWithTelegram } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [authMethod, setAuthMethod] = useState('whatsapp'); // 'whatsapp' | 'otp'
  const [countryCode, setCountryCode] = useState('+251');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formattedE164, setFormattedE164] = useState('');
  const [loading, setLoading] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [error, setError] = useState(null);

  // OTP state
  const [otpRequestId, setOtpRequestId] = useState(null);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const otpInputRefs = useRef([]);

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (!user.is_onboarded) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    }
  }, [user, navigate]);

  // Handle countdown timer for OTP resend
  useEffect(() => {
    if (authMethod !== 'otp' || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(c => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [authMethod, countdown]);

  // Listen for Telegram OAuth popup callback message
  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.origin !== 'https://oauth.telegram.org' && !event.data?.telegram_auth) return;
      try {
        const authData = event.data.telegram_auth || JSON.parse(event.data);
        if (authData?.id) {
          setTelegramLoading(true);
          await loginWithTelegram(authData);
          showToast('Signed in with Telegram!', 'success');
        }
      } catch (e) {
        console.warn('Telegram message parse error:', e);
      } finally {
        setTelegramLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loginWithTelegram]);

  // Global Telegram callback if widget iframe triggers it
  useEffect(() => {
    window.onWellCircleWebTelegramAuth = async (telegramUser) => {
      setTelegramLoading(true);
      setError(null);
      try {
        await loginWithTelegram(telegramUser);
        showToast('Signed in with Telegram!', 'success');
      } catch (err) {
        setError(err.message || 'Telegram login failed');
        showToast(err.message || 'Telegram login failed', 'error');
      } finally {
        setTelegramLoading(false);
      }
    };

    return () => {
      delete window.onWellCircleWebTelegramAuth;
    };
  }, [loginWithTelegram]);

  // WhatsApp Start OTP
  const handleStartWhatsApp = async (e) => {
    e?.preventDefault?.();
    const validation = validatePhone(countryCode, phoneNumber);
    if (!validation.valid || !validation.e164) {
      setError(validation.error || 'Please enter a valid phone number');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await loginWithWhatsAppStart(validation.e164, 'whatsapp');
      setOtpRequestId(res.request_id);
      setFormattedE164(validation.e164);
      setAuthMethod('otp');
      setCountdown(60);
      showToast('Verification code sent via WhatsApp', 'success');
      if (res._dev_code) {
        console.info('[DEV] WhatsApp OTP code is:', res._dev_code);
      }
    } catch (err) {
      setError(err.message || 'Could not send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newCode = [...otpCode];
    newCode[index] = value;
    setOtpCode(newCode);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    if (value && index === 5 && newCode.every(d => d !== '')) {
      submitOtp(newCode.join(''));
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    if (/^[0-9]{6}$/.test(pasteData)) {
      const digits = pasteData.split('');
      setOtpCode(digits);
      otpInputRefs.current[5]?.focus();
      submitOtp(pasteData);
    }
  };

  const submitOtp = async (fullCode) => {
    const code = fullCode || otpCode.join('');
    if (code.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await loginWithWhatsAppVerify(otpRequestId, code);
      showToast('Welcome to Well Circle!', 'success');
    } catch (err) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  // Telegram Login Handler
  const handleTelegramClick = () => {
    if (USE_MOCK) {
      setTelegramLoading(true);
      loginWithTelegram({
        id: 100000002,
        first_name: 'Demo',
        username: 'demo_telegram_user',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'mock',
      })
        .then(() => showToast('Signed in with Telegram Demo!', 'success'))
        .catch(err => setError(err.message || 'Telegram login failed'))
        .finally(() => setTelegramLoading(false));
      return;
    }

    // Open Telegram OAuth authorization popup
    const width = 550;
    const height = 470;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2.5;
    const origin = encodeURIComponent(window.location.origin);
    const oauthUrl = `https://oauth.telegram.org/auth?bot_id=${BOT_ID}&origin=${origin}&embed=0&request_access=write`;

    const popup = window.open(
      oauthUrl,
      'TelegramAuthPopup',
      `width=${width},height=${height},left=${left},top=${top},status=0,toolbar=0,menubar=0,location=1`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // If popup blocked, redirect directly
      window.location.href = oauthUrl;
    }
  };

  return (
    <div className="login-page" id="login-page">
      <div className="login-card">
        {/* Logo & Header */}
        <div className="login-header">
          <img src={newLogo} alt="Well Circle" className="login-logo" />
          <h1 className="login-title">Sign in to Well Circle</h1>
          <p className="login-sub">
            Your wellness tribe, accountability circles, and verified bookings in Addis Ababa.
          </p>
        </div>

        {location.state?.expired && (
          <div className="login-alert warning">
            Your session has expired. Please sign in again to continue.
          </div>
        )}

        {error && (
          <div className="login-alert error" role="alert">
            {error}
          </div>
        )}

        {/* STEP 1: Phone / WhatsApp Input */}
        {authMethod === 'whatsapp' && (
          <div className="login-methods-container">
            <form onSubmit={handleStartWhatsApp} className="login-form">
              <label className="input-label" htmlFor="phone-input">
                Enter your WhatsApp phone number
              </label>
              
              <div className="phone-input-row international">
                <div className="country-select-wrapper">
                  <span className="country-flag" aria-hidden="true">{selectedCountry.flag}</span>
                  <select
                    className="country-code-select"
                    value={countryCode}
                    onChange={(e) => {
                      setCountryCode(e.target.value);
                      setError(null);
                    }}
                    aria-label="Select Country Code"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.country} ({c.code})
                      </option>
                    ))}
                  </select>
                  <span className="country-code-display">{countryCode}</span>
                </div>

                <input
                  id="phone-input"
                  type="tel"
                  className="input-field phone-field"
                  placeholder={selectedCountry.placeholder || 'Phone number'}
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setError(null);
                  }}
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block btn-lg login-submit-btn"
                disabled={loading || phoneNumber.trim().length < 4}
                id="login-whatsapp-continue-btn"
              >
                {loading ? 'Sending Code...' : 'Continue with WhatsApp'}
              </button>
            </form>

            <div className="login-divider">
              <span>or continue with Telegram</span>
            </div>

            {/* Native interactive Telegram Button */}
            <button
              type="button"
              className="btn btn-telegram btn-block btn-lg"
              onClick={handleTelegramClick}
              disabled={telegramLoading || loading}
              id="login-telegram-btn"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.27-5.63 3.73-.53.37-1.02.55-1.45.54-.48-.01-1.4-.27-2.09-.49-.84-.27-1.51-.42-1.45-.89.03-.25.38-.5.99-.77 3.88-1.69 6.48-2.8 7.79-3.34 3.71-1.54 4.48-1.81 4.98-1.82.11 0 .36.03.52.16.14.11.17.26.19.37.01.07.03.24.01.38z"/>
              </svg>
              <span>{telegramLoading ? 'Connecting to Telegram...' : 'Continue with Telegram'}</span>
            </button>
          </div>
        )}

        {/* STEP 2: 6-Digit WhatsApp OTP Code Input */}
        {authMethod === 'otp' && (
          <div className="otp-verification-container">
            <div className="otp-header">
              <span className="otp-icon">💬</span>
              <h3>Enter 6-Digit Code</h3>
              <p className="otp-sub">
                We sent a verification code to your WhatsApp at <strong>{formattedE164 || `${countryCode} ${phoneNumber}`}</strong>.
              </p>
            </div>

            <div className="otp-inputs" onPaste={handleOtpPaste}>
              {otpCode.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => otpInputRefs.current[idx] = el}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  className="otp-digit-input"
                  value={digit}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(idx, e)}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              onClick={() => submitOtp()}
              disabled={loading || otpCode.some(d => d === '')}
              id="otp-verify-submit-btn"
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>

            <div className="otp-footer-actions">
              <button
                type="button"
                className="btn-link otp-resend-btn"
                disabled={countdown > 0 || loading}
                onClick={handleStartWhatsApp}
              >
                {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
              </button>
              <span className="dot-separator">·</span>
              <button
                type="button"
                className="btn-link otp-change-btn"
                onClick={() => {
                  setAuthMethod('whatsapp');
                  setOtpCode(['', '', '', '', '', '']);
                }}
              >
                Change number
              </button>
            </div>
          </div>
        )}

        <div className="login-footer-terms">
          By signing in, you agree to Well Circle's <button onClick={() => navigate('/about')} className="btn-link inline">Community Guidelines & Terms</button>.
        </div>
      </div>
    </div>
  );
}
