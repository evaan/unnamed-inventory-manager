import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Truck, Search, X, Plus, Trash2 } from 'lucide-react';
import { useAuth, useLogout } from '../features/auth/useAuth';
import {
  getItems,
  createItem,
  adjustItem,
  deleteItem,
  type Item,
  type NewItem,
} from '../features/items/itemsapi';

type Stock = 'In stock' | 'Low stock' | 'Out of stock';

// Stock status is derived from Quantity, not stored.
const getStock = (item: Item): Stock =>
  item.Quantity === 0 ? 'Out of stock' : item.Quantity <= 10 ? 'Low stock' : 'In stock'; // static threshold TODO: add dynamic for assign2

const STOCK_STYLES: Record<Stock, string> = {
  'In stock': 'bg-emerald-500/15 text-emerald-300',
  'Low stock': 'bg-amber-500/15 text-amber-300',
  'Out of stock': 'bg-rose-500/15 text-rose-300',
};

// Unsaved new items live under this ID until the API assigns a real one.
const DRAFT_ID = -1;

const BLANK_ITEM: Item = {
  ID: DRAFT_ID,
  ItemName: '',
  Quantity: 0,
  Manufacturer: '',
  ManufacturerPart: '',
  DistributorPart: '',
  DistributorURL: '',
  DataSheetURL: '',
  Description: '',
};

// While editing, Quantity is kept as a string so the input can be empty mid-typing.
type Draft = Record<keyof NewItem, string>;

const toDraft = (i: Item): Draft => ({
  ItemName: i.ItemName,
  Quantity: String(i.Quantity),
  Manufacturer: i.Manufacturer,
  ManufacturerPart: i.ManufacturerPart,
  DistributorPart: i.DistributorPart,
  DistributorURL: i.DistributorURL,
  DataSheetURL: i.DataSheetURL,
  Description: i.Description,
});

const toCount = (s: string) => Math.max(0, Math.floor(Number(s) || 0));

const fromDraft = (d: Draft): NewItem => ({
  ItemName: d.ItemName.trim(),
  Quantity: toCount(d.Quantity),
  Manufacturer: d.Manufacturer.trim(),
  ManufacturerPart: d.ManufacturerPart.trim(),
  DistributorPart: d.DistributorPart.trim(),
  DistributorURL: d.DistributorURL.trim(),
  DataSheetURL: d.DataSheetURL.trim(),
  Description: d.Description.trim(),
});

const INPUT =
  'w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500';

const Field = ({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <label className={`block ${className}`}>
    <span className="block text-xs text-slate-500 mb-1">{label}</span>
    {children}
  </label>
);

// Read-only row in the spotlight
const Detail = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-xs text-slate-500 mb-0.5">{label}</p>
    <div className="text-sm break-words">{children}</div>
  </div>
);

const ExternalLinkText = ({ url, text }: { url: string; text: string }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline"
  >
    {text}
  </a>
);

