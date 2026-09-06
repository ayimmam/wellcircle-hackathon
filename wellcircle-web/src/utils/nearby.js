// V2 UX: "near you" matching by neighbourhood text — no GPS. A neighbourhood
// like "Bole" matches any provider whose location_text contains it as a
// substring, case-insensitively (so it also matches "Bole Medhanialem",
// "Bole Sub-City", etc. — intended, not a bug).

export function isNearUser(provider, neighbourhood) {
  if (!neighbourhood || !provider?.location_text) return false;
  return provider.location_text.toLowerCase().includes(neighbourhood.toLowerCase());
}

export function nearbyProviders(providers, neighbourhood) {
  return (providers || []).filter(p => isNearUser(p, neighbourhood));
}

export function nearbyEvents(events, providers, neighbourhood) {
  const nearbyIds = new Set(nearbyProviders(providers, neighbourhood).map(p => p.id));
  return (events || []).filter(e => nearbyIds.has(e.provider_id));
}
