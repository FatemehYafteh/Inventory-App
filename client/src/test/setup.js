import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import i18n from '@/i18n';
import { server } from './server';

// Browser APIs jsdom lacks that cmdk, Radix popovers, react-hot-toast and input-otp call;
// no-ops are enough for tests.
document.elementFromPoint ??= () => null;
window.matchMedia ??= (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
});
globalThis.ResizeObserver ??= class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// Radix Select reads pointer capture when an option is chosen.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

// Tests run in English unless a test changes the language itself.
async function resetLanguage() {
  window.localStorage.clear();
  await i18n.changeLanguage('en');
}

beforeAll(async () => {
  await resetLanguage();
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(async () => {
  cleanup();
  await resetLanguage();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
