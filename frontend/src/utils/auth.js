/** Matches backend SUPER_ADMIN_TELEGRAM_IDS default in config.py */
const DEFAULT_SUPER_ADMIN_IDS = ['628489806', '746296167'];

/**
 * Super-admin check — mirrors backend logic:
 * user.is_super_admin OR telegram_id in VITE_SUPER_ADMIN_TELEGRAM_IDS
 */
export function isSuperAdmin(user) {
  if (!user?.telegram_id) return false;
  if (user.is_super_admin) return true;

  const idsRaw = import.meta.env.VITE_SUPER_ADMIN_TELEGRAM_IDS || '';
  const ids = idsRaw
    ? idsRaw.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_SUPER_ADMIN_IDS;

  return ids.includes(String(user.telegram_id));
}
