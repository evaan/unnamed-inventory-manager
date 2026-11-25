// Equipment booking API client. The backend enforces every permission and booking rule from
// the session; the checks here only give quicker, friendlier errors.
import { hasPermission, type AuthState } from '../auth/auth';

export type EquipmentStatus = 'ACTIVE' | 'MAINTENANCE';

export interface Equipment {
  ID: number;
  Name: string;
  Category: string; // e.g. '3D printers', 'Soldering'
  Location: string;
  Description: string;
  Status: EquipmentStatus; // MAINTENANCE = can't be booked
  MaintenanceNote?: string;
  // Daily working hours in the server's time zone; the server fills in category defaults.
  OpenHour?: number;
  CloseHour?: number;
  Icon?: string
}

export type NewEquipment = Omit<Equipment, 'ID'>;

export interface Booking {
  ID: number;
  EquipmentID: number;
  UserName: string;
  // True when the booking belongs to the logged-in user. Set by the server from the session.
  Mine: boolean;
  Start: string; // ISO 8601
  End: string; // ISO 8601
  Purpose: string;
}

// What the client sends on create; the server assigns the ID and the user.
export type NewBooking = Pick<Booking, 'EquipmentID' | 'Start' | 'End' | 'Purpose'>;

const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '');

// Throws the server's { error } message when there is one, so booking rule failures
// (overlaps, working hours, ...) read the same as they do in the booking panel.
async function request(path: string, init: RequestInit, errorPrefix: string): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (body && typeof body.error === 'string' && body.error) throw new Error(body.error);
    throw new Error(`${errorPrefix} (${res.status})`);
  }
  return res;
}

const requirePermission = (auth: AuthState | undefined, permission: string) => {
  if (!hasPermission(auth, permission)) throw new Error('You do not have permission to manage this equipment.');
};

// GET /equipment -> { equipment: Equipment[] }
export const getEquipment = async (): Promise<Equipment[]> => {
  const res = await request('/equipment', { method: 'GET' }, 'Failed to load equipment');
  const body: { equipment: Equipment[] | null } = await res.json();
  return body.equipment ?? [];
};

// POST /equipment (BookingAdd) -> 201 { equipment: Equipment }
export const createEquipment = async (item: NewEquipment, auth: AuthState): Promise<Equipment> => {
  requirePermission(auth, 'BookingAdd');
  const res = await request('/equipment', { method: 'POST', body: JSON.stringify(item) }, 'Failed to add equipment');
  const body: { equipment: Equipment } = await res.json();
  return body.equipment;
};

// PUT /equipment/{id} (BookingModify) -> { equipment: Equipment }
export const updateEquipment = async (id: number, item: NewEquipment, auth: AuthState): Promise<Equipment> => {
  requirePermission(auth, 'BookingModify');
  const res = await request(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify(item) }, 'Failed to update equipment');
  const body: { equipment: Equipment } = await res.json();
  return body.equipment;
};

// DELETE /equipment/{id} (BookingDelete) -> 204. The server also removes its bookings.
export const deleteEquipment = async (id: number, auth: AuthState): Promise<void> => {
  requirePermission(auth, 'BookingDelete');
  await request(`/equipment/${id}`, { method: 'DELETE' }, 'Failed to delete equipment');
};

// GET /bookings -> { bookings: Booking[] }   (current and upcoming bookings for all equipment)
export const getBookings = async (): Promise<Booking[]> => {
  const res = await request('/bookings', { method: 'GET' }, 'Failed to load bookings');
  const body: { bookings: Booking[] | null } = await res.json();
  return body.bookings ?? [];
};

// POST /bookings { EquipmentID, Start, End, Purpose } -> 201 { booking: Booking }
// The server rejects overlaps (409), out-of-service equipment and slots outside the rules (400).
export const createBooking = async (booking: NewBooking): Promise<Booking> => {
  const res = await request('/bookings', { method: 'POST', body: JSON.stringify(booking) }, 'Failed to create booking');
  const body: { booking: Booking } = await res.json();
  return body.booking;
};

// PUT /bookings/{id} (owner or BookingManage; the booking keeps its owner) -> { booking: Booking }
// auth is unused: ownership is checked by the server. It stays for call-site compatibility.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const updateBooking = async (id: number, booking: NewBooking, auth: AuthState): Promise<Booking> => {
  const res = await request(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(booking) }, 'Failed to update booking');
  const body: { booking: Booking } = await res.json();
  return body.booking;
};

// DELETE /bookings/{id} (owner or BookingManage) -> 204
// auth is unused: ownership is checked by the server. It stays for call-site compatibility.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const cancelBooking = async (id: number, auth: AuthState): Promise<void> => {
  await request(`/bookings/${id}`, { method: 'DELETE' }, 'Failed to cancel booking');
};
