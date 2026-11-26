import type { ChangelogEntry } from './changelogapi';

const isStockOnly = (entry: ChangelogEntry) =>
  (entry.Action === 'ADDED' || entry.Action === 'TAKEN') &&
  (!entry.Changes || entry.Changes.every((change) => change.Field === 'Quantity'));

// Logs arrive newest first. Group only adjacent stock updates, leaving the saved entries untouched.
export const groupChangelog = (entries: ChangelogEntry[]): ChangelogEntry[] => {
  const groups: ChangelogEntry[] = [];
  for (const entry of entries) {
    const previous = groups[groups.length - 1];
    if (
      previous && isStockOnly(previous) && isStockOnly(entry) &&
      previous.UserID === entry.UserID && previous.ItemID === entry.ItemID &&
      previous.Action === entry.Action && previous.Description === entry.Description
    ) {
      const newestQuantity = previous.Changes?.find((change) => change.Field === 'Quantity');
      const oldestQuantity = entry.Changes?.find((change) => change.Field === 'Quantity');
      previous.Quantity += entry.Quantity;
      previous.Changes = newestQuantity && oldestQuantity
        ? [{ ...newestQuantity, Before: oldestQuantity.Before }]
        : null;
    } else {
      groups.push({ ...entry });
    }
  }
  return groups;
};
