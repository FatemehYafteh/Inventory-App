import { useEffect, useState } from 'react';

/**
 * True once `active` has stayed true for `delayMs`; false again the moment it turns false. Short
 * activity never shows, so a fast request causes no flicker.
 */
export function useDelayedFlag(active, delayMs) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) {
      setElapsed(false);
      return undefined;
    }
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);
  return active && elapsed;
}
