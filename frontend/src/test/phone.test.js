import { describe, it, expect } from 'vitest';
import { validatePhone, normalizeEthiopian, parsePhone } from '../utils/phone';

describe('validatePhone — Ethiopia', () => {
  it('accepts valid Ethiopian numbers in every input form', () => {
    expect(validatePhone('+251', '0911234567')).toMatchObject({ valid: true, e164: '+251911234567' });
    expect(validatePhone('+251', '0712345678')).toMatchObject({ valid: true, e164: '+251712345678' });
    expect(validatePhone('+251', '+251911234567')).toMatchObject({ valid: true, e164: '+251911234567' });
    expect(validatePhone('+251', '911234567')).toMatchObject({ valid: true, e164: '+251911234567' });
  });

  it('rejects invalid Ethiopian numbers', () => {
    expect(validatePhone('+251', '0811234567').valid).toBe(false); // wrong prefix (8)
    expect(validatePhone('+251', '091123456').valid).toBe(false); // 9 digits total incl. 0 — too short
    expect(validatePhone('+251', 'abcdefghij').valid).toBe(false); // letters
    expect(validatePhone('+251', '').valid).toBe(false);
  });
});

describe('validatePhone — other countries', () => {
  it('passes a plausible-length number', () => {
    expect(validatePhone('+1', '4155551234').valid).toBe(true);
    expect(validatePhone('+44', '7911123456').valid).toBe(true);
  });

  it('rejects too-short or non-numeric input', () => {
    expect(validatePhone('+1', '123').valid).toBe(false);
    expect(validatePhone('+44', 'not-a-number').valid).toBe(false);
  });
});

describe('normalizeEthiopian', () => {
  it('strips leading 0 and country code consistently', () => {
    expect(normalizeEthiopian('0911234567')).toBe('911234567');
    expect(normalizeEthiopian('+251911234567')).toBe('911234567');
    expect(normalizeEthiopian('911234567')).toBe('911234567');
  });
});

describe('parsePhone', () => {
  it('splits a stored E.164 number back into code + national', () => {
    expect(parsePhone('+251911234567')).toEqual({ code: '+251', national: '911234567' });
    expect(parsePhone('+14155551234')).toEqual({ code: '+1', national: '4155551234' });
  });

  it('defaults to Ethiopia for an empty value', () => {
    expect(parsePhone(null)).toEqual({ code: '+251', national: '' });
    expect(parsePhone('')).toEqual({ code: '+251', national: '' });
  });
});
