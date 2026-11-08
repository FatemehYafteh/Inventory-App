/**
 * Makes `window.matchMedia` report a phone-sized screen (below Tailwind's `md`, 768px), so the
 * card and bottom-sheet layouts render. Returns a function that puts the old one back.
 */
export function mockMobile() {
  const original = window.matchMedia;
  window.matchMedia = (query) => ({
    matches: /max-width:\s*767px/.test(query),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
  return () => {
    window.matchMedia = original;
  };
}
