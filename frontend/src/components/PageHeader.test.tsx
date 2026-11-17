import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogout } from '../features/auth/useAuth';
import { PageHeader } from './PageHeader';

vi.mock('../features/auth/useAuth', () => ({ useLogout: vi.fn() }));

const mutate = vi.fn();
const renderHeader = () => render(
  <MemoryRouter initialEntries={['/app']}>
    <PageHeader />
  </MemoryRouter>
);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useLogout).mockReturnValue({ mutate, isPending: false } as never);
});

describe('PageHeader', () => {
  it('provides navigation to the main sections', () => {
    renderHeader();
    const navigation = within(screen.getByRole('navigation', { name: 'Main navigation' }));
    expect(navigation.getByRole('link', { name: 'Inventory' })).toHaveAttribute('href', '/app');
    expect(navigation.getByRole('link', { name: 'Bookings' })).toHaveAttribute('href', '/app/bookings');
    expect(navigation.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/app/settings');
  });

  it('logs out through the existing mutation', async () => {
    renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
