import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BookingSchedule } from './BookingSchedule';
import type { Booking, Equipment } from './bookingsapi';

const equipment: Equipment = {
  ID: 1, Name: 'Prusa', Category: '3D printers', Location: 'Workshop', Description: '', Status: 'ACTIVE',
};
const booking = (id: number, start: string, end: string, mine = false): Booking => ({
  ID: id, EquipmentID: 1, UserName: 'Alex', Mine: mine, Purpose: '',
  Start: new Date(start).toISOString(), End: new Date(end).toISOString(),
});
const renderSchedule = (bookings: Booking[], onSelect = vi.fn(), onSelectBooking = vi.fn()) => render(
  <BookingSchedule
    equipment={[equipment]}
    bookings={new Map([[1, bookings]])}
    day={new Date('2026-11-17T00:00')}
    now={new Date('2026-11-16T09:15')}
    selectedId={null}
    loaded
    onSelect={onSelect}
    onSelectBooking={onSelectBooking}
  />
);

describe('BookingSchedule reservation bars', () => {
  it('renders a multi-slot booking as one continuous bar', () => {
    renderSchedule([booking(1, '2026-11-17T10:30', '2026-11-17T13:00')]);
    const bar = screen.getByRole('button', { name: 'Prusa from 10:30 to 13:00: Booked' });
    expect(bar).toBeEnabled();
    expect(bar).toHaveStyle({ gridColumn: '22 / span 5', gridRow: '1' });
    expect(bar).toHaveAttribute('title', '10:30–13:00 · Booked');
    expect(screen.getAllByRole('button', { name: /: Booked$/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /at 11:00/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prusa at 10:00: Available' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Prusa at 13:00: Available' })).toBeEnabled();
  });

  it.each([false, true])('keeps adjacent reservations separate, even with the same owner (mine: %s)', (mine) => {
    renderSchedule([
      booking(1, '2026-11-17T10:00', '2026-11-17T12:00', mine),
      booking(2, '2026-11-17T12:00', '2026-11-17T13:30', mine),
    ]);
    const status = mine ? 'Your booking' : 'Booked';
    const first = screen.getByRole('button', { name: `Prusa from 10:00 to 12:00: ${status}` });
    const second = screen.getByRole('button', { name: `Prusa from 12:00 to 13:30: ${status}` });
    expect(first).toHaveStyle({ gridColumn: '21 / span 4' });
    expect(second).toHaveStyle({ gridColumn: '25 / span 3' });
    expect(first).toHaveClass('rounded-md');
    expect(second).toHaveClass('rounded-md');
    expect(first.parentElement).toHaveClass('gap-1');
    expect(screen.getAllByRole('button', { name: new RegExp(`: ${status}$`) })).toHaveLength(2);
  });

  it('clips overnight bookings to the displayed day without merging them', () => {
    renderSchedule([
      booking(1, '2026-11-16T23:00', '2026-11-17T02:00'),
      booking(2, '2026-11-17T23:30', '2026-11-18T01:00'),
      booking(3, '2026-11-18T02:00', '2026-11-18T03:00'),
    ]);
    expect(screen.getByRole('button', { name: 'Prusa from 00:00 to 02:00: Booked' })).toHaveStyle({ gridColumn: '1 / span 4' });
    expect(screen.getByRole('button', { name: 'Prusa from 23:30 to 24:00: Booked' })).toHaveStyle({ gridColumn: '48 / span 1' });
    expect(screen.getAllByRole('button', { name: /: Booked$/ })).toHaveLength(2);
  });

  it('opens booking details on click or keyboard activation without starting a new booking', async () => {
    const existing = booking(1, '2026-11-17T10:30', '2026-11-17T13:00');
    const onSelect = vi.fn();
    const onSelectBooking = vi.fn();
    renderSchedule([existing], onSelect, onSelectBooking);
    const bar = screen.getByRole('button', { name: 'Prusa from 10:30 to 13:00: Booked' });
    await userEvent.click(bar);
    expect(onSelectBooking).toHaveBeenLastCalledWith(existing);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    bar.focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelectBooking).toHaveBeenCalledTimes(2);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it.each([false, true])('shows one continuous preview while dragging (reverse: %s)', async (reverse) => {
    const onSelect = vi.fn();
    renderSchedule([], onSelect);
    const user = userEvent.setup();
    const first = screen.getByRole('button', { name: `Prusa at ${reverse ? '13:00' : '10:30'}: Available` });
    const last = screen.getByRole('button', { name: `Prusa at ${reverse ? '10:30' : '13:00'}: Available` });
    vi.spyOn(first.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 2400 } as DOMRect);
    await user.pointer({ keys: '[MouseLeft>]', target: first });
    expect(screen.getByRole('status')).toHaveStyle({ gridColumn: `${reverse ? 27 : 22} / span 1` });
    await user.pointer({ target: last, coords: { clientX: reverse ? 1075 : 1325 } });
    const preview = screen.getByRole('status', { name: 'New reservation from 10:30 to 13:30' });
    expect(preview).toHaveTextContent('10:30–13:30');
    expect(preview).toHaveStyle({ gridColumn: '22 / span 6', gridRow: '1' });
    expect(preview).toHaveClass('rounded-md', 'pointer-events-none');
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(first).toHaveClass('opacity-0');
    expect(last).toHaveClass('opacity-0');
    await user.pointer({ keys: '[/MouseLeft]' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(1, 10.5, 3);
  });

  it('stops the preview at an existing reservation', async () => {
    const onSelect = vi.fn();
    const onSelectBooking = vi.fn();
    renderSchedule([booking(1, '2026-11-17T12:00', '2026-11-17T13:00')], onSelect, onSelectBooking);
    const user = userEvent.setup();
    const first = screen.getByRole('button', { name: 'Prusa at 10:30: Available' });
    const row = first.parentElement!;
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 2400 } as DOMRect);
    await user.pointer({ keys: '[MouseLeft>]', target: first });
    await user.pointer({ target: row, coords: { clientX: 1325 } });
    expect(screen.getByRole('status', { name: 'New reservation from 10:30 to 12:00' })).toHaveStyle({ gridColumn: '22 / span 3' });
    expect(screen.getByRole('button', { name: 'Prusa from 12:00 to 13:00: Booked' })).not.toHaveClass('opacity-0');
    await user.pointer({ keys: '[/MouseLeft]' });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(1, 10.5, 1.5);
    expect(onSelectBooking).not.toHaveBeenCalled();
  });

  it('removes the preview on pointer cancellation without creating a reservation', async () => {
    const onSelect = vi.fn();
    renderSchedule([], onSelect);
    const first = screen.getByRole('button', { name: 'Prusa at 10:30: Available' });
    await userEvent.pointer({ keys: '[MouseLeft>]', target: first });
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.pointerCancel(first.parentElement!);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(first).not.toHaveClass('opacity-0');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
