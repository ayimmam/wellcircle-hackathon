import { useEffect, useState } from 'react';

/**
 * Trail `value` by `delayMs` of quiet time.
 *
 * Search boxes are wired straight to a query key, so without this every
 * keystroke becomes its own request to a cold serverless function — typing
 * "yoga" fired four searches and raced their responses.
 */
export default function useDebouncedValue(value, delayMs = 300) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    if (value === settled) return undefined;
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, settled]);

  return settled;
}
