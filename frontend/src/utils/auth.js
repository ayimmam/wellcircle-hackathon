/**
 * Super-admin check — mirrors backend logic:
 * user.is_super_admin OR telegram_id in VITE_SUPER_ADMIN_TELEGRAM_IDS
 */
export function isSuperAdmin(user) {
  if (!user) return false;
  if (user.is_super_admin) return true;

  const idsRaw = import.meta.env.VITE_SUPER_ADMIN_TELEGRAM_IDS || '';
  if (!idsRaw || !user.telegram_id) return false;

  const ids = idsRaw.split(',').map(s => s.trim()).filter(Boolean);
  return ids.includes(String(user.telegram_id));
}
