// Demo equipment booking API backed by in-memory data (changes reset on reload).
// A real API must derive permissions/ownership from its server session, never client-supplied auth or Mine.
import { bookingError, equipmentHours, equipmentHoursError } from './bookingTime';
import { hasPermission, type AuthState } from '../auth/auth';
import { canManageReservation } from './bookingPermissions';

export type EquipmentStatus = 'ACTIVE' | 'MAINTENANCE';

export interface Equipment {
  ID: number;
  Name: string;
  Category: string; // e.g. '3D printers', 'Soldering'
  Location: string;
  Description: string;
  Status: EquipmentStatus; // MAINTENANCE = can't be booked
  MaintenanceNote?: string;
  // Daily local working hours; absent values retain category defaults for demo data.
  OpenHour?: number;
  CloseHour?: number;
}

export type NewEquipment = Omit<Equipment, 'ID'>;

export interface Booking {
  ID: number;
  EquipmentID: number;
  UserName: string;
  // True when the booking belongs to the logged-in user. The server should set this from the session.
  Mine: boolean;
  Start: string; // ISO 8601
  End: string; // ISO 8601
  Purpose: string;
}

// What the client sends on create; the server assigns the ID and the user.
export type NewBooking = Pick<Booking, 'EquipmentID' | 'Start' | 'End' | 'Purpose'>;

/* ---------- DUMMY STORE (remove when the API is live) ---------- */
let equipment: Equipment[] = [
  { ID: 1, Name: 'Prusa MK4 #1', Category: '3D printers', Location: 'Maker bench A', Description: 'FDM printer, 250 × 210 × 220 mm build volume. PLA and PETG loaded.', Status: 'ACTIVE' },
  { ID: 2, Name: 'Prusa MK4 #2', Category: '3D printers', Location: 'Maker bench A', Description: 'FDM printer, 250 × 210 × 220 mm build volume. PLA loaded.', Status: 'ACTIVE' },
  { ID: 3, Name: 'Bambu Lab X1 Carbon', Category: '3D printers', Location: 'Maker bench B', Description: 'Enclosed CoreXY printer with multi-material AMS. Ask before printing ABS or ASA.', Status: 'ACTIVE' },
  { ID: 4, Name: 'Creality Ender-3 V2', Category: '3D printers', Location: 'Maker bench B', Description: 'Entry-level FDM printer, 220 × 220 × 250 mm.', Status: 'MAINTENANCE', MaintenanceNote: 'Waiting on a replacement hotend.' },
  { ID: 5, Name: 'Hakko FX-888D', Category: 'Soldering', Location: 'Electronics bench 1', Description: 'Digital soldering station, 70 W. Bring your own solder.', Status: 'ACTIVE' },
  { ID: 6, Name: 'Weller WE1010', Category: 'Soldering', Location: 'Electronics bench 2', Description: 'Temperature-controlled soldering station, 70 W.', Status: 'ACTIVE' },
  { ID: 7, Name: 'JBC hot air rework station', Category: 'Soldering', Location: 'Electronics bench 1', Description: 'Hot air station for SMD rework. Fume extractor required.', Status: 'ACTIVE' },
  { ID: 8, Name: 'T-962A reflow oven', Category: 'Soldering', Location: 'Electronics bench 2', Description: 'Benchtop reflow oven for small SMD boards. Profiles for leaded and lead-free paste.', Status: 'ACTIVE' },
  { ID: 9, Name: 'Rigol DS1054Z oscilloscope', Category: 'Test equipment', Location: 'Test bench', Description: '4-channel, 50 MHz digital oscilloscope with probes.', Status: 'ACTIVE' },
  { ID: 10, Name: 'Rigol DP832 power supply', Category: 'Test equipment', Location: 'Test bench', Description: 'Triple-output programmable bench power supply, 195 W.', Status: 'ACTIVE' },
  { ID: 11, Name: '40 W laser cutter', Category: 'Fabrication', Location: 'Workshop', Description: 'CO₂ laser cutter, 300 × 200 mm bed. Safety training required.', Status: 'ACTIVE' },
];

