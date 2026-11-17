export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'inventory-theme';
let transitionTimeout: number | undefined;

export function readTheme(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: Theme, animate = false) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-transitioning');
    window.clearTimeout(transitionTimeout);
    transitionTimeout = window.setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 250);
  }
  root.dataset.theme = theme;
}

export function saveTheme(theme: Theme) {
  applyTheme(theme, true);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Theme switching still works when browser storage is unavailable.
  }
}
