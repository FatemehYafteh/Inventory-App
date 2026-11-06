import { useEffect, useState } from 'react';

/** Whether `query` matches now, kept current. False where matchMedia is missing. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener?.('change', onChange);
    return () => list.removeEventListener?.('change', onChange);
  }, [query]);

  return matches;
}

/** Below Tailwind's `md` breakpoint (768px): the layouts that become cards and sheets. */
export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)');
}