// New-item form (existing items have no edit endpoint, only quantity changes)
const NewItemForm = ({
  item,
  saving,
  onSave,
  onCancel,
}: {
  item: Item;
  saving: boolean;
  onSave: (item: NewItem) => void;
  onCancel: () => void;
}) => {
  const [d, setD] = useState<Draft>(() => toDraft(item));
  const [error, setError] = useState('');

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.ItemName.trim()) {
      setError('Add a name before saving.');
      return;
    }
    onSave(fromDraft(d));
  };

  return (
    <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        <section className="grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2">
            <input
              autoFocus
              value={d.ItemName}
              onChange={(e) => {
                set('ItemName', e.target.value);
                setError('');
              }}
              placeholder="e.g. 4.7 kΩ resistor, 0805"
              className={INPUT}
            />
          </Field>
          <Field label="Quantity" className="col-span-2">
            <input value={d.Quantity} onChange={(e) => set('Quantity', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Manufacturer" className="col-span-2">
            <input value={d.Manufacturer} onChange={(e) => set('Manufacturer', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Manufacturer Part #" className="col-span-2">
            <input value={d.ManufacturerPart} onChange={(e) => set('ManufacturerPart', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Distributor Part #" className="col-span-2">
            <input value={d.DistributorPart} onChange={(e) => set('DistributorPart', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Distributor URL" className="col-span-2">
            <input value={d.DistributorURL} onChange={(e) => set('DistributorURL', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Data Sheet URL" className="col-span-2">
            <input value={d.DataSheetURL} onChange={(e) => set('DataSheetURL', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Description" className="col-span-2">
            <input value={d.Description} onChange={(e) => set('Description', e.target.value)} className={INPUT} />
          </Field>
        </section>

        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>

      <div className="px-5 py-3 border-t border-slate-800 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-sm font-medium text-white transition-colors shrink-0"
        >
          {saving ? 'Adding…' : 'Add item'}
        </button>
      </div>
    </form>
  );
};

// Spotlight panel
interface SpotlightProps {
  item: Item;
  isDraft: boolean;
  saving: boolean;
  onClose: () => void;
  onCancel: () => void;
  onSave: (item: NewItem) => void;
  onAdjust: (id: number, delta: number) => void;
  onDelete: (id: number) => void;
}

const SpotlightPanel = ({
  item,
  isDraft,
  saving,
  onClose,
  onCancel,
  onSave,
  onAdjust,
  onDelete,
}: SpotlightProps) => {
  const stock = getStock(item);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-slate-800">
        <div className="min-w-0">
          {isDraft ? (
            <h2 className="text-base font-semibold leading-snug">New item</h2>
          ) : (
            <>
              <h2 className="text-base font-semibold leading-snug mt-0.5">{item.ItemName}</h2>
              <p className="text-xs text-slate-400 font-mono mt-1">{item.ManufacturerPart}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 -mr-1.5 shrink-0">
          {!isDraft && (
            <button
              onClick={() => {
                if (window.confirm(`Delete "${item.ItemName}"? This can't be undone.`)) onDelete(item.ID);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors"
              title="Delete item"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={isDraft ? onCancel : onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={isDraft ? 'Cancel (Esc)' : 'Close (Esc)'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isDraft ? (
        <NewItemForm item={item} saving={saving} onSave={onSave} onCancel={onCancel} />
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <section>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-semibold tabular-nums">{item.Quantity.toLocaleString()}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STOCK_STYLES[stock]}`}>{stock}</span>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {[-10, -1, 1, 10].map((delta) => (
                <button
                  key={delta}
                  onClick={() => onAdjust(item.ID, delta)}
                  disabled={delta < 0 && item.Quantity < Math.abs(delta)}
                  className="py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors tabular-nums"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            {item.Manufacturer && (
              <Detail label="Manufacturer">
                <span className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-500 shrink-0" />
                  {item.Manufacturer}
                </span>
              </Detail>
            )}
            {item.DistributorPart && (
              <Detail label="Distributor part #">
                <span className="font-mono text-xs">{item.DistributorPart}</span>
              </Detail>
            )}
            {item.Description && <Detail label="Description">{item.Description}</Detail>}
            {(item.DistributorURL || item.DataSheetURL) && (
              <Detail label="Links">
                <div className="flex flex-col gap-1">
                  {item.DistributorURL && <ExternalLinkText url={item.DistributorURL} text="Distributor page" />}
                  {item.DataSheetURL && <ExternalLinkText url={item.DataSheetURL} text="Data sheet" />}
                </div>
              </Detail>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

/* ---------- Page ---------- */
export const MainPage = () => {
  /* Auth */
  const auth = useAuth();
  const logout = useLogout();

  /* Data */
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong');

  // GET /
  useEffect(() => {
    let cancelled = false;
    getItems()
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch((e) => {
        if (!cancelled) fail(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Spotlight + new-item draft */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Item | null>(null); // unsaved new item, never sent to the API until saved
  const spotlightItem =
    selectedId === DRAFT_ID ? draft : items.find((i) => i.ID === selectedId) ?? null;

  const selectItem = (id: number | null) => {
    if (id !== DRAFT_ID) setDraft(null);
    setSelectedId(id);
  };

  const cancelDraft = () => {
    setDraft(null);
    setSelectedId(null);
  };

  const onEscape = () => (draft ? cancelDraft() : selectItem(null));
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscapeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const addItem = () => {
    setDraft({ ...BLANK_ITEM });
    setSelectedId(DRAFT_ID);
  };

  // POST /  (Action: CREATE)
  const saveNew = async (item: NewItem) => {
    setSaving(true);
    setError('');
    try {
      const created = await createItem(item);
      setItems((prev) => [created, ...prev]);
      setDraft(null);
      setSelectedId(created.ID);
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  // PUT /:id  (Action: ADDED or TAKEN)
  const adjustQuantity = async (id: number, delta: number) => {
    setError('');
    try {
      const updated = await adjustItem(id, delta > 0 ? 'ADDED' : 'TAKEN', Math.abs(delta));
      setItems((prev) => prev.map((i) => (i.ID === id ? updated : i)));
    } catch (e) {
      fail(e);
    }
  };

  // DELETE /:id  (Action: DELETE)
  const removeItem = async (id: number) => {
    setError('');
    try {
      await deleteItem(id);
      setItems((prev) => prev.filter((i) => i.ID !== id));
      setSelectedId(null);
    } catch (e) {
      fail(e);
    }
  };

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.ItemName.toLowerCase().includes(q) || item.ManufacturerPart.toLowerCase().includes(q)
    );
  }, [items, query]);

  const rows = draft ? [draft, ...visibleItems] : visibleItems;

  // Must stay below all hooks above (rules of hooks).
  if (!auth.data?.loggedIn || auth.data.disabled) {
    return null;
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Main: rowed list */}
      <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden min-w-0">
        <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-3 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or part number"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <span className="ml-auto text-sm text-slate-500 shrink-0">
            {visibleItems.length} of {items.length}
          </span>
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-sm font-medium text-white transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New item
          </button>
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-sm font-medium text-white transition-colors shrink-0"
          >
            {logout.isPending ? 'Logging out…' : 'Log out'}
          </button>
        </header>

        {error && (
          <div className="px-6 py-2 bg-rose-500/10 border-b border-rose-500/20 text-sm text-rose-300 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError('')} className="p-0.5 hover:text-rose-100" title="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">Loading items…</div>
          ) : rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
              <p>{items.length === 0 ? 'No items yet.' : 'No items match your search.'}</p>
              {query && (
                <button onClick={() => setQuery('')} className="text-indigo-400 hover:text-indigo-300">
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {rows.map((item) => {
                const stock = getStock(item);
                const isSelected = item.ID === selectedId;
                const isDraft = item.ID === DRAFT_ID;
                const subtitle = [item.ManufacturerPart, item.DistributorPart].filter(Boolean).join(' · ');
                return (
                  <li key={item.ID}>
                    <button
                      onClick={() => {
                        if (!isDraft) selectItem(isSelected ? null : item.ID);
                      }}
                      aria-pressed={isSelected}
                      className={`w-full px-6 py-3.5 flex items-center gap-4 text-left border-l-2 transition-colors ${
                        isSelected
                          ? 'bg-indigo-500/10 border-indigo-400'
                          : 'border-transparent hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${item.ItemName ? '' : 'italic text-slate-500'}`}>
                          {item.ItemName || 'Untitled item'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{subtitle || 'No details yet'}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                          isDraft ? 'bg-slate-800 text-slate-300' : STOCK_STYLES[stock]
                        }`}
                      >
                        {isDraft ? 'Draft' : stock}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      {/* Spotlight: opens on the far right when a row is selected */}
      <aside
        className={`shrink-0 bg-slate-900 overflow-hidden transition-[width] duration-200 ${
          spotlightItem ? 'w-96 border-l border-slate-800' : 'w-0'
        }`}
      >
        <div className="w-96 h-full">
          {spotlightItem && (
            <SpotlightPanel
              key={spotlightItem.ID}
              item={spotlightItem}
              isDraft={spotlightItem.ID === DRAFT_ID}
              saving={saving}
              onClose={() => selectItem(null)}
              onCancel={cancelDraft}
              onSave={saveNew}
              onAdjust={adjustQuantity}
              onDelete={removeItem}
            />
          )}
        </div>
      </aside>
    </div>
  );
};
