import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getProviderMe, getProviderStats } from '../api/client';
import usePolling from '../hooks/usePolling';

// Provider identity + live KPI stats, shared across every /provider-portal
// page so each route doesn't re-fetch getProviderMe()/getProviderStats() —
// only the section-specific data (bookings, products, ...) is fetched by
// the individual page components.
const ProviderPortalDataContext = createContext(null);

export function ProviderPortalDataProvider({ children }) {
  const [providerId, setProviderId] = useState(null);
  const [providerCategory, setProviderCategory] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getProviderMe()
      .then(me => {
        const pid = me?.id;
        if (!pid) throw new Error('No provider profile found');
        setProviderId(pid);
        setProviderCategory(me?.category || null);
        return getProviderStats(pid);
      })
      .then(setStats)
      .catch(err => setError(err.message || 'Could not load provider dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const refreshStats = useCallback(async () => {
    if (!providerId) return;
    try {
      setStats(await getProviderStats(providerId));
    } catch {
      // transient polling errors shouldn't disrupt the dashboard
    }
  }, [providerId]);

  usePolling(refreshStats, 10000, Boolean(stats && providerId));

  return (
    <ProviderPortalDataContext.Provider value={{ providerId, providerCategory, stats, loading, error, refreshStats }}>
      {children}
    </ProviderPortalDataContext.Provider>
  );
}

export function useProviderPortalData() {
  const ctx = useContext(ProviderPortalDataContext);
  if (!ctx) throw new Error('useProviderPortalData must be used within ProviderPortalDataProvider');
  return ctx;
}
