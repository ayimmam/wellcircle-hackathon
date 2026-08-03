import { useState, useEffect, useRef } from 'react';
import { COUNTRY_CODES, validatePhone, normalizeEthiopian } from '../utils/phone';

/**
 * Country-code select + national-number input. Calls `onChange({ e164, valid })`
 * on every keystroke; shows the error message inline once the field has been
 * touched and is invalid (not before, so an empty field on first render isn't
 * red).
 *
 * Includes a scrollIntoView on focus to work around Telegram Mini App's
 * on-screen keyboard covering the input (the keyboard pushes the viewport
 * but doesn't scroll to the focused element).
 */
export default function PhoneInput({ value, onChange }) {
  const [code, setCode] = useState(value?.code || '+251');
  const [national, setNational] = useState(value?.national || '');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  const handleFocus = () => {
    // Delay so the on-screen keyboard has time to animate open and resize
    // the viewport before we scroll. Without this, scrollIntoView fires
    // before the layout shift and the input stays hidden.
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  useEffect(() => {
    const result = validatePhone(code, national);
    onChange(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, national]);

  const result = validatePhone(code, national);
  const showError = touched && national.trim().length > 0 && !result.valid;
  const activeCountry = COUNTRY_CODES.find(c => c.code === code) || COUNTRY_CODES[0];

  const handleNationalBlur = () => {
    setTouched(true);
    // Auto-normalize a leading-0 or +-form typed directly into the national
    // field while Ethiopia is selected.
    if (code === '+251') {
      const normalized = normalizeEthiopian(national);
      if (normalized !== national) setNational(normalized);
    }
  };

  return (
    <div>
      <div className="flex gap-8">
        <select
          className="onboarding-input"
          style={{ flex: '0 0 auto', width: 96 }}
          value={code}
          onChange={e => setCode(e.target.value)}
          id="phone-country-code"
          aria-label="Country code"
        >
          {COUNTRY_CODES.map(c => (
            <option key={c.code} value={c.code}>{c.flagLabel} {c.code}</option>
          ))}
        </select>
        <input
          ref={inputRef}
          className="onboarding-input"
          style={{ flex: 1 }}
          placeholder={activeCountry.placeholder}
          value={national}
          onChange={e => setNational(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleNationalBlur}
          type="tel"
          id="phone-input"
        />
      </div>
      {showError && (
        <p style={{ fontSize: '0.75rem', color: 'var(--danger, #ef4444)', marginTop: 6 }} id="phone-error">
          {result.error}
        </p>
      )}
    </div>
  );
}
