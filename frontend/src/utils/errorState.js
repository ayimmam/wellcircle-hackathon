/** Classify structured failures without exposing server diagnostics. */
export function errorVariant(error) {
  if (error?.status === 401) return 'session';
  if (error?.status === 403) return 'restricted';
  if (error?.status === 404 || error?.status === 410) return 'missing';
  if (error?.status === 429) return 'busy';
  if (error?.name === 'AbortError' || error?.cause?.name === 'AbortError') return 'timeout';
  if (error?.isNetworkNoise || error instanceof TypeError) return 'connection';
  return 'server';
}