// Small seeded PRNG so the generated bookings look the same on every reload.
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const NAMES = ['Alex', 'Sam', 'Priya', 'Jordan', 'Maya', 'Chris'];
const PURPOSES = [
  'Enclosure prototype',
  'PCB rework',
  'Demo fixture',
  'Class project',
  'Repair',
  'Debugging the motor driver',
  'Spare parts',
  '',
];

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && bStart < aEnd;

// Bookings are generated relative to today so the page always has current data.
const generateBookings = (): Booking[] => {
  const rand = mulberry32(7);
  const out: Booking[] = [];
  let id = 1;
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const add = (equipmentId: number, start: Date, end: Date, owned?: boolean) => {
    if (out.some((b) => b.EquipmentID === equipmentId && overlaps(start, end, new Date(b.Start), new Date(b.End)))) {
      return;
    }
    const mine = owned ?? rand() < 0.12;
    out.push({
      ID: id++,
      EquipmentID: equipmentId,
      UserName: mine ? 'You' : NAMES[Math.floor(rand() * NAMES.length)],
      Mine: mine,
      Start: start.toISOString(),
      End: end.toISOString(),
      Purpose: PURPOSES[Math.floor(rand() * PURPOSES.length)],
    });
  };

  // One booking in progress right now, so "In use" shows up
  const nowStart = new Date();
  nowStart.setMinutes(0, 0, 0);
  add(1, nowStart, new Date(nowStart.getTime() + 2 * 3600_000), false);

  for (const eq of equipment) {
    if (eq.Status !== 'ACTIVE') continue;
    const { open, close } = equipmentHours(eq);
    for (let day = 0; day < 7; day++) {
      const count = Math.floor(rand() * 3); // 0-2 bookings per day
      for (let n = 0; n < count; n++) {
        const startHour = open + Math.floor(rand() * (close - open));
        const hours = Math.min(1 + Math.floor(rand() * 4), close - startHour);
        const start = new Date(midnight);
        start.setDate(start.getDate() + day);
        start.setHours(startHour, 0, 0, 0);
        const end = new Date(start.getTime() + hours * 3600_000);
        add(eq.ID, start, end);
      }
    }
  }
  return out;
};

let bookings: Booking[] = generateBookings();
let nextBookingId = bookings.length + 1;
let nextEquipmentId = Math.max(...equipment.map((item) => item.ID)) + 1;
const latency = () => new Promise((r) => setTimeout(r, 200));
/* ---------- /DUMMY STORE ---------- */

// GET /equipment  ->  Equipment[]
export const getEquipment = async (): Promise<Equipment[]> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/equipment`, { credentials: 'include' });
  // if (!res.ok) throw new Error(`Failed to load equipment (${res.status})`);
  // return res.json();
  return equipment.map((e) => ({ ...e }));
};

// Demo-only permission checks. The real API must enforce these from the server session.
const requirePermission = (auth: AuthState | undefined, permission: string) => {
  if (!hasPermission(auth, permission)) throw new Error('You do not have permission to manage this equipment.');
};

const equipmentValues = (item: NewEquipment): NewEquipment => {
  if (!item.Name.trim() || !item.Category.trim() || !item.Location.trim()) {
    throw new Error('Name, category, and location are required.');
  }
  if (!['ACTIVE', 'MAINTENANCE'].includes(item.Status)) throw new Error('Invalid equipment status.');
  const hoursItem = { ...item, Category: item.Category.trim() };
  const hoursError = equipmentHoursError(hoursItem);
  if (hoursError) throw new Error(hoursError);
  const { open, close } = equipmentHours(hoursItem);
  return {
    Name: item.Name.trim(), Category: item.Category.trim(), Location: item.Location.trim(),
    Description: item.Description.trim(), Status: item.Status,
    MaintenanceNote: item.Status === 'MAINTENANCE' ? item.MaintenanceNote?.trim() : '',
    OpenHour: open, CloseHour: close,
  };
};

export const createEquipment = async (item: NewEquipment, auth: AuthState): Promise<Equipment> => {
  await latency();
  requirePermission(auth, 'BookingAdd');
  const created = { ...equipmentValues(item), ID: nextEquipmentId++ };
  equipment = [...equipment, created];
  return { ...created };
};

export const updateEquipment = async (id: number, item: NewEquipment, auth: AuthState): Promise<Equipment> => {
  await latency();
  requirePermission(auth, 'BookingModify');
  if (!equipment.some((entry) => entry.ID === id)) throw new Error('Equipment not found');
  const updated = { ...equipmentValues(item), ID: id };
  equipment = equipment.map((entry) => entry.ID === id ? updated : entry);
  return { ...updated };
};

export const deleteEquipment = async (id: number, auth: AuthState): Promise<void> => {
  await latency();
  requirePermission(auth, 'BookingDelete');
  if (!equipment.some((entry) => entry.ID === id)) throw new Error('Equipment not found');
  equipment = equipment.filter((entry) => entry.ID !== id);
  bookings = bookings.filter((booking) => booking.EquipmentID !== id);
};

// GET /bookings  ->  Booking[]   (current and upcoming bookings for all equipment)
export const getBookings = async (): Promise<Booking[]> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/bookings`, { credentials: 'include' });
  // if (!res.ok) throw new Error(`Failed to load bookings (${res.status})`);
  // return res.json();
  const now = Date.now();
  return bookings.filter((b) => new Date(b.End).getTime() > now - 24 * 3600_000).map((b) => ({ ...b }));
};

