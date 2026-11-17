import { useEffect, useId, useRef, useState } from 'react';
import { Field } from '../../components/Field';
import { INPUT } from '../../components/styles';
import type { Item, NewItem } from './itemsapi';
import { MAX_ITEM_QUANTITY } from './itemStock';

type Draft = Record<Exclude<keyof NewItem, 'categories' | 'logDescription'>, string>;
const toDraft = (item: Item): Draft => ({
  itemName: item.itemName,
  quantity: String(item.quantity),
  manufacturer: item.manufacturer,
  manufacturerPart: item.manufacturerPart,
  distributorPart: item.distributorPart ?? '',
  distributorURL: item.distributorURL ?? '',
  dataSheetURL: item.dataSheetURL ?? '',
  description: item.description ?? '',
});

const isWebURL = (value: string) => {
  if (!value.trim()) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
};

export const ItemForm = ({ item, editing = false, saving, onDirtyChange, onSave, onCancel, children }: {
  item: Item;
  editing?: boolean;
  saving: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (item: NewItem) => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) => {
  const [initial] = useState(() => toDraft(item));
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dirty = Object.keys(initial).some((key) => draft[key as keyof Draft] !== initial[key as keyof Draft]);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    // Let the mobile panel record the trigger before focusing a form field.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const set = (key: keyof Draft, value: string) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setError('');
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!draft.itemName.trim() || !draft.manufacturer.trim() || !draft.manufacturerPart.trim()) {
      setError('Name, manufacturer and manufacturer part # are required.');
      return;
    }
    const quantity = Number(draft.quantity);
    if (!editing && (!draft.quantity.trim() || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_ITEM_QUANTITY)) {
      setError('Quantity must be a whole number between 0 and 2,147,483,647.');
      return;
    }
    if (!isWebURL(draft.distributorURL) || !isWebURL(draft.dataSheetURL)) {
      setError('Enter a valid http:// or https:// URL.');
      return;
    }
    onSave({
      ...Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()])),
      itemName: draft.itemName.trim(),
      manufacturer: draft.manufacturer.trim(),
      manufacturerPart: draft.manufacturerPart.trim(),
      quantity,
    });
  };

  return (
    <form noValidate onSubmit={submit} aria-describedby={error ? errorId : undefined} className="flex min-h-0 flex-1 flex-col">
      <fieldset disabled={saving} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <p className="text-xs text-slate-400">Fields marked <span aria-hidden="true">*</span> are required.</p>
        <div className="space-y-3">
          <Field label="Name" required>
            <input ref={inputRef} required value={draft.itemName} onChange={(e) => set('itemName', e.target.value)} placeholder="e.g. 4.7 kΩ resistor, 0805" className={INPUT} />
          </Field>
          {!editing && (
            <Field label="Quantity" required>
              <input type="number" inputMode="numeric" min={0} max={MAX_ITEM_QUANTITY} step={1} required value={draft.quantity} onChange={(e) => set('quantity', e.target.value)} className={INPUT} />
            </Field>
          )}
          <Field label="Manufacturer" required>
            <input required value={draft.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Manufacturer Part #" required>
            <input required value={draft.manufacturerPart} onChange={(e) => set('manufacturerPart', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Distributor Part #">
            <input value={draft.distributorPart} onChange={(e) => set('distributorPart', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Distributor URL">
            <input type="url" value={draft.distributorURL} onChange={(e) => set('distributorURL', e.target.value)} placeholder="https://" className={INPUT} />
          </Field>
          <Field label="Data Sheet URL">
            <input type="url" value={draft.dataSheetURL} onChange={(e) => set('dataSheetURL', e.target.value)} placeholder="https://" className={INPUT} />
          </Field>
          <Field label="Description">
            <textarea rows={3} value={draft.description} onChange={(e) => set('description', e.target.value)} className={INPUT} />
          </Field>
        </div>
        {children}
        {error && <p id={errorId} role="alert" className="text-sm text-rose-300">{error}</p>}
      </fieldset>
      <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">
        <button type="button" onClick={onCancel} disabled={saving} className="ui-button-ghost">Cancel</button>
        <button type="submit" disabled={saving} className="ui-button-primary">
          {saving ? (editing ? 'Saving…' : 'Adding…') : (editing ? 'Save changes' : 'Add item')}
        </button>
      </div>
    </form>
  );
};
