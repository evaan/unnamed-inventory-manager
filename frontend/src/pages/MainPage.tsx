import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Truck,
  Search,
  X,
  Plus,
  Trash2,
  Tag as TagIcon,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarClock,
} from 'lucide-react';
import { useAuth, useLogout } from '../features/auth/useAuth';
import {
  getItems,
  createItem,
  adjustItem,
  deleteItem,
  type Item,
  type NewItem,
} from '../features/items/itemsapi';
import {
  getTags,
  createTag,
  deleteTag,
  setItemTags,
  type Tag,
  type TagID,
  type WithTags,
} from '../features/items/tagsapi';
import { useNavigate } from 'react-router-dom';

type TaggedItem = WithTags<Item>;

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

const byName = (a: Tag, b: Tag) => a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' });
const tagIdsOf = (item: TaggedItem) => (item.Tags ?? []).map((t) => t.ID);

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

/* ---------- Tags ---------- */

const TagChip = ({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) => (
  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 max-w-full">
    <span className="truncate">{tag.Name}</span>
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="hover:text-indigo-100 -mr-0.5"
        title={`Remove ${tag.Name}`}
        aria-label={`Remove tag ${tag.Name}`}
      >
        <X className="w-3 h-3" />
      </button>
    )}
  </span>
);

// Chips for the tags on an item plus a box to add more (existing or brand new).
const TagEditor = ({
  allTags,
  selectedIds,
  onChange,
  onCreate,
}: {
  allTags: Tag[];
  selectedIds: TagID[];
  onChange: (ids: TagID[]) => void;
  onCreate: (name: string) => Promise<Tag | null>;
}) => {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = allTags.filter((t) => selectedIds.includes(t.ID));
  const q = text.trim().toLowerCase();
  const suggestions = allTags.filter(
    (t) => !selectedIds.includes(t.ID) && t.Name.toLowerCase().includes(q)
  );
  const nameTaken = allTags.some((t) => t.Name.toLowerCase() === q);
  const canCreate = q !== '' && !nameTaken;

  const add = (id: TagID) => {
    onChange([...selectedIds, id]);
    setText('');
  };

  const create = async () => {
    if (!canCreate || busy) return;
    setBusy(true);
    const tag = await onCreate(text);
    setBusy(false);
    if (tag) add(tag.ID);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault(); // don't submit the surrounding form
    const exact = suggestions.find((t) => t.Name.toLowerCase() === q);
    if (exact) add(exact.ID);
    else if (canCreate) void create();
    else if (suggestions.length === 1) add(suggestions[0].ID);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selected.length === 0 && <span className="text-xs text-slate-600">No tags yet</span>}
        {selected.map((t) => (
          <TagChip key={t.ID} tag={t} onRemove={() => onChange(selectedIds.filter((id) => id !== t.ID))} />
        ))}
      </div>

      <div className="relative">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder="Add a tag…"
          disabled={busy}
          className={INPUT}
        />
        {open && (suggestions.length > 0 || canCreate) && (
          <ul className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 shadow-lg py-1">
            {suggestions.map((t) => (
              <li key={t.ID}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(t.ID)}
                  className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-slate-800 truncate"
                >
                  {t.Name}
                </button>
              </li>
            ))}
            {canCreate && (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void create()}
                  className="w-full text-left px-2.5 py-1.5 text-sm text-indigo-300 hover:bg-slate-800 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Create “{text.trim()}”</span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

// Collapsible left sidebar: pick tags to filter the list, create and delete tags.
const TagSidebar = ({
  open,
  onToggleOpen,
  tags,
  counts,
  totalItems,
  activeIds,
  onToggleTag,
  onClearTags,
  onCreate,
  onDelete,
}: {
  open: boolean;
  onToggleOpen: () => void;
  tags: Tag[];
  counts: Map<TagID, number>;
  totalItems: number;
  activeIds: TagID[];
  onToggleTag: (id: TagID) => void;
  onClearTags: () => void;
  onCreate: (name: string) => Promise<Tag | null>;
  onDelete: (tag: Tag) => void;
}) => {
  const [name, setName] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tag = await onCreate(name);
    if (tag) setName('');
  };

  return (
    <aside
      className={`shrink-0 bg-slate-900 border-r border-slate-800 overflow-hidden transition-[width] duration-200 flex flex-col ${
        open ? 'w-64' : 'w-12'
      }`}
    >
      <div className="h-[57px] shrink-0 px-2 flex items-center gap-2 border-b border-slate-800">
        <button
          onClick={onToggleOpen}
          className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
          title={open ? 'Collapse tags' : 'Expand tags'}
          aria-expanded={open}
        >
          {open ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          {!open && activeIds.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-indigo-500 text-[10px] leading-4 text-center text-white">
              {activeIds.length}
            </span>
          )}
        </button>
        {open && (
          <>
            <h2 className="text-sm font-semibold flex-1">Tags</h2>
            {activeIds.length > 0 && (
              <button onClick={onClearTags} className="text-xs text-indigo-400 hover:text-indigo-300 pr-1">
                Clear
              </button>
            )}
          </>
        )}
      </div>

      {open ? (
        <div className="w-64 flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            <button
              onClick={onClearTags}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                activeIds.length === 0 ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <span>All items</span>
              <span className="text-xs tabular-nums text-slate-500">{totalItems}</span>
            </button>

            {tags.length === 0 && (
              <p className="px-2.5 py-3 text-xs text-slate-500">
                No tags yet. Create one below, then add it to items.
              </p>
            )}

            {tags.map((tag) => {
              const active = activeIds.includes(tag.ID);
              return (
                <div key={tag.ID} className="group relative">
                  <button
                    onClick={() => onToggleTag(tag.ID)}
                    aria-pressed={active}
                    className={`w-full flex items-center justify-between gap-2 pl-2.5 pr-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-indigo-500/15 text-indigo-200'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <TagIcon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-indigo-300' : 'text-slate-500'}`} />
                      <span className="truncate">{tag.Name}</span>
                    </span>
                    <span className="text-xs tabular-nums text-slate-500 group-hover:opacity-0 focus-within:opacity-0">
                      {counts.get(tag.ID) ?? 0}
                    </span>
                  </button>
                  <button
                    onClick={() => onDelete(tag)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-500 hover:text-rose-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    title={`Delete tag "${tag.Name}"`}
                    aria-label={`Delete tag ${tag.Name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <form onSubmit={submit} className="p-2 border-t border-slate-800 flex gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New tag"
              className={INPUT}
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="p-2 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:hover:bg-blue-500 text-white transition-colors shrink-0"
              title="Create tag"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={onToggleOpen}
          className="mx-2 mt-2 p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title="Tags"
        >
          <TagIcon className="w-4 h-4" />
        </button>
      )}
    </aside>
  );
};

/* ---------- New item form ---------- */

// New-item form (existing items have no edit endpoint, only quantity changes)
const NewItemForm = ({
  item,
  saving,
  allTags,
  onCreateTag,
  onSave,
  onCancel,
}: {
  item: Item;
  saving: boolean;
  allTags: Tag[];
  onCreateTag: (name: string) => Promise<Tag | null>;
  onSave: (item: NewItem, tagIds: TagID[]) => void;
  onCancel: () => void;
}) => {
  const [d, setD] = useState<Draft>(() => toDraft(item));
  const [tagIds, setTagIds] = useState<TagID[]>([]);
  const [error, setError] = useState('');

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.ItemName.trim()) {
      setError('Add a name before saving.');
      return;
    }
    onSave(fromDraft(d), tagIds);
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

        <section>
          <p className="text-xs text-slate-500 mb-1">Tags</p>
          <TagEditor allTags={allTags} selectedIds={tagIds} onChange={setTagIds} onCreate={onCreateTag} />
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

/* ---------- Spotlight panel ---------- */
interface SpotlightProps {
  item: TaggedItem;
  isDraft: boolean;
  saving: boolean;
  allTags: Tag[];
  onClose: () => void;
  onCancel: () => void;
  onSave: (item: NewItem, tagIds: TagID[]) => void;
  onAdjust: (id: number, delta: number) => void;
  onDelete: (id: number) => void;
  onSetTags: (id: number, tagIds: TagID[]) => void;
  onCreateTag: (name: string) => Promise<Tag | null>;
}

const SpotlightPanel = ({
  item,
  isDraft,
  saving,
  allTags,
  onClose,
  onCancel,
  onSave,
  onAdjust,
  onDelete,
  onSetTags,
  onCreateTag,
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
        <NewItemForm
          item={item}
          saving={saving}
          allTags={allTags}
          onCreateTag={onCreateTag}
          onSave={onSave}
          onCancel={onCancel}
        />
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

          <section>
            <p className="text-xs text-slate-500 mb-1.5">Tags</p>
            <TagEditor
              allTags={allTags}
              selectedIds={tagIdsOf(item)}
              onChange={(ids) => onSetTags(item.ID, ids)}
              onCreate={onCreateTag}
            />
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
  const navigate = useNavigate();

  /* Data */
  const [items, setItems] = useState<TaggedItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  /* Sidebar */
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTagIds, setActiveTagIds] = useState<TagID[]>([]);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong');

  // GET /  and  GET /tags
  useEffect(() => {
    let cancelled = false;
    Promise.all([getItems(), getTags()])
      .then(([itemResult, tagResult]) => {
        if (cancelled) return;
        setItems(itemResult);
        setTags([...tagResult].sort(byName));
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

  // POST /  (Action: CREATE), then PUT /items/:id/tags if the draft had tags
  const saveNew = async (item: NewItem, tagIds: TagID[]) => {
    setSaving(true);
    setError('');
    try {
      const created: TaggedItem = await createItem(item);
      let finalItem = created;
      if (tagIds.length > 0) {
        try {
          finalItem = { ...created, Tags: await setItemTags(created.ID, tagIds) };
        } catch (e) {
          fail(e); // item exists, only the tags failed; the user can retag from the spotlight
        }
      }
      setItems((prev) => [finalItem, ...prev]);
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
      const updated: TaggedItem = await adjustItem(id, delta > 0 ? 'ADDED' : 'TAKEN', Math.abs(delta));
      // The adjust endpoint may not echo tags back, so keep the ones we already have.
      setItems((prev) =>
        prev.map((i) => (i.ID === id ? { ...updated, Tags: updated.Tags ?? i.Tags } : i))
      );
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

  /* Tags */

  // POST /tags. Tag names are unique (case-insensitive), so an existing match is reused.
  const createTagByName = async (raw: string): Promise<Tag | null> => {
    const name = raw.trim();
    if (!name) return null;
    const existing = tags.find((t) => t.Name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    setError('');
    try {
      const tag = await createTag(name);
      setTags((prev) => [...prev, tag].sort(byName));
      return tag;
    } catch (e) {
      fail(e);
      return null;
    }
  };

  // DELETE /tags/:id
  const removeTag = async (tag: Tag) => {
    if (!window.confirm(`Delete the tag "${tag.Name}"? It will be removed from every item.`)) return;
    setError('');
    try {
      await deleteTag(tag.ID);
      setTags((prev) => prev.filter((t) => t.ID !== tag.ID));
      setItems((prev) => prev.map((i) => ({ ...i, Tags: (i.Tags ?? []).filter((t) => t.ID !== tag.ID) })));
      setActiveTagIds((prev) => prev.filter((id) => id !== tag.ID));
    } catch (e) {
      fail(e);
    }
  };

  // PUT /items/:id/tags
  const updateItemTags = async (id: number, tagIds: TagID[]) => {
    setError('');
    try {
      const newTags = await setItemTags(id, tagIds);
      setItems((prev) => prev.map((i) => (i.ID === id ? { ...i, Tags: newTags } : i)));
    } catch (e) {
      fail(e);
    }
  };

  const toggleActiveTag = (id: TagID) =>
    setActiveTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const tagCounts = useMemo(() => {
    const counts = new Map<TagID, number>();
    for (const item of items) for (const t of item.Tags ?? []) counts.set(t.ID, (counts.get(t.ID) ?? 0) + 1);
    return counts;
  }, [items]);

  // Selected tags narrow the list: an item must have all of them.
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (activeTagIds.length > 0) {
        const ids = tagIdsOf(item);
        if (!activeTagIds.every((id) => ids.includes(id))) return false;
      }
      if (!q) return true;
      return (
        item.ItemName.toLowerCase().includes(q) ||
        item.ManufacturerPart.toLowerCase().includes(q) ||
        (item.Tags ?? []).some((t) => t.Name.toLowerCase().includes(q))
      );
    });
  }, [items, query, activeTagIds]);

  const rows = draft ? [draft as TaggedItem, ...visibleItems] : visibleItems;
  const filtering = query.trim() !== '' || activeTagIds.length > 0;

  // Must stay below all hooks above (rules of hooks).
  if (!auth.data?.loggedIn || auth.data.disabled) {
    return null;
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Left: tag sidebar */}
      <TagSidebar
        open={sidebarOpen}
        onToggleOpen={() => setSidebarOpen((o) => !o)}
        tags={tags}
        counts={tagCounts}
        totalItems={items.length}
        activeIds={activeTagIds}
        onToggleTag={toggleActiveTag}
        onClearTags={() => setActiveTagIds([])}
        onCreate={createTagByName}
        onDelete={removeTag}
      />

      {/* Main: rowed list */}
      <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden min-w-0">
        <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-3 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, part number or tag"
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
            onClick={() => navigate('/app/bookings')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-sm font-medium text-white transition-colors shrink-0"
          >
            <CalendarClock className="w-4 h-4" />
            Bookings
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

        {/* Active tag filters, visible even when the sidebar is collapsed */}
        {activeTagIds.length > 0 && (
          <div className="px-6 py-2 border-b border-slate-800 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 mr-1">Filtering by</span>
            {tags
              .filter((t) => activeTagIds.includes(t.ID))
              .map((t) => (
                <TagChip key={t.ID} tag={t} onRemove={() => toggleActiveTag(t.ID)} />
              ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">Loading items…</div>
          ) : rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
              <p>{items.length === 0 ? 'No items yet.' : 'No items match your filters.'}</p>
              {filtering && (
                <button
                  onClick={() => {
                    setQuery('');
                    setActiveTagIds([]);
                  }}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  Clear search and tags
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
                const itemTags = item.Tags ?? [];
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
                        {itemTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {itemTags.slice(0, 3).map((t) => (
                              <TagChip key={t.ID} tag={t} />
                            ))}
                            {itemTags.length > 3 && (
                              <span className="text-xs text-slate-500 px-1 py-0.5">+{itemTags.length - 3}</span>
                            )}
                          </div>
                        )}
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
              allTags={tags}
              onClose={() => selectItem(null)}
              onCancel={cancelDraft}
              onSave={saveNew}
              onAdjust={adjustQuantity}
              onDelete={removeItem}
              onSetTags={updateItemTags}
              onCreateTag={createTagByName}
            />
          )}
        </div>
      </aside>
    </div>
  );
};
