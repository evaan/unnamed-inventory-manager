// Dummy item API. Same signatures the real client will have, backed by an in-memory array.
// To go live: delete the DUMMY STORE section and swap each function body for the fetch shown in its comment.

import { tagsForItem, forgetItemTags, linkItemTags, type Tag } from './tagsapi';

export interface Item {
  ID: number;
  ItemName: string;
  Quantity: number;
  Manufacturer: string;
  ManufacturerPart: string;
  DistributorPart: string;
  DistributorURL: string;
  DataSheetURL: string;
  Description: string;
  // Filled in by the API. Change tags with setItemTags in tagsapi.ts.
  // Live: map the backend's `tags` array with normalizeTag from tagsapi.ts.
  Tags?: Tag[];
}

// What the client sends on create; the server assigns the ID. Tags are set separately after creation.
export type NewItem = Omit<Item, 'ID' | 'Tags'>;

// Sent with POST / PUT / DELETE so the API can record what happened.
export type ItemAction = 'CREATE' | 'TAKEN' | 'ADDED' | 'DELETE';

/* ---------- DUMMY STORE (remove when the API is live) ---------- */
interface Part {
  name: string;
  mfr: string;
  mpn: string;
  dpn: string;
  desc: string;
  tags: string[];
}

// Hand-written parts
const PARTS: Part[] = [
  { name: 'ATmega328P-AU', mfr: 'Microchip', mpn: 'ATMEGA328P-AU', dpn: 'ATMEGA328P-AU-ND', desc: '8-bit AVR microcontroller, TQFP-32', tags: ['Microcontrollers', 'ICs', 'SMD'] },
  { name: 'STM32F103C8T6', mfr: 'STMicroelectronics', mpn: 'STM32F103C8T6', dpn: '497-6063-ND', desc: 'ARM Cortex-M3 MCU, 64 KB flash, LQFP-48', tags: ['Microcontrollers', 'ICs', 'SMD'] },
  { name: 'RP2040', mfr: 'Raspberry Pi', mpn: 'SC0914(13)', dpn: '2648-SC0914(13)CT-ND', desc: 'Dual-core Cortex-M0+ MCU, QFN-56', tags: ['Microcontrollers', 'ICs', 'SMD'] },
  { name: 'ESP32-WROOM-32E', mfr: 'Espressif', mpn: 'ESP32-WROOM-32E-N4', dpn: '1904-1023-1-ND', desc: 'Wi-Fi + Bluetooth module, 4 MB flash', tags: ['Microcontrollers', 'Wireless', 'SMD'] },
  { name: 'NE555 timer', mfr: 'Texas Instruments', mpn: 'NE555P', dpn: '296-1411-5-ND', desc: 'Precision timer, DIP-8', tags: ['ICs', 'Through-hole'] },
  { name: 'LM358 dual op-amp', mfr: 'Texas Instruments', mpn: 'LM358P', dpn: '296-1395-5-ND', desc: 'Dual operational amplifier, DIP-8', tags: ['ICs', 'Through-hole'] },
  { name: 'LM7805 regulator', mfr: 'onsemi', mpn: 'MC7805CTG', dpn: 'MC7805CTGOS-ND', desc: '5 V linear regulator, 1 A, TO-220', tags: ['Power', 'ICs', 'Through-hole'] },
  { name: 'AMS1117-3.3', mfr: 'Advanced Monolithic', mpn: 'AMS1117-3.3', dpn: '1114-AMS1117-3.3CT-ND', desc: '3.3 V LDO regulator, 1 A, SOT-223', tags: ['Power', 'ICs', 'SMD'] },
  { name: 'TPS63020 buck-boost', mfr: 'Texas Instruments', mpn: 'TPS63020DSJR', dpn: '296-35208-1-ND', desc: 'Buck-boost converter, 4 A switch', tags: ['Power', 'ICs', 'SMD'] },
  { name: '1N4148 diode', mfr: 'Vishay', mpn: '1N4148-TAP', dpn: '1N4148-TAPCT-ND', desc: 'Small signal switching diode, DO-35', tags: ['Through-hole'] },
  { name: '2N2222 transistor', mfr: 'onsemi', mpn: 'PN2222ABU', dpn: 'PN2222ABU-ND', desc: 'NPN bipolar transistor, TO-92', tags: ['Through-hole'] },
  { name: 'Red LED, 0603', mfr: 'Würth Elektronik', mpn: '150060RS75000', dpn: '732-4980-1-ND', desc: 'Red LED, 625 nm, 20 mA', tags: ['LEDs', 'SMD'] },
  { name: 'Green LED, 0603', mfr: 'Würth Elektronik', mpn: '150060GS75000', dpn: '732-4978-1-ND', desc: 'Green LED, 570 nm, 20 mA', tags: ['LEDs', 'SMD'] },
  { name: 'WS2812B RGB LED', mfr: 'Worldsemi', mpn: 'WS2812B', dpn: '1528-1104-ND', desc: 'Addressable RGB LED, 5050', tags: ['LEDs', 'SMD'] },
  { name: 'BME280 sensor', mfr: 'Bosch', mpn: 'BME280', dpn: '828-1063-1-ND', desc: 'Temperature, humidity and pressure sensor', tags: ['Sensors', 'ICs', 'SMD'] },
  { name: 'MPU-6050 IMU', mfr: 'TDK InvenSense', mpn: 'MPU-6050', dpn: '1428-1007-1-ND', desc: '6-axis accelerometer and gyroscope', tags: ['Sensors', 'ICs', 'SMD'] },
  { name: 'DHT22 sensor', mfr: 'Aosong', mpn: 'DHT22', dpn: '1528-1146-ND', desc: 'Digital temperature and humidity sensor', tags: ['Sensors', 'Through-hole'] },
  { name: 'USB-C receptacle', mfr: 'GCT', mpn: 'USB4105-GF-A', dpn: '2073-USB4105-GF-ACT-ND', desc: '16-pin USB Type-C, mid-mount', tags: ['Connectors', 'SMD'] },
  { name: 'JST-PH 2-pin header', mfr: 'JST', mpn: 'B2B-PH-K-S', dpn: '455-1704-ND', desc: '2 mm pitch, right-angle, through-hole', tags: ['Connectors', 'Through-hole'] },
  { name: '2.54 mm pin header, 1×40', mfr: 'Sullins', mpn: 'PRPC040SAAN-RC', dpn: 'S1011EC-40-ND', desc: 'Breakaway male header, 0.1 in pitch', tags: ['Connectors', 'Through-hole'] },
  { name: '10 µH inductor, 1210', mfr: 'Bourns', mpn: 'SRN6045TA-100M', dpn: 'SRN6045TA-100MCT-ND', desc: 'Shielded power inductor, 3.2 A', tags: ['Inductors', 'Passives', 'Power', 'SMD'] },
  { name: '16 MHz crystal, HC-49', mfr: 'ECS', mpn: 'ECS-160-20-5PX-TR', dpn: 'XC1259CT-ND', desc: 'Quartz crystal, 20 pF load', tags: ['Passives', 'Through-hole'] },
  { name: 'Tactile switch, 6 mm', mfr: 'E-Switch', mpn: 'TL1105SPF250Q', dpn: 'EG1862-ND', desc: 'SPST momentary switch, through-hole', tags: ['Switches', 'Through-hole'] },
  { name: 'Slide switch, SPDT', mfr: 'C&K', mpn: 'JS102011SAQN', dpn: 'CKN9559-ND', desc: 'Slide switch, 300 mA', tags: ['Switches', 'Through-hole'] },
];

