import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, Pencil, Trash2, Truck, X } from 'lucide-react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { INPUT } from '../../components/styles';
import { ItemForm } from './ItemForm';
import type { Item, NewItem } from './itemsapi';
import type { TagID } from './tagsapi';
import { getStock, MAX_ITEM_QUANTITY, STOCK_STYLES } from './itemStock';
import { useConfirm } from '../../hooks/useConfirm';

const Detail = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <p className="mb-0.5 text-xs text-slate-500">{label}</p>
    <div className="break-words text-sm">{children}</div>
  </div>
);

const CopyPartNumber = ({ label, value }: { label: string; value: string }) => {
  const [status, setStatus] = useState<'copied' | 'failed'>();
  const copied = status === 'copied';
  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setStatus(undefined), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-1">
        <span className="min-w-0 break-all font-mono text-xs">{value}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          title={copied ? 'Copied' : `Copy ${label}`}
          className="ui-icon-button p-1"
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      </div>
      <p role="status" className={status === 'failed' ? 'text-xs text-rose-300' : 'sr-only'}>
        {copied ? `Copied ${label}` : status === 'failed' ? 'Couldn’t copy. You can select and copy the number.' : ''}
      </p>
    </div>
  );
};

const ExternalLinkText = ({ url, text }: { url: string; text: string }) => {
  // Older records may predate URL validation.
  try {
    if (!['http:', 'https:'].includes(new URL(url).protocol)) return null;
  } catch {
    return null;
  }
  return <a href={url} target="_blank" rel="noopener noreferrer" className="text-slate-200 hover:text-white hover:underline underline-offset-2">{text}</a>;
};

