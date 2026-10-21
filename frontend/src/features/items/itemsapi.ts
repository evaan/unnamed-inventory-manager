// Dummy item API. Same signatures the real client will have, backed by an in-memory array.
// To go live: delete the DUMMY STORE section and swap each function body for the fetch shown in its comment.

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
}

// What the client sends on create; the server assigns the ID.
export type NewItem = Omit<Item, 'ID'>;

// Sent with POST / PUT / DELETE so the API can record what happened.
export type ItemAction = 'CREATE' | 'TAKEN' | 'ADDED' | 'DELETE';

/* ---------- DUMMY STORE (remove when the API is live) ---------- */
let db: Item[] = [
  {
    ID: 1,
    ItemName: '4.7 kΩ resistor, 0805',
    Quantity: 250,
    Manufacturer: 'Yageo',
    ManufacturerPart: 'RC0805FR-074K7L',
    DistributorPart: '311-4.70KCRCT-ND',
    DistributorURL: 'https://www.digikey.com/',
    DataSheetURL: 'https://www.yageo.com/',
    Description: 'Thick film resistor, 1%, 0.125 W',
  },
  {
    ID: 2,
    ItemName: 'ATmega328P-AU',
    Quantity: 8,
    Manufacturer: 'Microchip',
    ManufacturerPart: 'ATMEGA328P-AU',
    DistributorPart: 'ATMEGA328P-AU-ND',
    DistributorURL: '',
    DataSheetURL: '',
    Description: '8-bit AVR microcontroller, TQFP-32',
  },
  {
    ID: 3,
    ItemName: '100 nF capacitor, 0603',
    Quantity: 0,
    Manufacturer: 'Murata',
    ManufacturerPart: 'GRM188R71H104KA93D',
    DistributorPart: '490-1532-1-ND',
    DistributorURL: '',
    DataSheetURL: '',
    Description: '',
  },
];
let nextId = 4;
const latency = () => new Promise((r) => setTimeout(r, 200));
/* ---------- /DUMMY STORE ---------- */

// GET /  ->  Item[]   (all available item data)
export const getItems = async (): Promise<Item[]> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/`, { credentials: 'include' });
  // if (!res.ok) throw new Error(`Failed to load items (${res.status})`);
  // return res.json();
  return db.map((i) => ({ ...i }));
};

// GET /:id  ->  Item
export const getItem = async (id: number): Promise<Item> => {
  await latency();
  // const res = await fetch(`${BASE_URL}/${id}`, { credentials: 'include' });
  // if (!res.ok) throw new Error(`Failed to load item (${res.status})`);
  // return res.json();
  const found = db.find((i) => i.ID === id);
  if (!found) throw new Error('Item not found');
  return { ...found };
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
  const created: Item = { ID: nextId++, ...item };
  db = [created, ...db];
  return { ...created };
};

// PUT /:id  { Action: 'ADDED' | 'TAKEN', Quantity: amount }  ->  Item (with the new quantity)
// TODO: confirm the body field name for the amount.
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
  return { ...found };
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
};