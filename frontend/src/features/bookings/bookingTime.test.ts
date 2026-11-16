import { describe, expect, it } from 'vitest';
import { bookingError, bookingsForDay, bookingWindowEnd, freeHours, startOfDay, weekDates } from './bookingTime';
import type { Booking, Equipment } from './bookingsapi';

const now = new Date('2026-11-16T09:15');
const day = startOfDay('2026-11-16');
const booking = (start: string, end: string): Booking => ({
  ID: 1, EquipmentID: 1, UserName: 'Alex', Mine: false, Purpose: '',
  Start: new Date(start).toISOString(),
  End: new Date(end).toISOString(),
});
const printer: Equipment = {
  ID: 1, Name: 'Prusa', Category: '3D printers', Location: 'Workshop', Description: '', Status: 'ACTIVE',
};
const tool: Equipment = { ...printer, Category: 'Soldering' };

describe('booking availability', () => {
  it('excludes past times and partially occupied hours but permits adjacent slots', () => {
    const bookings = [booking('2026-11-16T10:15', '2026-11-16T11:00')];
    const hours = freeHours(day, bookings, now);
    expect(hours).not.toContain(8);
    expect(hours).not.toContain(9);
    expect(hours).not.toContain(10);
    expect(hours).toContain(11);
    expect(hours).toContain(19);
    expect(hours).not.toContain(20);
  });

  it('offers every opening-hour slot on an unbooked future day', () => {
    expect(freeHours(startOfDay('2026-11-17'), [], now)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('includes bookings crossing midnight, excluding those ending at the day boundary', () => {
    const crossing = booking('2026-11-15T19:00', '2026-11-16T10:00');
    const previous = booking('2026-11-15T19:00', '2026-11-16T00:00');
    expect(bookingsForDay([previous, crossing], day)).toEqual([crossing]);
    expect(freeHours(day, [crossing], new Date('2026-11-16T07:00'))[0]).toBe(10);
  });

  it('offers printers around the clock and tools only during working hours', () => {
    const future = startOfDay('2026-11-17');
    expect(freeHours(future, [], now, '3D printers')).toHaveLength(24);
    expect(freeHours(future, [], now, 'Soldering')).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('allows overnight printer bookings but not overnight tool bookings', () => {
    const start = new Date('2026-11-17T23:00');
    const end = new Date('2026-11-18T07:00');
    expect(bookingError(printer, [], start, end, now)).toBeNull();
    expect(bookingError(tool, [], start, end, now)).toMatch(/between 08:00 and 20:00/);
  });

  it('accepts eight hours but rejects longer sessions', () => {
    const start = new Date('2026-11-17T08:00');
    expect(bookingError(printer, [], start, new Date('2026-11-17T16:00'), now)).toBeNull();
    expect(bookingError(printer, [], start, new Date('2026-11-17T17:00'), now)).toMatch(/at most 8 hours/);
  });

  it('rejects back-to-back own bookings exceeding eight consecutive hours', () => {
    const previous = { ...booking('2026-11-17T08:00', '2026-11-17T16:00'), Mine: true };
    const start = new Date('2026-11-17T16:00');
    const end = new Date('2026-11-17T17:00');
    expect(bookingError(printer, [previous], start, end, now)).toMatch(/8 consecutive hours/);
    expect(bookingError(printer, [{ ...previous, Mine: false }], start, end, now)).toBeNull();
    expect(bookingError(printer, [previous], new Date('2026-11-17T17:00'), new Date('2026-11-17T18:00'), now)).toBeNull();
  });

  it('limits the booking window to seven local calendar days', () => {
    expect(weekDates(now)).toHaveLength(7);
    expect(weekDates(now)[6]).toEqual(startOfDay('2026-11-22'));
    expect(bookingWindowEnd(now)).toEqual(startOfDay('2026-11-23'));
    expect(bookingError(printer, [], new Date('2026-11-22T23:00'), new Date('2026-11-23T00:00'), now)).toBeNull();
    expect(bookingError(printer, [], new Date('2026-11-22T23:00'), new Date('2026-11-23T01:00'), now)).toMatch(/next seven days/);
    expect(freeHours(startOfDay('2026-11-23'), [], now, '3D printers')).toEqual([]);
  });
});
