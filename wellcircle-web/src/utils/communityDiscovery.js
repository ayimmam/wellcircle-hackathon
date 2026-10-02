/** Rank relevant groups by real participation; old API responses remain usable. */
export function rankCommunities(communities = [], interests = []) {
  return [...communities].sort((a, b) =>
    Number(interests.includes(b.category)) - Number(interests.includes(a.category)) ||
    (b.active_members_7d || 0) - (a.active_members_7d || 0) ||
    (b.member_count || 0) - (a.member_count || 0)
  );
}

export function communityActivityLabel(community) {
  const count = community.active_members_7d;
  if (typeof count !== 'number') return null;
  return count > 0
    ? `${count} member${count === 1 ? '' : 's'} checked in this week`
    : 'Be the first to check in this week';
}
