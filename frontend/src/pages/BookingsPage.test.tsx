import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingsPage } from './BookingsPage';
import { ConfirmProvider } from '../components/ConfirmProvider';
import { useAuth, useLogout } from '../features/auth/useAuth';
import { getEquipment, getBookings, createBooking, cancelBooking, updateBooking, createEquipment, updateEquipment, deleteEquipment, type Booking } from '../features/bookings/bookingsapi';
import { fmtDay, fmtTime, toDateInput } from '../features/bookings/bookingTime';

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

const renderPage = (client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => render(
  <QueryClientProvider client={client}>
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
    await userEvent.click(await screen.findByRole('button', { name: 'Equipment: Prusa MK4' }));
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

  it.each(['Escape', 'close button'])('closes an unfinished booking with %s without a discard prompt', async (action) => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await openPanel();
    const purpose = screen.getByLabelText('What are you using it for? (optional)');
    await userEvent.type(purpose, 'Prototype');
    if (action === 'Escape') await userEvent.keyboard('{Escape}');
    else await userEvent.click(screen.getByRole('button', { name: 'Close equipment details' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('What are you using it for? (optional)')).not.toBeInTheDocument();
  });

  it('allows navigation, logout, and reload with an unfinished booking without a discard prompt', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const logout = vi.fn();
    vi.mocked(useLogout).mockReturnValue({ mutate: logout, isPending: false } as never);
    await openPanel();
    await userEvent.type(screen.getByLabelText('What are you using it for? (optional)'), 'Prototype');
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(false);
    await userEvent.click(screen.getByRole('link', { name: 'Inventory' }));
    expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
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
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reservation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Booking failed');
    expect(screen.getByLabelText('What are you using it for? (optional)')).toHaveValue('Prototype');
  });
});

