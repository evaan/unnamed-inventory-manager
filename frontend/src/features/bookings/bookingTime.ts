import type { Booking, Equipment } from './bookingsapi';

export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 20;
export const MAX_HOURS = 8;
// Temporary rules for the dummy booking API.
export const equipmentHours = (category: string) =>
  category === '3D printers' ? { open: 0, close: 24 } : { open: OPEN_HOUR, close: CLOSE_HOUR };
export const pad = (n: number) => String(n).padStart(2, '0');
export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const startOfDay = (date: string) => new Date(`${date}T00:00`);
export const weekDates = (now: Date) => Array.from({ length: 7 }, (_, i) => {
  const date = startOfDay(toDateInput(now));
  date.setDate(date.getDate() + i);
  return date;
});
export const bookingWindowEnd = (now: Date) => {
  const end = startOfDay(toDateInput(now));
  end.setDate(end.getDate() + 7);
  return end;
};
export const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && bStart < aEnd;
export const fmtDay = (d: Date, now: Date) => {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

export const bookingsForDay = (bookings: Booking[], day: Date) => {
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  return bookings
    .filter((b) => overlaps(day, next, new Date(b.Start), new Date(b.End)))
    .sort((a, b) => a.Start.localeCompare(b.Start));
};

export const freeHours = (day: Date, bookings: Booking[], now: Date, category = '') => {
  const { open, close } = equipmentHours(category);
  return Array.from({ length: close - open }, (_, i) => i + open).filter((hour) => {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 1);
    return start >= now && end <= bookingWindowEnd(now) &&
      !bookings.some((b) => overlaps(start, end, new Date(b.Start), new Date(b.End)));
  });
};

export const bookingError = (equipment: Equipment, bookings: Booking[], start: Date, end: Date, now: Date): string | null => {
  if (equipment.Status !== 'ACTIVE') return 'This equipment is out of service.';
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Pick a date and times.';
  if (end <= start) return 'End time must be after the start time.';
  if (start < now) return 'That start time is in the past.';
  if (start >= bookingWindowEnd(now) || end > bookingWindowEnd(now)) return 'Bookings are limited to the next seven days.';
  if (end.getTime() - start.getTime() > MAX_HOURS * 3600_000) return `Bookings can be at most ${MAX_HOURS} hours.`;
  const { open, close } = equipmentHours(equipment.Category);
  if (close !== 24) {
    const opens = new Date(start);
    opens.setHours(open, 0, 0, 0);
    const closes = new Date(start);
    closes.setHours(close, 0, 0, 0);
    if (start < opens || end > closes) return `Bookings must be between ${pad(open)}:00 and ${pad(close)}:00.`;
  }
  const equipmentBookings = bookings.filter((b) => b.EquipmentID === equipment.ID);
  if (equipmentBookings.some((b) => overlaps(start, end, new Date(b.Start), new Date(b.End)))) {
    return 'That time overlaps an existing booking.';
  }
  // Back-to-back reservations must not bypass the consecutive-use limit.
  let from = start.getTime();
  let to = end.getTime();
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of equipmentBookings.filter((b) => b.Mine)) {
      const s = new Date(b.Start).getTime();
      const e = new Date(b.End).getTime();
      if (s <= to && e >= from && (s < from || e > to)) {
        from = Math.min(from, s);
        to = Math.max(to, e);
        changed = true;
      }
    }
  }
  if (to - from > MAX_HOURS * 3600_000) return `You can book equipment for at most ${MAX_HOURS} consecutive hours.`;
  return null;
};
