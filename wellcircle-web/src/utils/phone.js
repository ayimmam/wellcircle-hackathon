// International Country Codes for Well Circle

export const COUNTRY_CODES = [
  { code: '+251', country: 'Ethiopia', flag: '🇪🇹', flagLabel: 'ET', nationalLength: 9, placeholder: '911 234 567' },
  { code: '+1', country: 'United States & Canada', flag: '🇺🇸', flagLabel: 'US', placeholder: '202 555 0143' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', flagLabel: 'GB', placeholder: '7911 123456' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪', flagLabel: 'KE', placeholder: '712 345 678' },
  { code: '+971', country: 'UAE', flag: '🇦🇪', flagLabel: 'AE', placeholder: '50 123 4567' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', flagLabel: 'SA', placeholder: '51 234 5678' },
  { code: '+253', country: 'Djibouti', flag: '🇩🇯', flagLabel: 'DJ', placeholder: '77 12 34 56' },
  { code: '+252', country: 'Somalia', flag: '🇸🇴', flagLabel: 'SO', placeholder: '61 234 5678' },
  { code: '+249', country: 'Sudan', flag: '🇸🇩', flagLabel: 'SD', placeholder: '91 234 5678' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬', flagLabel: 'EG', placeholder: '10 1234 5678' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦', flagLabel: 'ZA', placeholder: '82 123 4567' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬', flagLabel: 'NG', placeholder: '802 123 4567' },
  { code: '+49', country: 'Germany', flag: '🇩🇪', flagLabel: 'DE', placeholder: '151 23456789' },
  { code: '+33', country: 'France', flag: '🇫🇷', flagLabel: 'FR', placeholder: '6 12 34 56 78' },
  { code: '+39', country: 'Italy', flag: '🇮🇹', flagLabel: 'IT', placeholder: '312 345 6789' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱', flagLabel: 'NL', placeholder: '6 12345678' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪', flagLabel: 'SE', placeholder: '70 123 45 67' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭', flagLabel: 'CH', placeholder: '78 123 45 67' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷', flagLabel: 'TR', placeholder: '532 123 4567' },
  { code: '+86', country: 'China', flag: '🇨🇳', flagLabel: 'CN', placeholder: '131 2345 6789' },
  { code: '+91', country: 'India', flag: '🇮🇳', flagLabel: 'IN', placeholder: '98765 43210' },
  { code: '+81', country: 'Japan', flag: '🇯🇵', flagLabel: 'JP', placeholder: '90 1234 5678' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷', flagLabel: 'KR', placeholder: '10 1234 5678' },
  { code: '+61', country: 'Australia', flag: '🇦🇺', flagLabel: 'AU', placeholder: '412 345 678' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷', flagLabel: 'BR', placeholder: '11 91234 5678' },
];

function stripFormatting(input) {
  return (input || '').replace(/[\s\-()]/g, '');
}

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
      error: valid ? null : 'Enter a valid Ethiopian number: 09/07 + 8 digits, or 9 digits.',
    };
  }

  const digitsOnly = cleaned.replace(/^\+/, '');
  const valid = /^\d{6,14}$/.test(digitsOnly);
  return {
    valid,
    e164: valid ? `${code}${digitsOnly}` : null,
    error: valid ? null : `Enter a valid phone number for ${country.country}.`,
  };
}

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