describe('BookingsPage: loading', () => {
  it('shows a schedule-shaped skeleton until equipment loads', async () => {
    renderPage();

    const loading = screen.getByRole('status', { name: 'Loading booking schedule' });
    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(within(loading).getByText('00:00')).toBeInTheDocument();
    expect(within(loading).getByText('23:00')).toBeInTheDocument();
    expect(within(loading).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('No equipment yet.')).not.toBeInTheDocument();
    expect(await screen.findByText('Prusa MK4')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading booking schedule' })).not.toBeInTheDocument();
  });

  it('switches loading layouts with the active view while bookings are pending', async () => {
    let resolveBookings!: (bookings: Booking[]) => void;
    vi.mocked(getBookings).mockReturnValue(new Promise((resolve) => { resolveBookings = resolve; }));
    const client = new QueryClient();
    renderPage(client);
    await waitFor(() => expect(client.getQueryData(['equipment', undefined])).toEqual([EQUIPMENT]));
    expect(screen.getByRole('status', { name: 'Loading booking schedule' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Equipment: Prusa MK4' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /My bookings/ }));
    expect(screen.getByRole('status', { name: 'Loading your bookings' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('00:00')).not.toBeInTheDocument();
    expect(screen.queryByText('No upcoming reservations yet.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(screen.getByRole('status', { name: 'Loading booking schedule' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /My bookings/ }));
    await act(async () => resolveBookings([reservation({ Mine: true })]));
    expect(await screen.findByRole('region', { name: 'Your upcoming bookings' })).toHaveTextContent('Prusa MK4');
    expect(screen.queryByRole('status', { name: 'Loading your bookings' })).not.toBeInTheDocument();
  });

  it.each(['schedule', 'mine'])('keeps cached %s content visible during a background refresh', async (view) => {
    vi.mocked(getBookings).mockResolvedValue([reservation({ Mine: true })]);
    const client = new QueryClient();
    renderPage(client);
    await screen.findByRole('button', { name: 'Equipment: Prusa MK4' });
    if (view === 'mine') await userEvent.click(screen.getByRole('button', { name: /My bookings/ }));

    let resolveBookings!: (bookings: Booking[]) => void;
    vi.mocked(getBookings).mockReturnValue(new Promise((resolve) => { resolveBookings = resolve; }));
    let refresh!: Promise<void>;
    act(() => { refresh = client.refetchQueries({ queryKey: ['bookings'] }); });
    expect(client.isFetching({ queryKey: ['bookings'] })).toBe(1);
    expect(screen.queryByRole('status', { name: /Loading/ })).not.toBeInTheDocument();
    if (view === 'schedule') expect(screen.getByRole('button', { name: 'Equipment: Prusa MK4' })).toBeInTheDocument();
    else expect(screen.getByRole('region', { name: 'Your upcoming bookings' })).toHaveTextContent('Prusa MK4');

    await act(async () => { resolveBookings([]); await refresh; });
    if (view === 'mine') expect(await screen.findByText('No upcoming reservations yet.')).toBeInTheDocument();
  });
});

describe('BookingsPage: schedule and reservations', () => {
  const chooseTomorrow = async () => {
    renderPage();
    await screen.findByText('Prusa MK4');
    const date = new Date(`${tomorrow()}T00:00`);
    await userEvent.click(screen.getByRole('button', { name: date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }));
  };

  it('opens a reservation with the clicked date and time', async () => {
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Available' }));
    expect(screen.getByLabelText('Date')).toHaveValue(tomorrow());
    expect(screen.getByLabelText('Start')).toHaveValue('10:00');
    expect(screen.getByLabelText('Duration')).toHaveValue('1');
  });

  it.each([
    { anchor: 10, target: 13, start: '10:00', duration: '4' },
    { anchor: 13, target: 10, start: '10:00', duration: '4' },
    { anchor: 0, target: 12, start: '00:00', duration: '8' },
  ])('prefills a dragged range from $anchor toward $target', async ({ anchor, target, start, duration }) => {
    await chooseTomorrow();
    const user = userEvent.setup();
    const tile = (hour: number) => screen.getByRole('button', { name: `Prusa MK4 at ${String(hour).padStart(2, '0')}:00: Available` });
    const row = tile(anchor).parentElement!;
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 2400 } as DOMRect);
    await user.pointer({ keys: '[MouseLeft>]', target: tile(anchor) });
    await user.pointer({ target: tile(target), coords: { clientX: target * 100 + 50 } });
    expect(tile(anchor)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
    await user.pointer({ keys: '[/MouseLeft]' });
    expect(screen.getByLabelText('Date')).toHaveValue(tomorrow());
    expect(screen.getByLabelText('Start')).toHaveValue(start);
    expect(screen.getByLabelText('Duration')).toHaveValue(duration);
  });

  it('stops a dragged range before an occupied tile', async () => {
    vi.mocked(getBookings).mockResolvedValue([reservation()]);
    await chooseTomorrow();
    const user = userEvent.setup();
    const first = screen.getByRole('button', { name: 'Prusa MK4 at 08:00: Available' });
    const last = screen.getByRole('button', { name: 'Prusa MK4 at 13:00: Available' });
    vi.spyOn(first.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 2400 } as DOMRect);
    await user.pointer({ keys: '[MouseLeft>]', target: first });
    await user.pointer({ target: last, coords: { clientX: 1350 } });
    expect(last).toHaveAttribute('aria-pressed', 'false');
    await user.pointer({ keys: '[/MouseLeft]' });
    expect(screen.getByLabelText('Start')).toHaveValue('08:00');
    expect(screen.getByLabelText('Duration')).toHaveValue('2');
  });

  it.each(['closing time', 'consecutive-use limit'])('stops a dragged range at the %s', async (limit) => {
    const tool = limit === 'closing time';
    if (tool) vi.mocked(getEquipment).mockResolvedValue([{ ...EQUIPMENT, Category: 'Soldering' }]);
    else vi.mocked(getBookings).mockResolvedValue([reservation({
      Mine: true,
      Start: new Date(`${tomorrow()}T00:00`).toISOString(),
      End: new Date(`${tomorrow()}T06:00`).toISOString(),
    })]);
    await chooseTomorrow();
    const user = userEvent.setup();
    const first = screen.getByRole('button', { name: `Prusa MK4 at ${tool ? '18' : '06'}:00: Available` });
    const target = screen.getByRole('button', { name: `Prusa MK4 at ${tool ? '23:00: Unavailable' : '12:00: Available'}` });
    vi.spyOn(first.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 2400 } as DOMRect);
    await user.pointer({ keys: '[MouseLeft>]', target: first });
    await user.pointer({ target, coords: { clientX: tool ? 2350 : 1250 } });
    await user.pointer({ keys: '[/MouseLeft]' });
    expect(screen.getByLabelText('Start')).toHaveValue(tool ? '18:00' : '06:00');
    expect(screen.getByLabelText('Duration')).toHaveValue('2');
  });

  it('supports touch dragging and submits the selected range', async () => {
    vi.mocked(createBooking).mockImplementation(async (booking) => ({ ID: 45, UserName: 'You', Mine: true, ...booking }));
    await chooseTomorrow();
    const user = userEvent.setup();
    const first = screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Available' });
    const last = screen.getByRole('button', { name: 'Prusa MK4 at 12:00: Available' });
    vi.spyOn(first.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 2400 } as DOMRect);
    await user.pointer({ keys: '[TouchA>]', target: first });
    await user.pointer({ pointerName: 'TouchA', target: last, coords: { clientX: 1250 } });
    await user.pointer({ keys: '[/TouchA]' });
    expect(screen.getByLabelText('Start')).toHaveValue('10:00');
    expect(screen.getByLabelText('Duration')).toHaveValue('3');
    await user.click(screen.getByRole('button', { name: 'Confirm reservation' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close equipment details' })).not.toBeInTheDocument());
    expect(createBooking).toHaveBeenCalledWith({
      EquipmentID: 1,
      Start: new Date(`${tomorrow()}T10:00`).toISOString(),
      End: new Date(`${tomorrow()}T13:00`).toISOString(),
      Purpose: '',
    });
  });

  it('opens a focused free tile with the keyboard', async () => {
    await chooseTomorrow();
    screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Available' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByLabelText('Start')).toHaveValue('10:00');
    expect(screen.getByLabelText('Duration')).toHaveValue('1');
  });

  it('clears a cancelled drag without opening the reservation form', async () => {
    await chooseTomorrow();
    const user = userEvent.setup();
    const first = screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Available' });
    await user.pointer({ keys: '[MouseLeft>]', target: first });
    expect(first).toHaveAttribute('aria-pressed', 'true');
    fireEvent.pointerCancel(first.parentElement!);
    expect(first).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
  });

  it('shows exactly seven days, sidebar filters, and the equipment-specific hours', async () => {
    vi.mocked(getEquipment).mockResolvedValue([
      EQUIPMENT,
      { ...EQUIPMENT, ID: 2, Name: 'Hakko', Category: 'Soldering' },
    ]);
    await chooseTomorrow();
    expect(within(screen.getByRole('region', { name: 'Choose a booking day' })).getAllByRole('button')).toHaveLength(7);
    expect(screen.queryByText('Next seven days')).not.toBeInTheDocument();
    expect(screen.queryByText(/Click a free tile/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Local time\. Scroll sideways/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next week' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 00:00: Available' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 23:00: Available' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hakko at 00:00: Unavailable' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hakko at 08:00: Available' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hakko at 20:00: Unavailable' })).toBeDisabled();
    await userEvent.click(within(screen.getByRole('complementary', { name: 'Equipment filters' })).getByRole('button', { name: /Soldering/ }));
    expect(screen.queryByRole('button', { name: 'Equipment: Prusa MK4' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Equipment: Hakko' })).toBeInTheDocument();
  });

  it('supports an eight-hour overnight printer booking and caps the duration choices', async () => {
    vi.mocked(createBooking).mockImplementation(async (booking) => ({ ID: 45, UserName: 'You', Mine: true, ...booking }));
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 at 23:00: Available' }));
    expect(within(screen.getByLabelText('Duration')).getAllByRole('option')).toHaveLength(8);
    await userEvent.selectOptions(screen.getByLabelText('Duration'), '8');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reservation' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close equipment details' })).not.toBeInTheDocument());
    const payload = vi.mocked(createBooking).mock.calls[0][0];
    expect(new Date(payload.End).getTime() - new Date(payload.Start).getTime()).toBe(8 * 3600_000);
    expect(new Date(payload.End).getHours()).toBe(7);
  });

  it('closes the panel after booking and adds the reservation to My bookings without a reload', async () => {
    vi.mocked(createBooking).mockImplementation(async (booking) => ({
      ID: 45, UserName: 'You', Mine: true, ...booking,
    }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Available' }));
    await userEvent.type(screen.getByLabelText('What are you using it for? (optional)'), 'New enclosure');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reservation' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close equipment details' })).not.toBeInTheDocument());
    expect(createBooking).toHaveBeenCalledWith({
      EquipmentID: 1,
      Start: new Date(`${tomorrow()}T10:00`).toISOString(),
      End: new Date(`${tomorrow()}T11:00`).toISOString(),
      Purpose: 'New enclosure',
    });
    expect(confirm).not.toHaveBeenCalled();
    const bookedTile = screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Your booking' });
    expect(bookedTile).toHaveClass('bg-emerald-500/70');
    expect(bookedTile).toHaveClass('rounded-md');
    expect(bookedTile).not.toHaveClass('border');
    expect(bookedTile).toBeEmptyDOMElement();
    await userEvent.click(screen.getByRole('button', { name: /My bookings/ }));
    const upcoming = screen.getByRole('region', { name: 'Your upcoming bookings' });
    expect(within(upcoming).getByText('Prusa MK4')).toBeInTheDocument();
    expect(within(upcoming).getByText(/New enclosure/)).toBeInTheDocument();
  });

  it('disables occupied slots and rejects a manually entered overlap', async () => {
    vi.mocked(getBookings).mockResolvedValue([reservation()]);
    await chooseTomorrow();
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Booked' })).toHaveClass('bg-rose-500/70', 'h-11');
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Booked' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 11:00: Booked' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 12:00: Available' })).toHaveClass('bg-slate-700');
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 12:00: Available' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Equipment: Prusa MK4' }));
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '10:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reservation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('overlaps an existing booking');
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('keeps weekday and month names capitalized in booking details', async () => {
    const start = new Date(`${tomorrow()}T10:00`);
    start.setDate(start.getDate() + 2);
    const end = new Date(start);
    end.setHours(12);
    vi.mocked(getBookings).mockResolvedValue([reservation({ Start: start.toISOString(), End: end.toISOString() })]);
    renderPage();
    await screen.findByText('Prusa MK4');
    await userEvent.click(screen.getByRole('button', { name: start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }));
    await userEvent.click(screen.getByRole('button', { name: 'Equipment: Prusa MK4' }));
    expect(screen.getByRole('heading', { name: `Booked on ${start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}` })).toBeInTheDocument();
  });

  it('does not offer slots when equipment is under maintenance', async () => {
    vi.mocked(getEquipment).mockResolvedValue([{ ...EQUIPMENT, Status: 'MAINTENANCE', MaintenanceNote: 'Replacing hotend' }]);
    await chooseTomorrow();
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Unavailable' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Equipment: Prusa MK4' }));
    expect(screen.queryByRole('button', { name: 'Confirm reservation' })).not.toBeInTheDocument();
    expect(screen.getByText(/can't be booked until/)).toBeInTheDocument();
  });

  it('keeps reservation controls disabled if bookings fail to load', async () => {
    vi.mocked(getBookings).mockRejectedValue(new Error('Bookings unavailable'));
    await chooseTomorrow();
    expect(screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Loading' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Equipment: Prusa MK4' }));
    expect(screen.getByRole('button', { name: 'Confirm reservation' })).toBeDisabled();
  });

  it('changes days with an unfinished reservation without a discard prompt', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Available' }));
    await userEvent.type(screen.getByLabelText('What are you using it for? (optional)'), 'Prototype');
    const next = new Date(`${tomorrow()}T00:00`);
    next.setDate(next.getDate() + 1);
    await userEvent.click(screen.getByRole('button', { name: next.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('What are you using it for? (optional)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: next.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches time slots and equipment without a discard prompt', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(getEquipment).mockResolvedValue([EQUIPMENT, { ...EQUIPMENT, ID: 2, Name: 'Hakko', Category: 'Soldering' }]);
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 at 10:00: Available' }));
    await userEvent.type(screen.getByLabelText('What are you using it for? (optional)'), 'Prototype');
    await userEvent.click(screen.getByRole('button', { name: 'Prusa MK4 at 12:00: Available' }));
    expect(screen.getByLabelText('Start')).toHaveValue('12:00');
    expect(screen.getByLabelText('What are you using it for? (optional)')).toHaveValue('');
    await userEvent.type(screen.getByLabelText('What are you using it for? (optional)'), 'Another project');
    await userEvent.click(screen.getByRole('button', { name: 'Equipment: Hakko' }));
    expect(screen.getByRole('heading', { name: 'Hakko' })).toBeInTheDocument();
    expect(screen.getByLabelText('What are you using it for? (optional)')).toHaveValue('');
    expect(confirm).not.toHaveBeenCalled();
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
    const upcoming = screen.getByRole('region', { name: 'Your upcoming bookings' });
    expect(within(upcoming).getAllByRole('listitem')).toHaveLength(1);
    expect(within(upcoming).getByText(/My project/)).toBeInTheDocument();
    await userEvent.click(within(upcoming).getByRole('button', { name: 'Cancel booking for Prusa MK4' }));
    expect(cancelBooking).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await waitFor(() => expect(cancelBooking).toHaveBeenCalledWith(43, expect.objectContaining({ loggedIn: true, disabled: false })));
    expect(await screen.findByText('No upcoming reservations yet.')).toBeInTheDocument();
  });

  it('keeps the equipment panel and reservation when dismissing cancellation', async () => {
    vi.mocked(getBookings).mockResolvedValue([reservation({ Mine: true })]);
    await chooseTomorrow();
    await userEvent.click(screen.getByRole('button', { name: 'Equipment: Prusa MK4' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(screen.getByRole('alertdialog', { name: 'Cancel booking?' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(cancelBooking).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Prusa MK4' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel booking' }));
    await waitFor(() => expect(cancelBooking).toHaveBeenCalledWith(42, expect.objectContaining({ loggedIn: true, disabled: false })));
  });
});

describe('BookingsPage: equipment permissions', () => {
  const authenticate = (permissions: string[]) => {
    const session = { loggedIn: true as const, disabled: false as const, name: 'Taylor', email: 'taylor@example.com', permissions };
    vi.mocked(useAuth).mockReturnValue({ data: session } as never);
    return session;
  };
  const openEquipment = async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Equipment: Prusa MK4' }));
  };

  it.each([
    { permissions: [], add: false, modify: false, remove: false },
    { permissions: ['BookingAdd'], add: true, modify: false, remove: false },
    { permissions: ['BookingModify'], add: false, modify: true, remove: false },
    { permissions: ['BookingDelete'], add: false, modify: false, remove: true },
    { permissions: ['BookingManage'], add: false, modify: false, remove: false },
    { permissions: ['CreateItem', 'ModifyItem', 'DeleteItem'], add: false, modify: false, remove: false },
    { permissions: ['Administrator'], add: true, modify: true, remove: true },
  ])('gates equipment controls independently for $permissions', async ({ permissions, add, modify, remove }) => {
    authenticate(permissions);
    await openEquipment();
    expect(!!screen.queryByRole('button', { name: 'Add equipment' })).toBe(add);
    expect(!!screen.queryByRole('button', { name: 'Edit equipment' })).toBe(modify);
    expect(!!screen.queryByRole('button', { name: 'Delete equipment' })).toBe(remove);
    expect(screen.getByRole('button', { name: 'Confirm reservation' })).toBeEnabled();
  });

  it('creates equipment with its permission and updates the schedule', async () => {
    const session = authenticate(['BookingAdd']);
    const created = { ...EQUIPMENT, ID: 2, Name: 'New printer', Location: 'Bench B' };
    vi.mocked(createEquipment).mockResolvedValue(created);
    renderPage();
    await screen.findByText('Prusa MK4');
    await userEvent.click(screen.getByRole('button', { name: 'Add equipment' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add bookable equipment' }));
    await userEvent.type(dialog.getByLabelText('Name'), 'New printer');
    await userEvent.type(dialog.getByLabelText('Category'), '3D printers');
    await userEvent.type(dialog.getByLabelText('Location'), 'Bench B');
    await userEvent.click(dialog.getByRole('button', { name: 'Add equipment' }));
    await waitFor(() => expect(createEquipment).toHaveBeenCalledWith(expect.objectContaining({ Name: 'New printer', Category: '3D printers', Location: 'Bench B', Status: 'ACTIVE' }), session));
    expect(await screen.findByRole('button', { name: 'Equipment: New printer' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('edits equipment, preserves errors, and retries without losing the form', async () => {
    const session = authenticate(['BookingModify']);
    vi.mocked(updateEquipment).mockRejectedValueOnce(new Error('Save failed')).mockResolvedValue({ ...EQUIPMENT, Name: 'Updated printer', Status: 'MAINTENANCE', MaintenanceNote: 'Repair' });
    await openEquipment();
    await userEvent.click(screen.getByRole('button', { name: 'Edit equipment' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Edit bookable equipment' }));
    await userEvent.clear(dialog.getByLabelText('Name'));
    await userEvent.type(dialog.getByLabelText('Name'), 'Updated printer');
    await userEvent.selectOptions(dialog.getByLabelText('Status'), 'MAINTENANCE');
    await userEvent.type(dialog.getByLabelText('Maintenance note'), 'Repair');
    await userEvent.click(dialog.getByRole('button', { name: 'Save equipment' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Save failed');
    expect(dialog.getByLabelText('Name')).toHaveValue('Updated printer');
    await userEvent.click(dialog.getByRole('button', { name: 'Save equipment' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(updateEquipment).toHaveBeenLastCalledWith(1, expect.objectContaining({ Name: 'Updated printer', Status: 'MAINTENANCE', MaintenanceNote: 'Repair' }), session);
    expect(screen.getByText(/This equipment can't be booked/)).toBeInTheDocument();
  });

  it('confirms equipment deletion, handles failure, and removes dependent reservations', async () => {
    const session = authenticate(['BookingDelete']);
    vi.mocked(getBookings).mockResolvedValue([reservation({ Mine: true })]);
    vi.mocked(deleteEquipment).mockRejectedValueOnce(new Error('Delete failed')).mockResolvedValue(undefined);
    await openEquipment();
    await userEvent.click(screen.getByRole('button', { name: 'Delete equipment' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('All of its reservations will also be removed.');
    await userEvent.keyboard('{Escape}');
    expect(deleteEquipment).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Close equipment details' })).toBeInTheDocument();
    for (const attempt of [1, 2]) {
      await userEvent.click(screen.getByRole('button', { name: 'Delete equipment' }));
      await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete equipment' }));
      if (attempt === 1) expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed');
    }
    await waitFor(() => expect(deleteEquipment).toHaveBeenLastCalledWith(1, session));
    expect(await screen.findByText('No equipment yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /My bookings/ }));
    expect(screen.getByText('No upcoming reservations yet.')).toBeInTheDocument();
  });

  it('closes the equipment editor with Escape without closing equipment details', async () => {
    authenticate(['BookingModify']);
    await openEquipment();
    await userEvent.click(screen.getByRole('button', { name: 'Edit equipment' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close equipment details' })).toBeInTheDocument();
  });

  it.each([false, true])('edits own reservations without equipment permissions (from My bookings: %s)', async (fromMine) => {
    const session = authenticate([]);
    const booking = reservation({ Mine: true });
    vi.mocked(getBookings).mockResolvedValue([booking]);
    vi.mocked(updateBooking).mockResolvedValue({ ...booking, Purpose: 'Revised' });
    renderPage();
    await screen.findByText('Prusa MK4');
    if (fromMine) {
      await userEvent.click(screen.getByRole('button', { name: /My bookings/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Edit booking for Prusa MK4' }));
    } else {
      await userEvent.click(screen.getByRole('button', { name: new Date(`${tomorrow()}T00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }));
      await userEvent.click(screen.getByRole('button', { name: 'Equipment: Prusa MK4' }));
      await userEvent.click(screen.getByRole('button', { name: 'Edit booking' }));
    }
    expect(screen.getByLabelText('Start')).toHaveValue('10:00');
    expect(screen.getByLabelText('Duration')).toHaveValue('2');
    await userEvent.clear(screen.getByLabelText('What are you using it for? (optional)'));
    await userEvent.type(screen.getByLabelText('What are you using it for? (optional)'), 'Revised');
    await userEvent.click(screen.getByRole('button', { name: 'Save reservation' }));
    await waitFor(() => expect(updateBooking).toHaveBeenCalledWith(booking.ID, expect.objectContaining({ Start: booking.Start, End: booking.End, Purpose: 'Revised' }), session));
    expect(createBooking).not.toHaveBeenCalled();
  });

  it.each([
    { permissions: [], allowed: false },
    { permissions: ['BookingAdd', 'BookingModify', 'BookingDelete'], allowed: false },
    { permissions: ['BookingManage'], allowed: true },
    { permissions: ['Administrator'], allowed: true },
  ])('restricts managing other users’ reservations for $permissions', async ({ permissions, allowed }) => {
    const session = authenticate(permissions);
    const booking = reservation();
    vi.mocked(getBookings).mockResolvedValue([booking]);
    vi.mocked(updateBooking).mockResolvedValue(booking);
    await openEquipment();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: tomorrow() } });
    expect(!!screen.queryByRole('button', { name: 'Edit booking for Alex' })).toBe(allowed);
    expect(!!screen.queryByRole('button', { name: 'Cancel booking for Alex' })).toBe(allowed);
    if (allowed) {
      await userEvent.click(screen.getByRole('button', { name: 'Edit booking for Alex' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save reservation' }));
      await waitFor(() => expect(updateBooking).toHaveBeenCalledWith(booking.ID, expect.objectContaining({ Purpose: booking.Purpose }), session));
      await userEvent.click(screen.getByRole('button', { name: 'Equipment: Prusa MK4' }));
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: tomorrow() } });
      await userEvent.click(screen.getByRole('button', { name: 'Cancel booking for Alex' }));
      await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel booking' }));
      await waitFor(() => expect(cancelBooking).toHaveBeenCalledWith(booking.ID, session));
    }
  });
});

describe('BookingsPage: all bookings', () => {
  const authenticate = (permissions = ['BookingManage']) => {
    const session = { loggedIn: true as const, disabled: false as const, name: 'Taylor', email: 'taylor@example.com', permissions };
    vi.mocked(useAuth).mockReturnValue({ data: session } as never);
    return session;
  };
  const openAll = async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /All bookings/ }));
    return screen.findByRole('region', { name: 'All bookings' });
  };

  it.each([
    { permissions: [], visible: false },
    { permissions: ['BookingAdd'], visible: false },
    { permissions: ['BookingModify', 'BookingDelete'], visible: false },
    { permissions: ['BookingManage'], visible: true },
    { permissions: ['Administrator'], visible: true },
  ])('gates the third tab for $permissions', ({ permissions, visible }) => {
    authenticate(permissions);
    renderPage();
    expect(!!screen.queryByRole('button', { name: /All bookings/ })).toBe(visible);
  });

  it('excludes ended bookings and lists current/upcoming bookings chronologically with owners and cross-day dates', async () => {
    authenticate();
    const ended = reservation({ ID: 40, UserName: 'Sam', Start: new Date(Date.now() - 7200_000).toISOString(), End: new Date(Date.now() - 3600_000).toISOString(), Purpose: 'Finished project' });
    const overnight = reservation({ ID: 44, Mine: true, Start: new Date(`${tomorrow()}T23:00`).toISOString(), End: new Date(new Date(`${tomorrow()}T23:00`).getTime() + 7200_000).toISOString() });
    vi.mocked(getBookings).mockResolvedValue([overnight, reservation(), ended]);
    const list = within(await openAll());
    const rows = list.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(list.queryByText(/Sam|Ended|Finished project/)).not.toBeInTheDocument();
    expect(rows[0]).toHaveTextContent('Alex');
    expect(rows[0]).toHaveTextContent('Upcoming');
    expect(rows[1]).toHaveTextContent('You');
    expect(rows[1]).toHaveTextContent(fmtTime(new Date(overnight.Start)));
    expect(rows[1]).toHaveTextContent(fmtTime(new Date(overnight.End)));
    expect(rows[1]).toHaveTextContent(fmtDay(new Date(overnight.End), new Date()));
    expect(screen.getByRole('button', { name: 'All bookings (2)' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: /My bookings/ }));
    expect(within(screen.getByRole('region', { name: 'Your upcoming bookings' })).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('Finished project')).not.toBeInTheDocument();
  });

  it('cancels another user’s booking with confirmation and retries failures', async () => {
    const session = authenticate();
    vi.mocked(getBookings).mockResolvedValue([reservation()]);
    vi.mocked(cancelBooking).mockRejectedValueOnce(new Error('Cancellation failed')).mockResolvedValue(undefined);
    await openAll();
    const cancel = () => screen.getByRole('button', { name: 'Cancel booking for Alex on Prusa MK4' });
    expect(cancel()).toHaveTextContent('Cancel');
    await userEvent.click(cancel());
    await userEvent.click(screen.getByRole('button', { name: 'Keep booking' }));
    expect(cancelBooking).not.toHaveBeenCalled();
    await userEvent.click(cancel());
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel booking' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cancellation failed');
    expect(cancel()).toBeEnabled();
    await userEvent.click(cancel());
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel booking' }));
    await waitFor(() => expect(cancelBooking).toHaveBeenLastCalledWith(42, session));
    expect(await screen.findByText('No current or upcoming bookings.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All bookings (0)' })).toBeInTheDocument();
  });

  it('edits another user’s reservation from the list without changing its owner', async () => {
    const session = authenticate();
    const booking = reservation();
    vi.mocked(getBookings).mockResolvedValue([booking]);
    vi.mocked(updateBooking).mockResolvedValue({ ...booking, Purpose: 'Updated project' });
    await openAll();
    await userEvent.click(screen.getByRole('button', { name: 'Edit booking for Alex on Prusa MK4' }));
    expect(screen.getByRole('heading', { name: 'Edit reservation for Alex' })).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('What are you using it for? (optional)'));
    await userEvent.type(screen.getByLabelText('What are you using it for? (optional)'), 'Updated project');
    await userEvent.click(screen.getByRole('button', { name: 'Save reservation' }));
    await waitFor(() => expect(updateBooking).toHaveBeenCalledWith(42, expect.objectContaining({ Purpose: 'Updated project' }), session));
    const list = within(screen.getByRole('region', { name: 'All bookings' }));
    expect(await list.findByText(/Updated project/)).toBeInTheDocument();
    expect(list.getByText(/Alex/)).toBeInTheDocument();
  });

  it('allows cancelling in-progress bookings but not editing their start', async () => {
    authenticate();
    vi.mocked(getBookings).mockResolvedValue([reservation({
      Start: new Date(Date.now() - 3600_000).toISOString(), End: new Date(Date.now() + 3600_000).toISOString(),
    })]);
    const list = within(await openAll());
    expect(list.getByText(/In progress/)).toBeInTheDocument();
    expect(list.getByRole('button', { name: /^Cancel booking/ })).toBeEnabled();
    expect(list.queryByRole('button', { name: /^Edit booking/ })).not.toBeInTheDocument();
  });

  it('shows a loading list and an empty state', async () => {
    authenticate();
    let resolveBookings!: (bookings: Booking[]) => void;
    vi.mocked(getBookings).mockReturnValue(new Promise((resolve) => { resolveBookings = resolve; }));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /All bookings/ }));
    expect(screen.getByRole('status', { name: 'Loading all bookings' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('No current or upcoming bookings.')).not.toBeInTheDocument();
    await act(async () => resolveBookings([]));
    expect(await screen.findByText('No current or upcoming bookings.')).toBeInTheDocument();
  });

  it('shows an empty list and zero count when all bookings have ended', async () => {
    authenticate();
    vi.mocked(getBookings).mockResolvedValue([reservation({
      Start: new Date(Date.now() - 7200_000).toISOString(),
      End: new Date(Date.now() - 3600_000).toISOString(),
    })]);
    await openAll();
    expect(screen.getByText('No current or upcoming bookings.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All bookings (0)' })).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('recovers a failed bookings load in the All bookings tab', async () => {
    authenticate();
    vi.mocked(getBookings).mockRejectedValueOnce(new Error('Bookings unavailable')).mockResolvedValue([reservation()]);
    await openAll();
    expect(screen.getByRole('alert')).toHaveTextContent('Bookings unavailable');
    expect(screen.getByText('Bookings could not be loaded. Try again above.')).toBeInTheDocument();
    expect(screen.queryByText('No current or upcoming bookings.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Cancel booking for Alex on Prusa MK4' })).toBeInTheDocument();
  });

  it.each(['BookingManage', 'Administrator'])('hides the all-bookings list immediately when %s access is removed', async (permission) => {
    authenticate([permission]);
    vi.mocked(getBookings).mockResolvedValue([reservation(), reservation({ ID: 43, Mine: true })]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage(client);
    await userEvent.click(screen.getByRole('button', { name: /All bookings/ }));
    await screen.findByRole('region', { name: 'All bookings' });
    authenticate([]);
    act(() => client.setQueryData(['bookings', 'taylor@example.com'], [reservation(), reservation({ ID: 43, Mine: true, Purpose: 'My booking' })]));
    expect(await screen.findByRole('region', { name: 'Your upcoming bookings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /All bookings/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'All bookings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel booking for Alex on Prusa MK4' })).not.toBeInTheDocument();
  });
});