// POST /bookings  { EquipmentID, Start, End, Purpose }  ->  Booking
// The server should reject overlaps (409) and out-of-service equipment.
export const createBooking = async (booking: NewBooking): Promise<Booking> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/bookings`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   credentials: 'include',
  //   body: JSON.stringify(booking),
  // });
  // const body = await res.json().catch(() => ({}));
  // if (!res.ok) throw new Error(body.error ?? `Failed to create booking (${res.status})`);
  // return body;
  const eq = equipment.find((e) => e.ID === booking.EquipmentID);
  if (!eq) throw new Error('Equipment not found');
  const start = new Date(booking.Start);
  const end = new Date(booking.End);
  const error = bookingError(eq, bookings, start, end, new Date());
  if (error) throw new Error(error);
  const created: Booking = { ID: nextBookingId++, UserName: 'You', Mine: true, ...booking };
  bookings = [...bookings, created];
  return { ...created };
};

// PUT /bookings/:id (owner or Administrator; preserve ownership and ignore the old slot during validation)
export const updateBooking = async (id: number, booking: NewBooking, auth: AuthState): Promise<Booking> => {
  await latency();
  const found = bookings.find((entry) => entry.ID === id);
  if (!found) throw new Error('Booking not found');
  if (!canManageReservation(auth, found)) throw new Error('You can only modify your own bookings.');
  const eq = equipment.find((entry) => entry.ID === booking.EquipmentID);
  if (!eq) throw new Error('Equipment not found');
  const error = bookingError(eq, bookings.filter((entry) => entry.ID !== id).map((entry) => ({
    ...entry, Mine: found.Mine ? entry.Mine : !entry.Mine && entry.UserName === found.UserName,
  })), new Date(booking.Start), new Date(booking.End), new Date());
  if (error) throw new Error(error);
  const updated = { ...found, EquipmentID: booking.EquipmentID, Start: booking.Start, End: booking.End, Purpose: booking.Purpose };
  bookings = bookings.map((entry) => entry.ID === id ? updated : entry);
  return { ...updated };
};

// DELETE /bookings/:id (owner or Administrator)
export const cancelBooking = async (id: number, auth: AuthState): Promise<void> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/bookings/${id}`, { method: 'DELETE', credentials: 'include' });
  // if (!res.ok) throw new Error(`Failed to cancel booking (${res.status})`);
  const found = bookings.find((b) => b.ID === id);
  if (!found) throw new Error('Booking not found');
  if (!canManageReservation(auth, found)) throw new Error("You can only cancel your own bookings");
  bookings = bookings.filter((b) => b.ID !== id);
};
