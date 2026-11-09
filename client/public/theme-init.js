// Sets the theme, and the page language and direction, before the first paint, so dark users
// never see a light flash and Persian users never see a left-to-right layout first.
// Loaded by a blocking <script> in index.html (a file, not inline, so the Content Security
// Policy in vercel.json can stay script-src 'self'). Keep in step with applyTheme() in
// src/theme/theme.js.
(function () {
  try {
    var saved = null;
    try {
      saved = window.localStorage.getItem('theme');
    } catch {
      // Storage can be blocked; fall back to the system setting.
    }
    var dark =
      saved === 'dark' ||
      (saved !== 'light' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0B1220' : '#F8FAFC');
  } catch {
    // Never block the page over the theme; theme.js applies it again after load.
  }
})();

// Same order as initialLanguage() in src/i18n/index.js: the saved choice, then the browser's
// language, then English. Keep the storage key in step.
(function () {
  try {
    var language = null;
    try {
      language = window.localStorage.getItem('language');
    } catch {
      // Storage can be blocked; use the browser's language.
    }
    if (language !== 'en' && language !== 'fa') {
      var browser = ((navigator && navigator.language) || '').toLowerCase().split('-')[0];
      language = browser === 'fa' ? 'fa' : 'en';
    }
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  } catch {
    // i18n sets lang and dir again once the app loads.
  }
})();
