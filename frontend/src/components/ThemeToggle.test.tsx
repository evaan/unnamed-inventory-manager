import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, readTheme, saveTheme } from '../theme';
import { ThemeToggle } from './ThemeToggle';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  });
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
  document.documentElement.classList.remove('theme-transitioning');
});

describe('ThemeToggle', () => {
  it('only animates user-triggered changes and resets the transition on rapid toggles', () => {
    vi.useFakeTimers();
    try {
      applyTheme('dark');
      expect(document.documentElement).not.toHaveClass('theme-transitioning');
      saveTheme('light');
      expect(document.documentElement).toHaveClass('theme-transitioning');
      vi.advanceTimersByTime(100);
      saveTheme('dark');
      vi.advanceTimersByTime(150);
      expect(document.documentElement).toHaveClass('theme-transitioning');
      vi.advanceTimersByTime(100);
      expect(document.documentElement).not.toHaveClass('theme-transitioning');
    } finally {
      vi.useRealTimers();
    }
  });

  it('defaults to dark and switches both ways with keyboard access', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    await user.tab();
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('inventory-theme')).toBe('light');

    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('inventory-theme')).toBe('dark');
  });

  it('restores a saved choice before rendering and across remounts', () => {
    window.localStorage.setItem('inventory-theme', 'light');
    applyTheme(readTheme());
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    const { unmount } = render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
    unmount();
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
  });

  it('ignores invalid saved values', () => {
    window.localStorage.setItem('inventory-theme', 'invalid');
    render(<ThemeToggle />);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('still switches when browser storage is blocked', async () => {
    vi.mocked(window.localStorage.getItem).mockImplementation(() => { throw new Error('Blocked'); });
    vi.mocked(window.localStorage.setItem).mockImplementation(() => { throw new Error('Blocked'); });
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
  });
});
