import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingsPage } from './BookingsPage';
import { useAuth, useLogout } from '../features/auth/useAuth';
import { getEquipment, getBookings, createBooking } from '../features/bookings/bookingsapi';

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
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/app/bookings']}>
      <BookingsPage />
    </MemoryRouter>
  </QueryClientProvider>
);

const EQUIPMENT = {
  ID: 1,
  Name: 'Prusa MK4',
  Category: '3D printers',
  Location: 'Maker bench',
  Description: 'FDM printer',
  Status: 'ACTIVE' as const,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useAuth).mockReturnValue({ data: { loggedIn: true, disabled: false } } as never);
  vi.mocked(useLogout).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  vi.mocked(getBookings).mockResolvedValue([]);
  vi.mocked(getEquipment).mockResolvedValue([EQUIPMENT]);
});

describe('BookingsPage: recovery and form safeguards', () => {
  const openPanel = async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Prusa MK4/ }));
  };

  it.each(['equipment', 'bookings'])('retries a failed %s load', async (source) => {
    if (source === 'equipment') vi.mocked(getEquipment).mockRejectedValueOnce(new Error('Equipment unavailable'));
    else vi.mocked(getBookings).mockRejectedValueOnce(new Error('Bookings unavailable'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/);
    expect(screen.queryByText('No equipment yet.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText('Prusa MK4')).toBeInTheDocument();
  });

  it('asks before discarding a booking purpose', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await openPanel();
    const purpose = screen.getByLabelText('What are you using it for? (optional)');
    await userEvent.type(purpose, 'Prototype');
    await userEvent.keyboard('{Escape}');
    expect(confirm).toHaveBeenCalledWith('Discard your unsaved changes?');
    expect(purpose).toHaveValue('Prototype');
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Close equipment details' }));
    expect(screen.queryByLabelText('What are you using it for? (optional)')).not.toBeInTheDocument();
  });

  it('keeps a failed booking form intact for retry', async () => {
    vi.mocked(createBooking).mockRejectedValue(new Error('Booking failed'));
    await openPanel();
    // A future date avoids depending on the time of day the suite runs.
    const date = screen.getByLabelText('Date');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const value = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    fireEvent.change(date, { target: { value } });
    await userEvent.type(screen.getByLabelText('What are you using it for? (optional)'), 'Prototype');
    await userEvent.click(screen.getByRole('button', { name: 'Book it' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Booking failed');
    expect(screen.getByLabelText('What are you using it for? (optional)')).toHaveValue('Prototype');
  });
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
