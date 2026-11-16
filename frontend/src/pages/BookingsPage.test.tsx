import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { BookingsPage } from './BookingsPage';
import { useAuth, useLogout } from '../features/auth/useAuth';
import { getEquipment, getBookings } from '../features/bookings/bookingsapi';

vi.mock('../features/auth/useAuth', () => ({
  useAuth: vi.fn(),
  useLogout: vi.fn(),
}));
vi.mock('../features/bookings/bookingsapi', () => ({
  getEquipment: vi.fn(),
  getBookings: vi.fn(),
  createBooking: vi.fn(),
  cancelBooking: vi.fn(),
}));

const renderPage = () => render(
  <MemoryRouter initialEntries={['/app/bookings']}>
    <BookingsPage />
  </MemoryRouter>
);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useAuth).mockReturnValue({ data: { loggedIn: true, disabled: false } } as never);
  vi.mocked(useLogout).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  vi.mocked(getBookings).mockResolvedValue([]);
});

describe('BookingsPage: loading', () => {
  it('shows skeleton rows until equipment loads', async () => {
    vi.mocked(getEquipment).mockResolvedValue([{
      ID: 1,
      Name: 'Prusa MK4',
      Category: '3D printers',
      Location: 'Maker bench',
      Description: 'FDM printer',
      Status: 'ACTIVE',
    }]);
    renderPage();

    expect(screen.getByRole('status', { name: 'Loading equipment' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('No equipment yet.')).not.toBeInTheDocument();
    expect(await screen.findByText('Prusa MK4')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading equipment' })).not.toBeInTheDocument();
  });

});
