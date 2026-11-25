import { request } from './inventoryRequest';
import { normalizeTag, type ServerCategory, type Tag, type TagID } from './tagsapi';

// Shape of an item as the server returns it.
interface ServerItem {
  ID: string; // uuid
  ItemName: string;
  Quantity: number;
  LowStockThreshold?: number;
  Manufacturer: string;
  ManufacturerPart: string;
  DistributorPart: string;
  DistributorURL: string;
  DataSheetURL: string;
  Description: string;
  Categories: ServerCategory[] | null;
}

// Item as the app uses it. Optional text fields come back as '' when unset.
export interface Item {
  id: string;
  itemName: string;
  quantity: number;
  lowStockThreshold: number;
  manufacturer: string;
  manufacturerPart: string;
  distributorPart: string;
  distributorURL: string;
  dataSheetURL: string;
  description: string;
  Tags?: Tag[];
}

const fromServer = (s: ServerItem): Item => ({
  id: s.ID,
  itemName: s.ItemName,
  quantity: s.Quantity,
  lowStockThreshold: s.LowStockThreshold ?? 10,
  manufacturer: s.Manufacturer,
  manufacturerPart: s.ManufacturerPart,
  distributorPart: s.DistributorPart,
  distributorURL: s.DistributorURL,
  dataSheetURL: s.DataSheetURL,
  description: s.Description,
  Tags: (s.Categories ?? []).map(normalizeTag),
});

// POST /items body (CreateItemReq). The server requires itemName, manufacturer and
// manufacturerPart to be non-empty, and quantity to be present (0 is fine).
export interface NewItem {
  itemName: string;
  quantity: number;
  lowStockThreshold?: number;
  manufacturer: string;
  manufacturerPart: string;
  categories?: TagID[];
  distributorPart?: string;
  distributorURL?: string;
  dataSheetURL?: string;
  description?: string;
  logDescription?: string; // note recorded in the changelog
}

// PUT /items/{id} body (UpdateItemReq). All fields optional, but at least one is required.
// Note the description field is `itemDescription` here, but `description` on create.
export interface UpdateItem {
  itemName?: string;
  quantity?: number;
  lowStockThreshold?: number;
  manufacturer?: string;
  manufacturerPart?: string;
  categories?: TagID[];
  distributorPart?: string;
  distributorURL?: string;
  dataSheetURL?: string;
  itemDescription?: string;
  logDescription?: string;
}

// GET /items -> { items: Item[] }   (items is null when the table is empty)
export const getItems = async (): Promise<Item[]> => {
  const res = await request('/items', { method: 'GET' }, 'Failed to load items');
  const body: { items: ServerItem[] | null } = await res.json();
  return (body.items ?? []).map(fromServer);
};

// GET /items/{id} -> { item: Item }
export const getItem = async (id: string): Promise<Item> => {
  const res = await request(`/items/${id}`, { method: 'GET' }, 'Failed to load item');
  const body: { item: ServerItem } = await res.json();
  return fromServer(body.item);
};

// POST /items -> 201 { item: Item }
export const createItem = async (item: NewItem): Promise<Item> => {
  const res = await request(
    '/items',
    { method: 'POST', body: JSON.stringify(item) },
    'Failed to create item'
  );
  const body: { item: ServerItem } = await res.json();
  return fromServer(body.item);
};

// PUT /items/{id} -> 200 { item: Item } (the updated item)
export const updateItem = async (id: string, changes: UpdateItem): Promise<Item> => {
  const res = await request(
    `/items/${id}`,
    { method: 'PUT', body: JSON.stringify(changes) },
    'Failed to update item'
  );
  const body: { item: ServerItem } = await res.json();
  return fromServer(body.item);
};

// The server stores an absolute quantity and works out ADDED / TAKEN / MODIFIED for the
// changelog itself from the difference, so this reads the current quantity, applies the
// delta, and PUTs the result. Not atomic: two people adjusting the same item at once can
// overwrite each other.
export const adjustItem = async (
  id: string,
  action: 'ADDED' | 'TAKEN',
  amount: number,
  note?: string
): Promise<Item> => {
  const current = await getItem(id);
  if (action === 'TAKEN' && current.quantity < amount) throw new Error('Not enough in stock');
  const quantity = current.quantity + (action === 'ADDED' ? amount : -amount);
  return updateItem(id, { quantity, logDescription: note });
};

// DELETE /items/{id} -> 204, no body (the server logs the deletion)
export const deleteItem = async (id: string): Promise<void> => {
  await request(`/items/${id}`, { method: 'DELETE' }, 'Failed to delete item');
};
