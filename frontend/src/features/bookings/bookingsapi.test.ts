import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../auth/auth';
import * as api from './bookingsapi';
import type { Booking, Equipment, NewEquipment } from './bookingsapi';

const auth = (...permissions: string[]): AuthState => ({
  loggedIn: true, disabled: false, name: 'Taylor', email: 'taylor@example.com', permissions,
});
const draft: NewEquipment = { Name: 'Test printer', Category: '3D printers', Location: 'Bench', Description: '', Status: 'ACTIVE' };
const equipment: Equipment = { ID: 7, ...draft, MaintenanceNote: '', OpenHour: 0, CloseHour: 24 };
const booking: Booking = {
  ID: 3, EquipmentID: 7, UserName: 'Taylor', Mine: true,
  Start: '2026-11-17T10:00:00Z', End: '2026-11-17T11:00:00Z', Purpose: 'Test',
};

const fetchMock = vi.fn<typeof fetch>();
const respond = (status: number, body?: unknown) =>
  fetchMock.mockResolvedValueOnce(new Response(body === undefined ? null : JSON.stringify(body), { status }));
const lastCall = () => {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url: String(url), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined, init };
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('equipment API', () => {
  it('loads equipment and treats a null list as empty', async () => {
    respond(200, { equipment: [equipment] });
    expect(await api.getEquipment()).toEqual([equipment]);
    expect(lastCall()).toMatchObject({ method: 'GET', init: { credentials: 'include' } });
    expect(lastCall().url).toMatch(/\/equipment$/);

    respond(200, { equipment: null });
    expect(await api.getEquipment()).toEqual([]);
  });

  it('creates, updates and deletes equipment with the matching permission', async () => {
    respond(201, { equipment });
    expect(await api.createEquipment(draft, auth('BookingAdd'))).toEqual(equipment);
    expect(lastCall()).toMatchObject({ method: 'POST', body: draft });

    respond(200, { equipment: { ...equipment, Name: 'Updated' } });
    expect((await api.updateEquipment(7, { ...draft, Name: 'Updated' }, auth('BookingModify'))).Name).toBe('Updated');
    expect(lastCall()).toMatchObject({ method: 'PUT', body: { Name: 'Updated' } });
    expect(lastCall().url).toMatch(/\/equipment\/7$/);

    respond(204);
    await api.deleteEquipment(7, auth('BookingDelete'));
    expect(lastCall()).toMatchObject({ method: 'DELETE' });
    expect(lastCall().url).toMatch(/\/equipment\/7$/);
  });

  it('rejects equipment changes without the permission before calling the server', async () => {
    await expect(api.createEquipment(draft, auth('BookingModify'))).rejects.toThrow('permission');
    await expect(api.updateEquipment(7, draft, auth('BookingAdd'))).rejects.toThrow('permission');
    await expect(api.deleteEquipment(7, auth('BookingModify'))).rejects.toThrow('permission');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets Administrator manage equipment', async () => {
    respond(201, { equipment });
    await api.createEquipment(draft, auth('Administrator'));
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('bookings API', () => {
  it('loads bookings and treats a null list as empty', async () => {
    respond(200, { bookings: [booking] });
    expect(await api.getBookings()).toEqual([booking]);
    expect(lastCall().url).toMatch(/\/bookings$/);

    respond(200, { bookings: null });
    expect(await api.getBookings()).toEqual([]);
  });

  it('creates, updates and cancels bookings', async () => {
    const payload = { EquipmentID: 7, Start: booking.Start, End: booking.End, Purpose: 'Test' };
    respond(201, { booking });
    expect(await api.createBooking(payload)).toEqual(booking);
    expect(lastCall()).toMatchObject({ method: 'POST', body: payload });

    respond(200, { booking: { ...booking, Purpose: 'Revised' } });
    expect((await api.updateBooking(3, { ...payload, Purpose: 'Revised' }, auth())).Purpose).toBe('Revised');
    expect(lastCall()).toMatchObject({ method: 'PUT', body: { Purpose: 'Revised' } });
    expect(lastCall().url).toMatch(/\/bookings\/3$/);

    respond(204);
    await api.cancelBooking(3, auth());
    expect(lastCall()).toMatchObject({ method: 'DELETE' });
    expect(lastCall().url).toMatch(/\/bookings\/3$/);
  });

  it('shows the server error message when there is one', async () => {
    respond(409, { error: 'That time overlaps an existing booking.' });
    await expect(api.createBooking({ EquipmentID: 7, Start: booking.Start, End: booking.End, Purpose: '' }))
      .rejects.toThrow('That time overlaps an existing booking.');

    respond(403);
    await expect(api.cancelBooking(3, auth())).rejects.toThrow('Failed to cancel booking (403)');
  });
});
