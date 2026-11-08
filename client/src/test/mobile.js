function fakeMatchMedia(matching) {
  return (query) => ({
    matches: matching.some((pattern) => pattern.test(query)),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}

function mockScreen(matching) {
  const original = window.matchMedia;
  window.matchMedia = fakeMatchMedia(matching);
  return () => {
    window.matchMedia = original;
  };
}

/**
 * Makes `window.matchMedia` report a phone-sized screen (below Tailwind's `md`, 768px), so the
 * card and bottom-sheet layouts render. Returns a function that puts the old one back.
 */
export function mockMobile() {
  return mockScreen([/max-width:\s*767px/, /max-width:\s*1023px/]);
}

/**
 * A tablet, such as an iPad mini (768px): below `lg` but not below `md`. Tables are cards,
 * filters stay inline.
 */
export function mockTablet() {
  return mockScreen([/max-width:\s*1023px/]);
}
