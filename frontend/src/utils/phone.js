// V2 UX: country-code phone input + validation. Ethiopia is the default/first
// country since the app is Addis-Ababa-first; everything else gets a loose
// length check rather than per-country rules (not worth the maintenance for
// a handful of guest bookings from elsewhere).

// `placeholder` is the national number only (no leading 0, no country code —
// the code is already shown in the adjacent select), matching what a user
// should actually type into that field.
export const COUNTRY_CODES = [
  { code: '+251', country: 'Ethiopia', flagLabel: 'ET', nationalLength: 9, mobilePrefixes: ['9', '7'], placeholder: '911234567' },
  { code: '+254', country: 'Kenya', flagLabel: 'KE', placeholder: '712345678' },
  { code: '+1', country: 'USA/Canada', flagLabel: 'US', placeholder: '2025551234' },
  { code: '+44', country: 'UK', flagLabel: 'GB', placeholder: '7911123456' },
  { code: '+971', country: 'UAE', flagLabel: 'AE', placeholder: '501234567' },
  { code: '+966', country: 'Saudi Arabia', flagLabel: 'SA', placeholder: '512345678' },
  { code: '+49', country: 'Germany', flagLabel: 'DE', placeholder: '15123456789' },
  { code: '+33', country: 'France', flagLabel: 'FR', placeholder: '612345678' },
  { code: '+39', country: 'Italy', flagLabel: 'IT', placeholder: '3123456789' },
  { code: '+86', country: 'China', flagLabel: 'CN', placeholder: '13123456789' },
  { code: '+91', country: 'India', flagLabel: 'IN', placeholder: '9876543210' },
];

function stripFormatting(input) {
  return (input || '').replace(/[\s\-()]/g, '');
}

/**
 * Normalizes an Ethiopian national number to its 9-digit form (no country
 * code): 09XXXXXXXX / 07XXXXXXXX (10 digits) -> 9XXXXXXXX / 7XXXXXXXX;
 * 9XXXXXXXX / 7XXXXXXXX (9 digits) passes through; a full +251-prefixed
 * value has the country code stripped first.
 */
export function normalizeEthiopian(input) {
  let digits = stripFormatting(input);
  if (digits.startsWith('+251')) digits = digits.slice(4);
  else if (digits.startsWith('251') && digits.length > 9) digits = digits.slice(3);
  if (digits.startsWith('0') && digits.length === 10) digits = digits.slice(1);
  return digits;
}

export function validatePhone(code, national) {
  const country = COUNTRY_CODES.find(c => c.code === code) || COUNTRY_CODES[0];
  const cleaned = stripFormatting(national);

  if (code === '+251') {
    const normalized = normalizeEthiopian(cleaned);
    const valid = /^[97]\d{8}$/.test(normalized);
    return {
      valid,
      e164: valid ? `+251${normalized}` : null,
      error: valid ? null : 'Enter a valid Ethiopian number: 09/07 + 8 digits, or +251 + 9 digits.',
    };
  }

  const digitsOnly = cleaned.replace(/^\+/, '');
  const valid = /^\d{6,12}$/.test(digitsOnly);
  return {
    valid,
    e164: valid ? `${code}${digitsOnly}` : null,
    error: valid ? null : `Enter a valid phone number for ${country.country}.`,
  };
}

/**
 * Splits a stored E.164 number back into { code, national } for prefilling
 * PhoneInput. Falls back to Ethiopia + the raw digits if the code isn't in
 * our curated list (still editable, just not pre-selected correctly).
 */
export function parsePhone(e164) {
  if (!e164) return { code: '+251', national: '' };
  const match = COUNTRY_CODES
    .slice()
    .sort((a, b) => b.code.length - a.code.length)
    .find(c => e164.startsWith(c.code));
  if (!match) return { code: '+251', national: normalizeEthiopian(e164) };
  const national = e164.slice(match.code.length);
  return { code: match.code, national: match.code === '+251' ? normalizeEthiopian(national) : national };
}
