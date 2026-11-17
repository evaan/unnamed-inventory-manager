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
  it.each([
    { name: 'no equipment permissions', session: auth() },
    { name: 'inventory permissions', session: auth('CreateItem', 'ModifyItem', 'DeleteItem') },
    { name: 'reservation manager', session: auth('BookingManage') },
    { name: 'disabled administrator', session: { loggedIn: true, disabled: true, permissions: ['Administrator'] } as AuthState },
    { name: 'logged out', session: { loggedIn: false } as AuthState },
  ])('rejects unauthorized mutations: $name', async ({ session }) => {
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

  it('rejects disabled users modifying or cancelling even their own bookings', async () => {
    const item = await complete(api.createEquipment(draft, auth('BookingAdd')));
    const booking = await complete(api.createBooking({ EquipmentID: item.ID, ...slot(10) }));
    const disabled: AuthState = { loggedIn: true, disabled: true };
    await expect(complete(api.updateBooking(booking.ID, { EquipmentID: item.ID, ...slot(10) }, disabled))).rejects.toThrow('own bookings');
    await expect(complete(api.cancelBooking(booking.ID, disabled))).rejects.toThrow('own bookings');
  });

  it.each(['BookingManage', 'Administrator'])('allows %s to manage other people’s bookings, not equipment permissions', async (permission) => {
    const booking = (await complete(api.getBookings())).find((entry) => !entry.Mine && new Date(entry.Start) > new Date() && entry.EquipmentID <= 3)!;
    expect(booking).toBeDefined();
    const payload = { EquipmentID: booking.EquipmentID, Start: booking.Start, End: booking.End, Purpose: 'Admin revision' };
    const equipmentManager = auth('BookingAdd', 'BookingModify', 'BookingDelete');
    await expect(complete(api.updateBooking(booking.ID, payload, equipmentManager))).rejects.toThrow('own bookings');
    await expect(complete(api.cancelBooking(booking.ID, equipmentManager))).rejects.toThrow('own bookings');
    const updated = await complete(api.updateBooking(booking.ID, payload, auth(permission)));
    expect(updated).toMatchObject({ ID: booking.ID, Mine: false, UserName: booking.UserName, Purpose: 'Admin revision' });
    await complete(api.cancelBooking(booking.ID, auth(permission)));
    expect(await complete(api.getBookings())).not.toContainEqual(expect.objectContaining({ ID: booking.ID }));
  });
});
