import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

vi.mock('../components/ParticlesBG', () => ({
  default: () => null,
}));

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

  it('redirects to the API login endpoint when the button is clicked', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('http://api.test/login');
  });
});
