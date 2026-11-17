import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingsPage } from './BookingsPage';
import { ConfirmProvider } from '../components/ConfirmProvider';
import { useAuth, useLogout } from '../features/auth/useAuth';
import { getEquipment, getBookings, createBooking, cancelBooking, updateBooking, createEquipment, updateEquipment, deleteEquipment, type Booking } from '../features/bookings/bookingsapi';
import { toDateInput } from '../features/bookings/bookingTime';

vi.mock('../features/auth/useAuth', () => ({
  useAuth: vi.fn(),
  useLogout: vi.fn(),
}));
vi.mock('../features/bookings/bookingsapi', () => ({
  getEquipment: vi.fn(),
  getBookings: vi.fn(),
  createBooking: vi.fn(),
  cancelBooking: vi.fn(),
  updateBooking: vi.fn(),
  createEquipment: vi.fn(),
  updateEquipment: vi.fn(),
  deleteEquipment: vi.fn(),
}));

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/app/bookings']}>
      <ConfirmProvider><BookingsPage /></ConfirmProvider>
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

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toDateInput(date);
};

const reservation = (overrides: Partial<Booking> = {}): Booking => ({
  ID: 42,
  EquipmentID: EQUIPMENT.ID,
  UserName: 'Alex',
  Mine: false,
  Start: new Date(`${tomorrow()}T10:00`).toISOString(),
  End: new Date(`${tomorrow()}T12:00`).toISOString(),
  Purpose: 'Enclosure',
  ...overrides,
});

const authenticate = (permissions: string[] = []) => {
  const session = { loggedIn: true as const, disabled: false as const, name: 'Taylor', email: 'taylor@example.com', permissions };
  vi.mocked(useAuth).mockReturnValue({ data: session } as never);
  return session;
};

const chooseTomorrow = async () => {
  renderPage();
  await screen.findByText('Prusa MK4');
  const date = new Date(`${tomorrow()}T00:00`);
  await userEvent.click(screen.getByRole('button', { name: date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }));
};

const openEquipmentEditor = async () => {
  renderPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Equipment: Prusa MK4' }));
};

beforeEach(() => {
  vi.resetAllMocks();
  authenticate();
  vi.mocked(useLogout).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  vi.mocked(getBookings).mockResolvedValue([]);
  vi.mocked(getEquipment).mockResolvedValue([EQUIPMENT]);
});