// Generated value series so the list has some bulk
const RESISTORS: [string, string][] = [
  ['10 Ω', '10R'], ['100 Ω', '100R'], ['1 kΩ', '1K'], ['4.7 kΩ', '4K7'],
  ['10 kΩ', '10K'], ['47 kΩ', '47K'], ['100 kΩ', '100K'], ['1 MΩ', '1M'],
];
const CAPACITORS: [string, string][] = [
  ['10 pF', '100J'], ['100 pF', '101J'], ['1 nF', '102K'], ['10 nF', '103K'],
  ['100 nF', '104K'], ['1 µF', '105K'], ['10 µF', '106K'],
];
PARTS.push(
  ...RESISTORS.map(([v, code]): Part => ({
    name: `${v} resistor, 0805`,
    mfr: 'Yageo',
    mpn: `RC0805FR-07${code}L`,
    dpn: `311-${code}CRCT-ND`,
    desc: 'Thick film resistor, 1%, 0.125 W',
    tags: ['Resistors', 'Passives', 'SMD'],
  })),
  ...CAPACITORS.map(([v, code]): Part => ({
    name: `${v} capacitor, 0603`,
    mfr: 'Murata',
    mpn: `GRM188R71H${code}A93D`,
    dpn: `490-${code}-1-ND`,
    desc: 'Ceramic capacitor, X7R, 50 V',
    tags: ['Capacitors', 'Passives', 'SMD'],
  }))
);