export const ItemDetails = ({
  item, isDraft, editing, canModify, canDelete, saving, adjusting, error, categories, editCategories,
  onDirtyChange, onSave, onEdit, onClose, onCancel, onAdjust, onSetQuantity, onDelete, onDismissError,
}: {
  item: Item;
  isDraft: boolean;
  editing: boolean;
  canModify: boolean;
  canDelete: boolean;
  saving: boolean;
  adjusting: boolean;
  error: string;
  categories: ReactNode;
  editCategories: (ids: TagID[], onChange: (ids: TagID[]) => void) => ReactNode;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (item: NewItem, categoryIds?: TagID[]) => void;
  onEdit: () => void;
  onClose: () => void;
  onCancel: () => void;
  onAdjust: (id: string, delta: number) => void;
  onSetQuantity: (id: string, quantity: number) => Promise<boolean>;
  onDelete: (id: string) => void;
  onDismissError: () => void;
}) => {
  const confirm = useConfirm();
  const [editedCategoryIds, setEditedCategoryIds] = useState<TagID[]>();
  const savedCategoryIds = (item.Tags ?? []).map((category) => category.ID);
  const categoryIds = editedCategoryIds ?? savedCategoryIds;
  const categoriesChanged = categoryIds.length !== savedCategoryIds.length ||
    categoryIds.some((id) => !savedCategoryIds.includes(id));
  const [formDirty, setFormDirty] = useState(false);
  const [quantityInput, setQuantityInput] = useState<string | null>(null);
  const quantityButton = useRef<HTMLButtonElement>(null);
  const quantityDirty = quantityInput !== null && quantityInput !== String(item.quantity);
  useEffect(() => {
    onDirtyChange(formDirty || categoriesChanged || quantityDirty);
  }, [formDirty, categoriesChanged, quantityDirty, onDirtyChange]);
  const stock = getStock(item);
  const displayedQuantity = item.quantity.toLocaleString();
  const closeQuantityEditor = () => {
    setQuantityInput(null);
    requestAnimationFrame(() => quantityButton.current?.focus());
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="break-words text-base font-semibold leading-snug">{isDraft ? 'New item' : editing ? `Edit ${item.itemName}` : item.itemName}</h2>
          {!isDraft && item.manufacturerPart && (
            <div className="mt-1 text-slate-400">
              <CopyPartNumber key={item.manufacturerPart} label="manufacturer part number" value={item.manufacturerPart} />
            </div>
          )}
        </div>
        <div className="-mr-1.5 flex shrink-0 items-center gap-1">
          {!isDraft && !editing && canModify && (
            <button onClick={onEdit} disabled={adjusting || quantityInput !== null} aria-label="Edit item" title="Edit item" className="ui-icon-button"><Pencil className="h-4 w-4" /></button>
          )}
          {!isDraft && !editing && canDelete && (
            <button onClick={async () => {
              if (await confirm({ title: 'Delete item?', message: `Delete "${item.itemName}"? This can't be undone.`, confirmLabel: 'Delete item', destructive: true })) onDelete(item.id);
            }} disabled={saving || adjusting || quantityInput !== null} aria-label="Delete item" title="Delete item" className="ui-icon-button hover:!text-rose-300"><Trash2 className="h-4 w-4" /></button>
          )}
          <button onClick={onClose} disabled={saving} aria-label={isDraft ? 'Cancel new item' : 'Close item details'} title={isDraft ? 'Cancel (Esc)' : 'Close (Esc)'} className="ui-icon-button"><X className="h-4 w-4" /></button>
        </div>
      </div>
      {error && <ErrorBanner message={error} onDismiss={onDismissError} />}
      {isDraft || editing ? (
        <ItemForm
          item={item}
          editing={editing}
          saving={saving}
          onDirtyChange={setFormDirty}
          onSave={(values) => onSave(values, categoriesChanged ? categoryIds : undefined)}
          onCancel={onCancel}
        >
          <section><p className="mb-1 text-xs text-slate-500">Categories</p>{editCategories(categoryIds, setEditedCategoryIds)}</section>
        </ItemForm>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <section>
            <div className="flex min-h-9 items-center justify-between gap-2">
              {!canModify ? (
                <p className="text-2xl font-semibold tabular-nums" aria-label={`Quantity: ${displayedQuantity}`}>{displayedQuantity}</p>
              ) : quantityInput === null ? (
                <button
                  ref={quantityButton}
                  type="button"
                  onClick={() => setQuantityInput(String(item.quantity))}
                  disabled={adjusting}
                  aria-label={`Edit stock quantity: ${displayedQuantity}`}
                  title="Edit stock quantity"
                  className="-ml-1.5 inline-flex items-center gap-2 rounded-md px-1.5 text-2xl font-semibold tabular-nums enabled:hover:bg-slate-800 disabled:opacity-60"
                >
                  {displayedQuantity}
                  <Pencil className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                </button>
              ) : (
                <form
                  className="flex min-w-0 items-center gap-1"
                  aria-busy={adjusting}
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (adjusting) return;
                    const quantity = Number(quantityInput);
                    if (quantity === item.quantity || await onSetQuantity(item.id, quantity)) closeQuantityEditor();
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Escape') return;
                    event.stopPropagation();
                    if (!adjusting) closeQuantityEditor();
                  }}
                >
                  <input
                    autoFocus
                    aria-label="Stock quantity"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_ITEM_QUANTITY}
                    step={1}
                    required
                    value={quantityInput}
                    onChange={(event) => setQuantityInput(event.target.value)}
                    disabled={adjusting}
                    className={`${INPUT} w-32 px-2 py-1 text-lg font-semibold leading-6 tabular-nums`}
                  />
                  <button type="submit" disabled={adjusting} aria-label="Save quantity" title="Save quantity" className="ui-icon-button">
                    <Check className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={closeQuantityEditor} disabled={adjusting} aria-label="Cancel quantity edit" title="Cancel quantity edit" className="ui-icon-button">
                    <X className="h-4 w-4" />
                  </button>
                </form>
              )}
              <span className={STOCK_STYLES[stock]}>{stock}</span>
            </div>
            {canModify && (
              <div className="mt-3 grid grid-cols-4 gap-2" aria-busy={adjusting}>
                {[-10, -1, 1, 10].map((delta) => (
                  <button key={delta} onClick={() => onAdjust(item.id, delta)} disabled={adjusting || quantityInput !== null || (delta < 0 && item.quantity < Math.abs(delta))} className="ui-button-secondary tabular-nums">
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
            )}
            {adjusting && <p role="status" className="mt-2 text-xs text-slate-400">Updating quantity…</p>}
          </section>
          <section><p className="mb-1.5 text-xs text-slate-500">Categories</p>{categories}</section>
          <section className="space-y-4">
            {item.manufacturer && <Detail label="Manufacturer"><span className="flex items-center gap-2"><Truck className="h-4 w-4 shrink-0 text-slate-500" />{item.manufacturer}</span></Detail>}
            {item.distributorPart && (
              <Detail label="Distributor part #">
                <CopyPartNumber key={item.distributorPart} label="distributor part number" value={item.distributorPart} />
              </Detail>
            )}
            {item.description && <Detail label="Description">{item.description}</Detail>}
            {(item.distributorURL || item.dataSheetURL) && (
              <Detail label="Links"><div className="flex flex-col gap-1">
                {item.distributorURL && <ExternalLinkText url={item.distributorURL} text="Distributor page" />}
                {item.dataSheetURL && <ExternalLinkText url={item.dataSheetURL} text="Data sheet" />}
              </div></Detail>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
