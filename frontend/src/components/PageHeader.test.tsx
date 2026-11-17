import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogout } from '../features/auth/useAuth';
import { PageHeader } from './PageHeader';

vi.mock('../features/auth/useAuth', () => ({ useLogout: vi.fn() }));

const mutate = vi.fn();
const renderHeader = (path = '/app') => render(
  <MemoryRouter initialEntries={[path]}>
    <PageHeader />
  </MemoryRouter>
);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useLogout).mockReturnValue({ mutate, isPending: false } as never);
});

describe('PageHeader', () => {
  it('provides navigation without a redundant page heading', () => {
    renderHeader();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    const navigation = within(screen.getByRole('navigation', { name: 'Main navigation' }));
    expect(navigation.getByRole('link', { name: 'Inventory' })).toHaveAttribute('href', '/app');
    expect(navigation.getByRole('link', { name: 'Bookings' })).toHaveAttribute('href', '/app/bookings');
    expect(navigation.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/app/settings');
  });

  it.each([
    ['/app', 'Inventory'],
    ['/app/bookings', 'Bookings'],
    ['/app/settings/users', 'Settings'],
  ])('marks only the current section at %s', (path, label) => {
    renderHeader(path);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toHaveLength(1);
  });

  it('logs out through the existing mutation', async () => {
    renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('places the theme toggle next to logout', () => {
    renderHeader();
    const toggle = screen.getByRole('button', { name: /switch to .* mode/i });
    expect(toggle.nextElementSibling).toBe(screen.getByRole('button', { name: 'Log out' }));
  });

  it('disables logout while pending', () => {
    vi.mocked(useLogout).mockReturnValue({ mutate, isPending: true } as never);
    renderHeader();
    expect(screen.getByRole('button', { name: 'Logging out…' })).toBeDisabled();
  });

  it('announces logout failures on every page using the shared header', () => {
    vi.mocked(useLogout).mockReturnValue({
      mutate, isPending: false, error: new Error('Could not log out'),
    } as never);
    renderHeader();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not log out');
  });
});