// Small seeded PRNG so the generated data is the same on every reload.
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = mulberry32(42);
// Mix of out-of-stock, low (<= 10) and healthy quantities so every badge shows up.
const randomQuantity = () => {
  const r = rand();
  if (r < 0.1) return 0;
  if (r < 0.28) return 1 + Math.floor(rand() * 10);
  return 11 + Math.floor(rand() * 490);
};

let db: Omit<Item, 'Tags'>[] = PARTS.map((p, i) => ({
  ID: i + 1,
  ItemName: p.name,
  Quantity: randomQuantity(),
  Manufacturer: p.mfr,
  ManufacturerPart: p.mpn,
  DistributorPart: p.dpn,
  DistributorURL: i % 3 === 0 ? '' : 'https://www.digikey.com/',
  DataSheetURL: i % 4 === 0 ? '' : 'https://example.com/datasheets/' + encodeURIComponent(p.mpn) + '.pdf',
  Description: p.desc,
}));
db.forEach((item, i) => linkItemTags(item.ID, PARTS[i].tags));
let nextId = db.length + 1;
const latency = () => new Promise((r) => setTimeout(r, 200));
const withTags = (i: Omit<Item, 'Tags'>): Item => ({ ...i, Tags: tagsForItem(i.ID) });
/* ---------- /DUMMY STORE ---------- */

// GET /  ->  Item[]   (all available item data, each with its tags)
export const getItems = async (): Promise<Item[]> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/`, { credentials: 'include' });
  // if (!res.ok) throw new Error(`Failed to load items (${res.status})`);
  // return res.json();   // map each item's `tags` with normalizeTag
  return db.map(withTags);
};

// GET /:id  ->  Item
export const getItem = async (id: number): Promise<Item> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/${id}`, { credentials: 'include' });
  // if (!res.ok) throw new Error(`Failed to load item (${res.status})`);
  // return res.json();
  const found = db.find((i) => i.ID === id);
  if (!found) throw new Error('Item not found');
  return withTags(found);
};

// POST /  { Action: 'CREATE', ...item }  ->  Item (with its new ID)
export const createItem = async (item: NewItem): Promise<Item> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   credentials: 'include',
  //   body: JSON.stringify({ Action: 'CREATE' satisfies ItemAction, ...item }),
  // });
  // if (!res.ok) throw new Error(`Failed to create item (${res.status})`);
  // return res.json();
  const created = { ID: nextId++, ...item };
  db = [created, ...db];
  return withTags(created);
};

// PUT /:id  { Action: 'ADDED' | 'TAKEN', Quantity: amount }  ->  Item (with the new quantity)
// TODO: confirm the body field name for the amount.
// Note: the backend's PUT /items/:id returns the item without tags; the page keeps the tags it already has.
export const adjustItem = async (
  id: number,
  action: 'ADDED' | 'TAKEN',
  amount: number
): Promise<Item> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/${id}`, {
  //   method: 'PUT',
  //   headers: { 'Content-Type': 'application/json' },
  //   credentials: 'include',
  //   body: JSON.stringify({ Action: action, Quantity: amount }),
  // });
  // if (!res.ok) throw new Error(`Failed to update quantity (${res.status})`);
  // return res.json();
  const found = db.find((i) => i.ID === id);
  if (!found) throw new Error('Item not found');
  if (action === 'TAKEN' && found.Quantity < amount) throw new Error('Not enough in stock');
  found.Quantity += action === 'ADDED' ? amount : -amount;
  return withTags(found);
};

// DELETE /:id  { Action: 'DELETE' }
export const deleteItem = async (id: number): Promise<void> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/${id}`, {
  //   method: 'DELETE',
  //   headers: { 'Content-Type': 'application/json' },
  //   credentials: 'include',
  //   body: JSON.stringify({ Action: 'DELETE' satisfies ItemAction }),
  // });
  // if (!res.ok) throw new Error(`Failed to delete item (${res.status})`);
  db = db.filter((i) => i.ID !== id);
  forgetItemTags(id);
};
