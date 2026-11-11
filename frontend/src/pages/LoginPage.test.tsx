import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://api.test');
    // jsdom's window.location.assign can't be spied on directly, so replace location.
    vi.stubGlobal('location', { ...window.location, assign });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    assign.mockClear();
  });

  it('renders the welcome heading and subtitle', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByText(/sign in to manage your inventory/i)).toBeInTheDocument();
  });

  it('renders a "Continue with Google" button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeEnabled();
  });

  it('redirects to the API login endpoint when the button is clicked', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('http://api.test/login');
  });

  it('does not redirect before the button is clicked', () => {
    render(<LoginPage />);
    expect(assign).not.toHaveBeenCalled();
  });
});
