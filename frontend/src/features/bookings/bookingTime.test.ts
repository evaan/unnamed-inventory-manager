import { describe, expect, it } from 'vitest';
import { bookingError, formatEquipmentHours, freeHours, hourToTime, startOfDay, weekDates } from './bookingTime';
import type { Booking, Equipment } from './bookingsapi';

const now = new Date('2026-11-16T09:15');
const printer: Equipment = {
  ID: 1, Name: 'Prusa', Category: '3D printers', Location: 'Workshop', Description: '', Status: 'ACTIVE',
};

describe('booking availability', () => {
  it('offers printers around the clock and tools during working hours', () => {
    const future = startOfDay('2026-11-17');
    expect(freeHours(future, [], now, '3D printers')).toHaveLength(48);
    expect(freeHours(future, [], now, 'Soldering')).toEqual(Array.from({ length: 24 }, (_, i) => 8 + i * 0.5));
  });

  it('excludes past and occupied slots', () => {
    const booking: Booking = {
      ID: 1, EquipmentID: 1, UserName: 'Alex', Mine: false, Purpose: '',
      Start: new Date('2026-11-16T10:00').toISOString(),
      End: new Date('2026-11-16T11:00').toISOString(),
    };
    const hours = freeHours(startOfDay('2026-11-16'), [booking], now);
    expect(hours).not.toContain(9);
    expect(hours).toContain(9.5);
    expect(hours).not.toContain(10);
    expect(hours).not.toContain(10.5);
    expect(hours).toContain(11);
  });

  it('keeps the other half of an hour available beside a half-hour booking', () => {
    const booking: Booking = {
      ID: 1, EquipmentID: 1, UserName: 'Alex', Mine: false, Purpose: '',
      Start: new Date('2026-11-17T10:30').toISOString(),
      End: new Date('2026-11-17T11:00').toISOString(),
    };
    const hours = freeHours(startOfDay('2026-11-17'), [booking], now, printer);
    expect(hours).toContain(10);
    expect(hours).not.toContain(10.5);
    expect(hours).toContain(11);
    expect(hours).toContain(23.5);
  });

  it('formats half-hour slots and the midnight boundary', () => {
    expect(hourToTime(10)).toBe('10:00');
    expect(hourToTime(10.5)).toBe('10:30');
    expect(hourToTime(23.5)).toBe('23:30');
    expect(hourToTime(24)).toBe('24:00');
  });

  it('uses custom equipment hours for availability and booking validation', () => {
    const custom = { ...printer, OpenHour: 10, CloseHour: 14 };
    expect(formatEquipmentHours(custom)).toBe('10:00–14:00');
    expect(freeHours(startOfDay('2026-11-17'), [], now, custom)).toEqual([10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5]);
    expect(bookingError(custom, [], new Date('2026-11-17T10:00'), new Date('2026-11-17T12:00'), now)).toBeNull();
    expect(bookingError(custom, [], new Date('2026-11-17T09:00'), new Date('2026-11-17T11:00'), now)).toMatch(/between 10:00 and 14:00/);
  });

  it('limits booking duration to eight hours', () => {
    const start = new Date('2026-11-17T08:00');
    expect(bookingError(printer, [], start, new Date('2026-11-17T16:00'), now)).toBeNull();
    expect(bookingError(printer, [], start, new Date('2026-11-17T16:30'), now)).toMatch(/at most 8 hours/);
    expect(bookingError(printer, [], start, new Date('2026-11-17T17:00'), now)).toMatch(/at most 8 hours/);
  });

  it('limits bookings to the next seven days', () => {
    expect(weekDates(now)).toHaveLength(7);
    expect(weekDates(now)[6]).toEqual(startOfDay('2026-11-22'));
    expect(bookingError(printer, [], new Date('2026-11-23T10:00'), new Date('2026-11-23T11:00'), now)).toMatch(/next seven days/);
  });
});
