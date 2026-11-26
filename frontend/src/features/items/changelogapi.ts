import { request } from './inventoryRequest';

export interface ChangelogEntry {
  ID: number;
  UserID: string;
  UserName: string;
  ItemID: string;
  Item: { ItemName: string; DeletedAt: string | null };
  Quantity: number;
  Action: 'CREATE' | 'ADDED' | 'TAKEN' | 'MODIFIED' | 'DELETE';
  ChangeTime: string;
  Description: string;
}

export const getLogs = async (): Promise<ChangelogEntry[]> => {
  const response = await request('/logs', { method: 'GET' }, 'Failed to load changelog');
  const body: { items: ChangelogEntry[] | null } = await response.json();
  return body.items ?? [];
};