describe('BookingsPage: loading and recovery', () => {
  it('shows loading feedback until the schedule is ready', async () => {
    renderPage();
    expect(screen.getByRole('status', { name: 'Loading booking schedule' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Equipment: Prusa MK4' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('retries a failed load', async () => {
    vi.mocked(getEquipment).mockRejectedValueOnce(new Error('Equipment unavailable'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Equipment unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Equipment: Prusa MK4' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps a failed booking form intact for retry', async () => {
    vi.mocked(createBooking).mockRejectedValueOnce(new Error('Booking failed'));
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Available' }));
    await userEvent.type(screen.getByLabelText('What are you using it for? (optional)'), 'Prototype');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reservation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Booking failed');
    expect(screen.getByLabelText('What are you using it for? (optional)')).toHaveValue('Prototype');
  });
});

describe('BookingsPage: schedule and reservations', () => {
  it('creates a reservation from a free slot and shows it in My bookings', async () => {
    vi.mocked(createBooking).mockImplementation(async (booking) => ({ ID: 45, UserName: 'You', Mine: true, ...booking }));
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Available' }));
    expect(screen.getByLabelText('Date')).toHaveValue(tomorrow());
    expect(screen.getByLabelText('Start')).toHaveValue('10:00');
    expect(screen.getByLabelText('Duration')).toHaveValue('0.5');
    await userEvent.type(screen.getByLabelText('What are you using it for? (optional)'), 'New enclosure');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reservation' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close equipment details' })).not.toBeInTheDocument());
    expect(createBooking).toHaveBeenCalledWith({
      EquipmentID: 1,
      Start: new Date(`${tomorrow()}T10:00`).toISOString(),
      End: new Date(`${tomorrow()}T10:30`).toISOString(),
      Purpose: 'New enclosure',
    });
    expect(screen.getByRole('button', { name: 'Prusa MK4 from 10:00 to 10:30: Your booking' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 10:30: Available' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /My bookings/ }));
    expect(screen.getByRole('region', { name: 'Your upcoming bookings' })).toHaveTextContent('New enclosure');
  });

  it('creates a reservation at a half-hour start with a half-hour duration increment', async () => {
    vi.mocked(createBooking).mockImplementation(async (booking) => ({ ID: 45, UserName: 'You', Mine: true, ...booking }));
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 at 10:30: Available' }));
    expect(screen.getByLabelText('Start')).toHaveValue('10:30');
    expect(screen.getByLabelText('Start')).toHaveAttribute('step', '1800');
    expect(screen.getByLabelText('Duration')).toHaveValue('0.5');
    expect(screen.getByRole('option', { name: '30 minutes' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(16);
    await userEvent.selectOptions(screen.getByLabelText('Duration'), '1.5');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reservation' }));
    await waitFor(() => expect(createBooking).toHaveBeenCalledWith({
      EquipmentID: 1,
      Start: new Date(`${tomorrow()}T10:30`).toISOString(),
      End: new Date(`${tomorrow()}T12:00`).toISOString(),
      Purpose: '',
    }));
  });

  it.each([false, true])('prefills a half-hour dragged range (reverse: %s)', async (reverse) => {
    await chooseTomorrow();
    const user = userEvent.setup();
    const first = screen.getByRole('button', { name: `Prusa MK4 at ${reverse ? '13:00' : '10:30'}: Available` });
    const last = screen.getByRole('button', { name: `Prusa MK4 at ${reverse ? '10:30' : '13:00'}: Available` });
    vi.spyOn(first.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 2400 } as DOMRect);
    await user.pointer({ keys: '[MouseLeft>]', target: first });
    await user.pointer({ target: last, coords: { clientX: reverse ? 1075 : 1325 } });
    await user.pointer({ keys: '[/MouseLeft]' });
    expect(screen.getByLabelText('Start')).toHaveValue('10:30');
    expect(screen.getByLabelText('Duration')).toHaveValue('3');
  });

  it('offers the final half-hour slot before midnight', async () => {
    await chooseTomorrow();
    const slot = screen.getByRole('button', { name: 'Prusa MK4 at 23:30: Available' });
    expect(slot).toHaveAttribute('title', '23:30–24:00 · Available');
    await userEvent.click(slot);
    expect(screen.getByLabelText('Start')).toHaveValue('23:30');
    expect(screen.getByLabelText('Duration')).toHaveValue('0.5');
  });

  it('filters equipment by category', async () => {
    vi.mocked(getEquipment).mockResolvedValue([EQUIPMENT, { ...EQUIPMENT, ID: 2, Name: 'Hakko', Category: 'Soldering' }]);
    await chooseTomorrow();
    await userEvent.click(within(screen.getByRole('complementary', { name: 'Equipment filters' })).getByRole('button', { name: /Soldering/ }));
    expect(screen.queryByRole('button', { name: 'Equipment: Prusa MK4' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Equipment: Hakko' })).toBeInTheDocument();
  });

  it('keeps occupied slots inspectable but rejects an overlapping reservation', async () => {
    vi.mocked(getBookings).mockResolvedValue([reservation()]);
    await chooseTomorrow();
    expect(screen.getByRole('button', { name: 'Prusa MK4 from 10:00 to 12:00: Booked' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 12:00: Available' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 at 12:00: Available' }));
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '10:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reservation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('overlaps an existing booking');
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('does not offer bookings for equipment under maintenance', async () => {
    vi.mocked(getEquipment).mockResolvedValue([{ ...EQUIPMENT, Status: 'MAINTENANCE', MaintenanceNote: 'Replacing hotend' }]);
    await chooseTomorrow();
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Unavailable' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Equipment: Prusa MK4' }));
    expect(screen.queryByRole('button', { name: 'Confirm reservation' })).not.toBeInTheDocument();
  });

  it('shows and cancels only the user’s upcoming reservations', async () => {
    vi.mocked(getBookings).mockResolvedValue([
      reservation(),
      reservation({ ID: 43, Mine: true, Purpose: 'My project' }),
      reservation({ ID: 44, Mine: true, End: new Date(Date.now() - 3600_000).toISOString() }),
    ]);
    renderPage();
    await screen.findByText('Prusa MK4');
    await userEvent.click(screen.getByRole('button', { name: /My bookings/ }));
    const upcoming = within(screen.getByRole('region', { name: 'Your upcoming bookings' }));
    expect(upcoming.getAllByRole('listitem')).toHaveLength(1);
    expect(upcoming.getByText(/My project/)).toBeInTheDocument();
    await userEvent.click(upcoming.getByRole('button', { name: 'Cancel booking for Prusa MK4' }));
    expect(cancelBooking).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel booking' }));
    await waitFor(() => expect(cancelBooking).toHaveBeenCalledWith(43, expect.objectContaining({ loggedIn: true })));
    expect(await screen.findByText('No upcoming reservations yet.')).toBeInTheDocument();
  });

  it('edits an own reservation without equipment permissions', async () => {
    const booking = reservation({ Mine: true });
    vi.mocked(getBookings).mockResolvedValue([booking]);
    vi.mocked(updateBooking).mockResolvedValue({ ...booking, Purpose: 'Revised' });
    renderPage();
    await screen.findByText('Prusa MK4');
    await userEvent.click(screen.getByRole('button', { name: /My bookings/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit booking for Prusa MK4' }));
    await userEvent.clear(screen.getByLabelText('What are you using it for? (optional)'));
    await userEvent.type(screen.getByLabelText('What are you using it for? (optional)'), 'Revised');
    await userEvent.click(screen.getByRole('button', { name: 'Save reservation' }));
    await waitFor(() => expect(updateBooking).toHaveBeenCalledWith(booking.ID, expect.objectContaining({ Start: booking.Start, End: booking.End, Purpose: 'Revised' }), expect.objectContaining({ permissions: [] })));
    expect(createBooking).not.toHaveBeenCalled();
  });
});

describe('BookingsPage: reservation details', () => {
  it('opens a read-only sidebar with reservation info for another user’s booking', async () => {
    const booking = reservation();
    vi.mocked(getBookings).mockResolvedValue([booking]);
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 from 10:00 to 12:00: Booked' }));
    const details = within(screen.getByLabelText('Reservation details'));
    expect(details.getByRole('heading', { name: 'Prusa MK4' })).toBeInTheDocument();
    expect(details.getByText('Maker bench')).toBeInTheDocument();
    expect(details.getByText('Alex')).toBeInTheDocument();
    expect(details.getByText('Enclosure')).toBeInTheDocument();
    expect(details.getByText('2 hours')).toBeInTheDocument();
    for (const [label, date] of [['Starts', booking.Start], ['Ends', booking.End]]) {
      const value = new Date(date);
      expect(details.getByText(label).nextElementSibling).toHaveTextContent(value.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
      expect(details.getByText(label).nextElementSibling).toHaveTextContent(value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    }
    expect(details.queryByRole('button', { name: 'Edit reservation' })).not.toBeInTheDocument();
    expect(details.queryByRole('button', { name: 'Cancel booking' })).not.toBeInTheDocument();
    expect(details.queryByRole('button', { name: 'Confirm reservation' })).not.toBeInTheDocument();
    await userEvent.click(details.getByRole('button', { name: 'Close reservation details' }));
    expect(screen.queryByLabelText('Reservation details')).not.toBeInTheDocument();
    expect(createBooking).not.toHaveBeenCalled();
    expect(updateBooking).not.toHaveBeenCalled();
  });

  it.each([
    { mine: true, permissions: [] },
    { mine: false, permissions: ['BookingManage'] },
  ])('lets authorized users edit from the sidebar (mine: $mine)', async ({ mine, permissions }) => {
    authenticate(permissions);
    const booking = reservation({ Mine: mine });
    vi.mocked(getBookings).mockResolvedValue([booking]);
    vi.mocked(updateBooking).mockResolvedValue({ ...booking, Purpose: 'Updated' });
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: `Prusa MK4 from 10:00 to 12:00: ${mine ? 'Your booking' : 'Booked'}` }));
    const details = within(screen.getByLabelText('Reservation details'));
    expect(details.getByText(mine ? 'You' : 'Alex')).toBeInTheDocument();
    expect(details.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();
    await userEvent.click(details.getByRole('button', { name: 'Edit reservation' }));
    expect(screen.getByLabelText('Start')).toHaveValue('10:00');
    expect(screen.getByLabelText('Duration')).toHaveValue('2');
    await userEvent.clear(screen.getByLabelText('What are you using it for? (optional)'));
    await userEvent.type(screen.getByLabelText('What are you using it for? (optional)'), 'Updated');
    await userEvent.click(screen.getByRole('button', { name: 'Save reservation' }));
    await waitFor(() => expect(updateBooking).toHaveBeenCalledWith(booking.ID, expect.objectContaining({ Start: booking.Start, End: booking.End, Purpose: 'Updated' }), expect.anything()));
  });

  it('confirms cancellation from the sidebar and closes it after success', async () => {
    vi.mocked(getBookings).mockResolvedValue([reservation({ Mine: true })]);
    vi.mocked(cancelBooking).mockResolvedValue(undefined);
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 from 10:00 to 12:00: Your booking' }));
    await userEvent.click(within(screen.getByLabelText('Reservation details')).getByRole('button', { name: 'Cancel booking' }));
    expect(cancelBooking).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel booking' }));
    await waitFor(() => expect(screen.queryByLabelText('Reservation details')).not.toBeInTheDocument());
    expect(cancelBooking).toHaveBeenCalledWith(42, expect.anything());
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Available' })).toBeEnabled();
  });

  it('keeps details open and shows cancellation errors', async () => {
    vi.mocked(getBookings).mockResolvedValue([reservation({ Mine: true })]);
    vi.mocked(cancelBooking).mockRejectedValue(new Error('Cancellation failed'));
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 from 10:00 to 12:00: Your booking' }));
    await userEvent.click(within(screen.getByLabelText('Reservation details')).getByRole('button', { name: 'Cancel booking' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel booking' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cancellation failed');
    expect(screen.getByLabelText('Reservation details')).toHaveTextContent('Enclosure');
  });

  it('shows existing reservation details during maintenance without allowing edits', async () => {
    vi.mocked(getEquipment).mockResolvedValue([{ ...EQUIPMENT, Status: 'MAINTENANCE' }]);
    vi.mocked(getBookings).mockResolvedValue([reservation({ Mine: true, Purpose: '' })]);
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 from 10:00 to 12:00: Your booking' }));
    const details = within(screen.getByLabelText('Reservation details'));
    expect(details.getByText('No purpose provided.')).toBeInTheDocument();
    expect(details.queryByRole('button', { name: 'Edit reservation' })).not.toBeInTheDocument();
    expect(details.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByLabelText('Reservation details')).not.toBeInTheDocument();
  });
});

describe('BookingsPage: equipment management', () => {
  it.each([
    { permissions: [], add: false, modify: false, remove: false },
    { permissions: ['BookingAdd'], add: true, modify: false, remove: false },
    { permissions: ['BookingModify'], add: false, modify: true, remove: false },
    { permissions: ['BookingDelete'], add: false, modify: false, remove: true },
    { permissions: ['BookingManage'], add: false, modify: false, remove: false },
    { permissions: ['Administrator'], add: true, modify: true, remove: true },
  ])('gates equipment controls for $permissions', async ({ permissions, add, modify, remove }) => {
    authenticate(permissions);
    renderPage();
    const name = await screen.findByRole('button', { name: 'Equipment: Prusa MK4' });
    await userEvent.click(name);
    expect(!!screen.queryByRole('button', { name: 'Add equipment' })).toBe(add);
    expect(screen.queryByRole('button', { name: 'Edit equipment' })).not.toBeInTheDocument();
    expect(!!screen.queryByRole('button', { name: 'Save equipment' })).toBe(modify);
    expect(!!screen.queryByRole('button', { name: 'Delete equipment' })).toBe(remove);
    expect(screen.queryByRole('button', { name: 'Manage equipment' })).not.toBeInTheDocument();
    expect(name).toHaveProperty('disabled', !modify && !remove);
    expect(!!screen.queryByRole('button', { name: 'Close equipment editor' })).toBe(modify || remove);
    if (modify || remove) {
      expect(screen.getByLabelText('Name')).toHaveValue('Prusa MK4');
      if (modify) expect(screen.getByLabelText('Name')).toBeEnabled();
      else expect(screen.getByLabelText('Name')).toBeDisabled();
    }
    expect(screen.queryByRole('button', { name: 'Confirm reservation' })).not.toBeInTheDocument();
  });

  it('keeps equipment management controls out of the reservation form', async () => {
    authenticate(['Administrator']);
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 at 10:30: Available' }));
    const panel = within(screen.getByLabelText('Equipment details'));
    expect(panel.getByRole('button', { name: 'Confirm reservation' })).toBeInTheDocument();
    expect(panel.queryByRole('button', { name: 'Edit equipment' })).not.toBeInTheDocument();
    expect(panel.queryByRole('button', { name: 'Delete equipment' })).not.toBeInTheDocument();
    expect(panel.queryByRole('button', { name: 'Add equipment' })).not.toBeInTheDocument();
    await userEvent.click(panel.getByRole('button', { name: 'Close equipment details' }));
    await userEvent.click(screen.getByRole('button', { name: 'Equipment: Prusa MK4' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Prusa MK4');
    expect(screen.getByRole('button', { name: 'Save equipment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit equipment' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete equipment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm reservation' })).not.toBeInTheDocument();
  });

  it('does nothing when a user without equipment permissions clicks the equipment name', async () => {
    await chooseTomorrow();
    const name = screen.getByRole('button', { name: 'Equipment: Prusa MK4' });
    expect(name).toBeDisabled();
    await userEvent.click(name);
    expect(screen.getByLabelText('Equipment details')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button', { name: 'Confirm reservation' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 at 10:30: Available' }));
    expect(screen.getByRole('button', { name: 'Confirm reservation' })).toBeInTheDocument();
  });

  it('adds equipment with custom working hours', async () => {
    const session = authenticate(['BookingAdd']);
    vi.mocked(createEquipment).mockResolvedValue({ ...EQUIPMENT, ID: 2, Name: 'Custom tool', Category: 'Tools', OpenHour: 9, CloseHour: 17 });
    renderPage();
    await screen.findByText('Prusa MK4');
    await userEvent.click(screen.getByRole('button', { name: 'Add equipment' }));
    const editor = within(screen.getByLabelText('Add bookable equipment'));
    await userEvent.type(editor.getByLabelText('Name'), 'Custom tool');
    await userEvent.type(editor.getByLabelText('Category'), 'Tools');
    await userEvent.type(editor.getByLabelText('Location'), 'Bench');
    await userEvent.selectOptions(editor.getByLabelText('Opening time'), '9');
    await userEvent.selectOptions(editor.getByLabelText('Closing time'), '17');
    await userEvent.click(editor.getByRole('button', { name: 'Add equipment' }));
    await waitFor(() => expect(createEquipment).toHaveBeenCalledWith(expect.objectContaining({ Name: 'Custom tool', Category: 'Tools', Location: 'Bench', OpenHour: 9, CloseHour: 17 }), session));
    expect(await screen.findByText('Custom tool')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Equipment: Custom tool' })).toHaveTextContent('09:00–17:00');
  });

  it('edits equipment and updates its schedule hours', async () => {
    const session = authenticate(['BookingModify']);
    vi.mocked(updateEquipment).mockResolvedValue({ ...EQUIPMENT, OpenHour: 10, CloseHour: 14 });
    await openEquipmentEditor();
    await userEvent.selectOptions(screen.getByLabelText('Opening time'), '10');
    await userEvent.selectOptions(screen.getByLabelText('Closing time'), '14');
    await userEvent.click(screen.getByRole('button', { name: 'Save equipment' }));
    await waitFor(() => expect(updateEquipment).toHaveBeenCalledWith(1, expect.objectContaining({ OpenHour: 10, CloseHour: 14 }), session));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Equipment: Prusa MK4' })).toHaveTextContent('10:00–14:00'));
    await userEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    await userEvent.click(screen.getByRole('button', { name: new Date(`${tomorrow()}T00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }));
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 09:00: Unavailable' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Available' })).toBeEnabled();
  });

  it('confirms equipment deletion and removes its reservations', async () => {
    const session = authenticate(['BookingDelete']);
    vi.mocked(getBookings).mockResolvedValue([reservation({ Mine: true })]);
    vi.mocked(deleteEquipment).mockResolvedValue(undefined);
    await openEquipmentEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Delete equipment' }));
    expect(deleteEquipment).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete equipment' }));
    await waitFor(() => expect(deleteEquipment).toHaveBeenCalledWith(1, session));
    expect(await screen.findByText('No equipment yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /My bookings/ }));
    expect(screen.getByText('No upcoming reservations yet.')).toBeInTheDocument();
  });

  it('keeps the equipment form intact when deletion is declined or fails', async () => {
    authenticate(['Administrator']);
    vi.mocked(deleteEquipment).mockRejectedValue(new Error('Deletion failed'));
    await openEquipmentEditor();
    await userEvent.type(screen.getByLabelText('Name'), ' unsaved');
    await userEvent.click(screen.getByRole('button', { name: 'Delete equipment' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(deleteEquipment).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toHaveValue('Prusa MK4 unsaved');
    await userEvent.click(screen.getByRole('button', { name: 'Delete equipment' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete equipment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Deletion failed');
    expect(screen.getByLabelText('Name')).toHaveValue('Prusa MK4 unsaved');
    expect(screen.getByRole('button', { name: 'Delete equipment' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save equipment' })).toBeEnabled();
    expect(updateEquipment).not.toHaveBeenCalled();
  });

  it('closes the equipment editor without saving', async () => {
    authenticate(['BookingModify']);
    await openEquipmentEditor();
    await userEvent.type(screen.getByLabelText('Name'), ' unsaved');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Edit bookable equipment')).not.toBeInTheDocument();
    expect(updateEquipment).not.toHaveBeenCalled();
  });
});

describe('BookingsPage: all bookings', () => {
  it.each([
    { permissions: [], visible: false },
    { permissions: ['BookingModify', 'BookingDelete'], visible: false },
    { permissions: ['BookingManage'], visible: true },
    { permissions: ['Administrator'], visible: true },
  ])('gates access for $permissions', ({ permissions, visible }) => {
    authenticate(permissions);
    renderPage();
    expect(!!screen.queryByRole('button', { name: /All bookings/ })).toBe(visible);
  });

  it('lists upcoming reservations with their owners and excludes ended bookings', async () => {
    authenticate(['BookingManage']);
    vi.mocked(getBookings).mockResolvedValue([
      reservation(),
      reservation({ ID: 43, Mine: true, Purpose: 'My project' }),
      reservation({ ID: 44, Start: new Date(Date.now() - 7200_000).toISOString(), End: new Date(Date.now() - 3600_000).toISOString(), Purpose: 'Finished project' }),
    ]);
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /All bookings/ }));
    const list = within(await screen.findByRole('region', { name: 'All bookings' }));
    await waitFor(() => expect(list.getAllByRole('listitem')).toHaveLength(2));
    expect(list.getByText(/Alex/)).toBeInTheDocument();
    expect(list.getByText(/My project/)).toBeInTheDocument();
    expect(list.queryByText(/Finished project/)).not.toBeInTheDocument();
  });

  it('lets a manager edit and cancel another user’s reservation', async () => {
    const session = authenticate(['BookingManage']);
    const booking = reservation();
    vi.mocked(getBookings).mockResolvedValue([booking]);
    vi.mocked(updateBooking).mockResolvedValue({ ...booking, Purpose: 'Updated project' });
    vi.mocked(cancelBooking).mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /All bookings/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit booking for Alex on Prusa MK4' }));
    await userEvent.clear(screen.getByLabelText('What are you using it for? (optional)'));
    await userEvent.type(screen.getByLabelText('What are you using it for? (optional)'), 'Updated project');
    await userEvent.click(screen.getByRole('button', { name: 'Save reservation' }));
    await waitFor(() => expect(updateBooking).toHaveBeenCalledWith(42, expect.objectContaining({ Purpose: 'Updated project' }), session));
    const list = within(screen.getByRole('region', { name: 'All bookings' }));
    expect(await list.findByText(/Updated project/)).toBeInTheDocument();
    expect(list.getByText(/Alex/)).toBeInTheDocument();
    await userEvent.click(list.getByRole('button', { name: 'Cancel booking for Alex on Prusa MK4' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel booking' }));
    await waitFor(() => expect(cancelBooking).toHaveBeenCalledWith(42, session));
    expect(await screen.findByText('No current or upcoming bookings.')).toBeInTheDocument();
  });
});
