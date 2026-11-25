import type { Item } from './itemsapi';

export const MAX_ITEM_QUANTITY = 2_147_483_647;

type Stock = 'In stock' | 'Low stock' | 'Out of stock';
export const getStock = (item: Item): Stock =>
  item.quantity === 0 ? 'Out of stock' : item.quantity <= item.lowStockThreshold ? 'Low stock' : 'In stock';

export const STOCK_STYLES: Record<Stock, string> = {
  'In stock': 'ui-badge-success',
  'Low stock': 'ui-badge-warning',
  'Out of stock': 'ui-badge-danger',
};
