import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../auth/auth';
import type { NewEquipment } from './bookingsapi';

let api: typeof import('./bookingsapi');
const auth = (...permissions: string[]): AuthState => ({
  loggedIn: true, disabled: false, name: 'Taylor', email: 'taylor@example.com', permissions,
});
const draft: NewEquipment = { Name: ' Test printer ', Category: '3D printers', Location: ' Bench ', Description: '', Status: 'ACTIVE' };
// Advance demo latency without real-time delays; handle rejection immediately.
const complete = async <T,>(promise: Promise<T>): Promise<T> => {
  const result = promise.then((value) => ({ value }), (error: unknown) => ({ error }));
  await vi.runAllTimersAsync();
  const settled = await result;
  if ('error' in settled) throw settled.error;
  return settled.value;
};
const slot = (hour: number) => {
  const start = new Date(2026, 10, 17, hour);
  return { Start: start.toISOString(), End: new Date(start.getTime() + 3600_000).toISOString(), Purpose: 'Test' };
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 16, 12));
  vi.resetModules();
  api = await import('./bookingsapi');
});
afterEach(() => vi.useRealTimers());

describe('demo equipment API permissions', () => {
  it('rejects unauthorized equipment mutations', async () => {
    const session = auth();
    await expect(complete(api.createEquipment(draft, session))).rejects.toThrow('permission');
    await expect(complete(api.updateEquipment(1, draft, session))).rejects.toThrow('permission');
    await expect(complete(api.deleteEquipment(1, session))).rejects.toThrow('permission');
  });

  it('keeps add, modify, and delete grants independent', async () => {
    const item = await complete(api.createEquipment(draft, auth('BookingAdd')));
    expect(item).toMatchObject({ Name: 'Test printer', Location: 'Bench' });
    await expect(complete(api.updateEquipment(item.ID, draft, auth('BookingAdd')))).rejects.toThrow('permission');
    await expect(complete(api.deleteEquipment(item.ID, auth('BookingModify')))).rejects.toThrow('permission');
    await expect(complete(api.createEquipment(draft, auth('BookingDelete')))).rejects.toThrow('permission');
    const updated = await complete(api.updateEquipment(item.ID, { ...draft, Name: 'Updated' }, auth('BookingModify')));
    expect(updated.Name).toBe('Updated');
    await complete(api.deleteEquipment(item.ID, auth('BookingDelete')));
    expect(await complete(api.getEquipment())).not.toContainEqual(expect.objectContaining({ ID: item.ID }));
  });

  it('allows Administrator to do all operations and cascades equipment deletion', async () => {
    const admin = auth('Administrator');
    const item = await complete(api.createEquipment(draft, admin));
    const booking = await complete(api.createBooking({ EquipmentID: item.ID, ...slot(10) }));
    await complete(api.updateEquipment(item.ID, { ...draft, Status: 'MAINTENANCE' }, admin));
    await complete(api.deleteEquipment(item.ID, admin));
    expect(await complete(api.getBookings())).not.toContainEqual(expect.objectContaining({ ID: booking.ID }));
  });

  it('rejects incomplete equipment without adding it', async () => {
    const before = await complete(api.getEquipment());
    await expect(complete(api.createEquipment({ ...draft, Name: ' ' }, auth('BookingAdd')))).rejects.toThrow('required');
    expect(await complete(api.getEquipment())).toEqual(before);
  });

  it('saves custom working hours on create and update', async () => {
    const custom = await complete(api.createEquipment({ ...draft, OpenHour: 10, CloseHour: 14 }, auth('BookingAdd')));
    expect(custom).toMatchObject({ OpenHour: 10, CloseHour: 14 });
    await expect(complete(api.createBooking({ EquipmentID: custom.ID, ...slot(9) }))).rejects.toThrow(/between 10:00 and 14:00/);
    const updated = await complete(api.updateEquipment(custom.ID, { ...custom, OpenHour: 12, CloseHour: 24 }, auth('BookingModify')));
    expect(updated).toMatchObject({ OpenHour: 12, CloseHour: 24 });
    expect(await complete(api.getEquipment())).toContainEqual(updated);
    await complete(api.createBooking({ EquipmentID: custom.ID, ...slot(12) }));
  });

  it('rejects a closing time before opening without changing equipment', async () => {
    const hours = { OpenHour: 20, CloseHour: 8 };
    const before = await complete(api.getEquipment());
    await expect(complete(api.createEquipment({ ...draft, ...hours }, auth('BookingAdd')))).rejects.toThrow('Working hours');
    await expect(complete(api.updateEquipment(1, { ...draft, ...hours }, auth('BookingModify')))).rejects.toThrow('Working hours');
    expect(await complete(api.getEquipment())).toEqual(before);
  });
});

describe('demo reservation ownership', () => {
  it('edits an own booking without colliding with itself and retains its ID and owner', async () => {
    const item = await complete(api.createEquipment(draft, auth('BookingAdd')));
    const booking = await complete(api.createBooking({ EquipmentID: item.ID, ...slot(10) }));
    const updated = await complete(api.updateBooking(booking.ID, { EquipmentID: item.ID, ...slot(10), Purpose: 'Revised' }, auth()));
    expect(updated).toEqual({ ...booking, Purpose: 'Revised' });
    await complete(api.cancelBooking(booking.ID, auth()));
    expect(await complete(api.getBookings())).not.toContainEqual(expect.objectContaining({ ID: booking.ID }));
  });

  it('validates overlaps on edits and leaves failed edits unchanged', async () => {
    const item = await complete(api.createEquipment(draft, auth('BookingAdd')));
    const first = await complete(api.createBooking({ EquipmentID: item.ID, ...slot(10) }));
    await complete(api.createBooking({ EquipmentID: item.ID, ...slot(12) }));
    await expect(complete(api.updateBooking(first.ID, { EquipmentID: item.ID, ...slot(12) }, auth()))).rejects.toThrow(/overlap|already booked/i);
    expect(await complete(api.getBookings())).toContainEqual(first);
  });

  it('allows reservation managers, but not equipment managers, to manage other people’s bookings', async () => {
    const booking = (await complete(api.getBookings())).find((entry) => !entry.Mine && new Date(entry.Start) > new Date() && entry.EquipmentID <= 3)!;
    expect(booking).toBeDefined();
    const payload = { EquipmentID: booking.EquipmentID, Start: booking.Start, End: booking.End, Purpose: 'Admin revision' };
    const equipmentManager = auth('BookingAdd', 'BookingModify', 'BookingDelete');
    await expect(complete(api.updateBooking(booking.ID, payload, equipmentManager))).rejects.toThrow('own bookings');
    await expect(complete(api.cancelBooking(booking.ID, equipmentManager))).rejects.toThrow('own bookings');
    const updated = await complete(api.updateBooking(booking.ID, payload, auth('BookingManage')));
    expect(updated).toMatchObject({ ID: booking.ID, Mine: false, UserName: booking.UserName, Purpose: 'Admin revision' });
    await complete(api.cancelBooking(booking.ID, auth('BookingManage')));
    expect(await complete(api.getBookings())).not.toContainEqual(expect.objectContaining({ ID: booking.ID }));
  });
});
