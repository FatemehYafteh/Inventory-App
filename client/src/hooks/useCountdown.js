import { useCallback, useEffect, useState } from 'react';

/** Whole seconds left until `deadline` (a timestamp), ticking once a second. */
export function useSecondsUntil(deadline) {
  const [, setTick] = useState(0);
  const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

  useEffect(() => {
    if (remaining === 0) return undefined;
    const id = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  return remaining;
}

/** Seconds left until a deadline, ticking once a second. `start(seconds)` resets it. */
export function useCountdown(initialSeconds = 0) {
  const [deadline, setDeadline] = useState(() => Date.now() + initialSeconds * 1000);
  const remaining = useSecondsUntil(deadline);

  const start = useCallback((seconds) => setDeadline(Date.now() + seconds * 1000), []);

  return [remaining, start];
}
