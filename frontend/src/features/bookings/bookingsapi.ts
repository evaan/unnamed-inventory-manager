// Dummy equipment booking API. Same signatures the real client will have, backed by in-memory data.
// To go live: delete the DUMMY STORE section and swap each function body for the fetch shown in its comment.

export type EquipmentStatus = 'ACTIVE' | 'MAINTENANCE';

export interface Equipment {
  ID: number;
  Name: string;
  Category: string; // e.g. '3D printers', 'Soldering'
  Location: string;
  Description: string;
  Status: EquipmentStatus; // MAINTENANCE = can't be booked
  MaintenanceNote?: string;
}

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
const equipment: Equipment[] = [
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

  const add = (equipmentId: number, start: Date, end: Date) => {
    if (out.some((b) => b.EquipmentID === equipmentId && overlaps(start, end, new Date(b.Start), new Date(b.End)))) {
      return;
    }
    const mine = rand() < 0.12;
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
  add(1, nowStart, new Date(nowStart.getTime() + 2 * 3600_000));

  for (const eq of equipment) {
    if (eq.Status !== 'ACTIVE') continue;
    for (let day = 0; day < 7; day++) {
      const count = Math.floor(rand() * 3); // 0-2 bookings per day
      for (let n = 0; n < count; n++) {
        const startHour = 8 + Math.floor(rand() * 10); // 8:00 - 17:00
        const hours = 1 + Math.floor(rand() * 4); // 1-4 h
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
  if (eq.Status !== 'ACTIVE') throw new Error('This equipment is out of service');
  const start = new Date(booking.Start);
  const end = new Date(booking.End);
  if (!(end > start)) throw new Error('End time must be after the start time');
  const clash = bookings.find(
    (b) => b.EquipmentID === booking.EquipmentID && overlaps(start, end, new Date(b.Start), new Date(b.End))
  );
  if (clash) throw new Error('That time overlaps an existing booking');
  const created: Booking = { ID: nextBookingId++, UserName: 'You', Mine: true, ...booking };
  bookings = [...bookings, created];
  return { ...created };
};

// DELETE /bookings/:id   (only the person who made the booking, or an admin, may cancel)
export const cancelBooking = async (id: number): Promise<void> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/bookings/${id}`, { method: 'DELETE', credentials: 'include' });
  // if (!res.ok) throw new Error(`Failed to cancel booking (${res.status})`);
  const found = bookings.find((b) => b.ID === id);
  if (!found) throw new Error('Booking not found');
  if (!found.Mine) throw new Error("You can only cancel your own bookings");
  bookings = bookings.filter((b) => b.ID !== id);
};
