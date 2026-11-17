import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, readTheme, saveTheme } from '../theme';

export const ThemeToggle = () => {
  const [theme, setTheme] = useState(readTheme);
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    saveTheme(next);
    setTheme(next);
  };

  return (
    <button type="button" onClick={toggle} aria-label={label} title={label} className="ui-button-secondary p-2.5">
      {theme === 'dark'
        ? <Sun aria-hidden="true" className="h-4 w-4" />
        : <Moon aria-hidden="true" className="h-4 w-4" />}
    </button>
  );
};
