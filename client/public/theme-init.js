// Sets the theme before the first paint so dark users never see a light flash.
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
