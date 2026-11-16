import type { Item } from './itemsapi';

type Stock = 'In stock' | 'Low stock' | 'Out of stock';
export const getStock = (item: Item): Stock =>
  item.quantity === 0 ? 'Out of stock' : item.quantity <= 10 ? 'Low stock' : 'In stock';

export const STOCK_STYLES: Record<Stock, string> = {
  'In stock': 'ui-badge-success',
  'Low stock': 'ui-badge-warning',
  'Out of stock': 'ui-badge-danger',
};
