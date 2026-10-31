(() => {
  'use strict';
  const key = 'still-theme';
  let theme = 'dark';
  try { if (localStorage.getItem(key) === 'light') theme = 'light'; } catch {}
  function apply(value) {
    theme = value === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.textContent = theme === 'light' ? 'Dark theme' : 'Light theme';
      button.setAttribute('aria-label', 'Switch to ' + (theme === 'light' ? 'dark' : 'light') + ' theme');
    }
  }
  // Runs in the head so saved colors are applied before the page is painted.
  apply(theme);
  document.addEventListener('DOMContentLoaded', () => {
    apply(theme);
    document.getElementById('theme-toggle').addEventListener('click', () => {
      apply(theme === 'light' ? 'dark' : 'light');
      try { localStorage.setItem(key, theme); }
      catch { document.getElementById('theme-notice').textContent = 'Theme changed for this visit. Browser storage is unavailable.'; }
    });
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(event.newValue);
  });
})();
