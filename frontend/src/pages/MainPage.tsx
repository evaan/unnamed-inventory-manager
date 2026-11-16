import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth';
import { hasPermission } from '../features/auth/auth';
import {
  createItem,
  adjustItem,
  deleteItem,
  updateItem,
  type Item,
  type NewItem,
} from '../features/items/itemsapi';
import {
  createTag,
  deleteTag,
  setItemTags,
  type Tag,
  type TagID,
  type WithTags,
} from '../features/items/tagsapi';
import { DetailPanel, Workspace } from '../components/Workspace';
import { SearchInput } from '../components/SearchInput';
import { ErrorBanner } from '../components/ErrorBanner';
import { ListSkeleton } from '../components/ListSkeleton';
import { ItemDetails } from '../features/items/ItemDetails';
import { getStock, STOCK_STYLES } from '../features/items/itemStock';
import { useInventoryData } from '../features/items/useInventoryData';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useConfirm } from '../hooks/useConfirm';
import { TagChip, TagEditor, TagSidebar } from '../features/items/ItemTags';

type TaggedItem = WithTags<Item>;

// Unsaved new items live under this ID until the API assigns a real one.
const DRAFT_ID = '__draft__';

const BLANK_ITEM: Item = {
  id: DRAFT_ID,
  itemName: '',
  quantity: 0,
  manufacturer: '',
  manufacturerPart: '',
  distributorPart: '',
  distributorURL: '',
  dataSheetURL: '',
  description: '',
};

const byName = (a: Tag, b: Tag) => a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' });
const tagIdsOf = (item: TaggedItem) => (item.Tags ?? []).map((t) => t.ID);

/* ---------- Page ---------- */
export const MainPage = () => {
  const confirm = useConfirm();
  /* Auth */
  const auth = useAuth();
  const canCreateItem = hasPermission(auth.data, 'CreateItem');
  const canDeleteItem = hasPermission(auth.data, 'DeleteItem');
  const canModifyItem = hasPermission(auth.data, 'ModifyItem');
  const canCreateTags = hasPermission(auth.data, 'CreateTag');
  const canDeleteTags = hasPermission(auth.data, 'DeleteTag');
  const canEditTags = hasPermission(auth.data, 'ModifyItem');

  /* Data */
  const session = auth.data?.loggedIn && !auth.data.disabled ? auth.data : null;
  const { items, tags, itemsLoaded, tagsLoaded, setItems, setTags, cancelItems, cancelTags, loading, loadError, retrying, retry } =
    useInventoryData(session?.email, !!session);
  const [dismissedLoadError, setDismissedLoadError] = useState<Error | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const adjustingRef = useRef(new Set<string>());
  const [adjustingIds, setAdjustingIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const canLeave = useUnsavedChanges(dirty, saving);
  const [query, setQuery] = useState('');

  /* Sidebar */
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [activeTagIds, setActiveTagIds] = useState<TagID[]>([]);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong');

  /* Spotlight + new-item draft */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Item | null>(null); // unsaved new item, never sent to the API until saved
  const spotlightItem =
    selectedId === DRAFT_ID ? draft : items.find((i) => i.id === selectedId) ?? null;

  const selectItem = async (id: string | null) => {
    if (!await canLeave()) return;
    if (id !== DRAFT_ID) setDraft(null);
    setDirty(false);
    setEditing(false);
    setError('');
    setSelectedId(id);
  };

  const cancelForm = async () => {
    if (!await canLeave()) return;
    setDirty(false);
    setError('');
    if (editing) setEditing(false);
    else {
      setDraft(null);
      setSelectedId(null);
    }
  };

  const onEscape = () => (draft || editing ? cancelForm() : selectItem(null));
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscapeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const addItem = async () => {
    if (!canCreateItem || !itemsLoaded || !await canLeave()) return;
    setDirty(false);
    setEditing(false);
    setError('');
    setFormVersion((version) => version + 1);
    setDraft({ ...BLANK_ITEM });
    setSelectedId(DRAFT_ID);
  };

  // POST /items
  const saveNew = async (item: NewItem, tagIds: TagID[]) => {
    if (!canCreateItem || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await cancelItems();
      const created: TaggedItem = await createItem(item);
      let finalItem = created;
      if (canEditTags && tagIds.length > 0) {
        try {
          finalItem = { ...created, Tags: await setItemTags(created.id, tagIds) };
        } catch (e) {
          fail(e); // item exists, only the tags failed; the user can retag from the spotlight
        }
      }
      setItems((prev) => [finalItem, ...prev]);
      setDraft(null);
      setDirty(false);
      setSelectedId(created.id);
    } catch (e) {
      fail(e);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const saveEdit = async (values: NewItem) => {
    if (!canModifyItem || !selectedId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await cancelItems();
      // Omit quantity: editing metadata must not overwrite stock changed elsewhere.
      const updated = await updateItem(selectedId, {
        itemName: values.itemName,
        manufacturer: values.manufacturer,
        manufacturerPart: values.manufacturerPart,
        distributorPart: values.distributorPart,
        distributorURL: values.distributorURL,
        dataSheetURL: values.dataSheetURL,
        itemDescription: values.description,
      });
      setItems((previous) => previous.map((item) => item.id === updated.id ? { ...item, ...updated, Tags: updated.Tags ?? item.Tags } : item));
      setDirty(false);
      setEditing(false);
    } catch (e) {
      fail(e);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // PUT /items/{id}  (new quantity + logDescription, computed in adjustItem)
  const adjustQuantity = async (id: string, delta: number) => {
    if (!canModifyItem || adjustingRef.current.has(id)) return;
    adjustingRef.current.add(id);
    setAdjustingIds([...adjustingRef.current]);
    setError('');
    try {
      await cancelItems();
      const updated = await adjustItem(id, delta > 0 ? 'ADDED' : 'TAKEN', Math.abs(delta));
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...updated, Tags: updated.Tags ?? i.Tags } : i))
      );
    } catch (e) {
      fail(e);
    } finally {
      adjustingRef.current.delete(id);
      setAdjustingIds([...adjustingRef.current]);
    }
  };

  // DELETE /items/{id}
  const removeItem = async (id: string) => {
    if (!canDeleteItem || savingRef.current || adjustingRef.current.has(id)) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await cancelItems();
      await deleteItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId(null);
    } catch (e) {
      fail(e);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  /* Tags */

  // POST /tags. Tag names are unique (case-insensitive), so an existing match is reused.
  const createTagByName = async (raw: string): Promise<Tag | null> => {
    if (!canCreateTags || !tagsLoaded) return null;
    const name = raw.trim();
    if (!name) return null;
    const existing = tags.find((t) => t.Name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    setError('');
    try {
      await cancelTags();
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
    if (!canDeleteTags) return;
    if (!await confirm({
      title: 'Delete tag?',
      message: `Delete the tag "${tag.Name}"? It will be removed from every item.`,
      confirmLabel: 'Delete tag',
      destructive: true,
    })) return;
    setError('');
    try {
      await Promise.all([cancelItems(), cancelTags()]);
      await deleteTag(tag.ID);
      setTags((prev) => prev.filter((t) => t.ID !== tag.ID));
      setItems((prev) => prev.map((i) => ({ ...i, Tags: (i.Tags ?? []).filter((t) => t.ID !== tag.ID) })));
      setActiveTagIds((prev) => prev.filter((id) => id !== tag.ID));
    } catch (e) {
      fail(e);
    }
  };

  // PUT /items/:id/tags
  const updateItemTags = async (id: string, tagIds: TagID[]) => {
    if (!canEditTags || !tagsLoaded) return;
    setError('');
    try {
      await cancelItems();
      const newTags = await setItemTags(id, tagIds);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, Tags: newTags } : i)));
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
      const ids = tagIdsOf(item);
      if (!activeTagIds.every((id) => ids.includes(id))) return false;
      if (!q) return true;
      return (
        item.itemName.toLowerCase().includes(q) ||
        item.manufacturerPart.toLowerCase().includes(q) ||
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
    <Workspace onBeforeLeave={canLeave}>
      {/* Left: tag sidebar */}
      <TagSidebar
        open={sidebarOpen}
        onToggleOpen={() => setSidebarOpen((o) => !o)}
        tags={tags}
        counts={tagCounts}
        totalItems={items.length}
        activeIds={activeTagIds}
        canCreateTags={canCreateTags && tagsLoaded}
        canDeleteTags={canDeleteTags}
        onToggleTag={toggleActiveTag}
        onClearTags={() => setActiveTagIds([])}
        onCreate={createTagByName}
        onDelete={removeTag}
      />

      {/* Main: rowed list */}
      <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden min-w-0">
        <div className="ui-toolbar">
          <div className="w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-md">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search name, part number or tag"
              label="Search inventory"
            />
          </div>
          <span className="ml-auto text-xs text-slate-400 shrink-0 tabular-nums">
            {visibleItems.length} of {items.length}
          </span>
          {canCreateItem && (
            <button
              onClick={addItem}
              disabled={!itemsLoaded || saving}
              className="ui-button-primary"
            >
              <Plus className="w-4 h-4" />
              New item
            </button>
          )}
        </div>

        {loadError && loadError !== dismissedLoadError && (
          <ErrorBanner message={loadError.message} onRetry={retry} retrying={retrying} onDismiss={() => setDismissedLoadError(loadError)} />
        )}
        {error && !spotlightItem && <ErrorBanner message={error} onDismiss={() => setError('')} />}

        {/* Active tag filters, visible even when the sidebar is collapsed */}
        {activeTagIds.length > 0 && (
          <div className="px-4 sm:px-6 py-2 border-b border-slate-800 flex flex-wrap items-center gap-1.5">
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
            <ListSkeleton label="Loading items" />
          ) : loadError && items.length === 0 ? (
            <div className="ui-empty-state">
              <p>Inventory could not be loaded.</p>
              {loadError === dismissedLoadError && <button onClick={retry} disabled={retrying} className="ui-button-secondary">Try again</button>}
            </div>
          ) : rows.length === 0 ? (
            <div className="ui-empty-state">
              <p>{items.length === 0 ? 'No items yet.' : 'No items match your filters.'}</p>
              {filtering && (
                <button
                  onClick={() => {
                    setQuery('');
                    setActiveTagIds([]);
                  }}
                  className="text-slate-200 hover:text-white"
                >
                  Clear search and tags
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {rows.map((item) => {
                const stock = getStock(item);
                const itemTags = item.Tags ?? [];
                const isSelected = item.id === selectedId;
                const isDraft = item.id === DRAFT_ID;
                const subtitle = [item.manufacturerPart, item.distributorPart].filter(Boolean).join(' · ');
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        if (!isDraft) selectItem(isSelected ? null : item.id);
                      }}
                      aria-pressed={isSelected}
                      className={`ui-list-row ${
                        isSelected
                          ? 'ui-list-row-active'
                          : 'ui-list-row-idle'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${item.itemName ? '' : 'italic text-slate-500'}`}>
                          {item.itemName || 'Untitled item'}
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
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {!isDraft && <span aria-label={`Quantity: ${item.quantity.toLocaleString()}`} className="text-sm font-semibold tabular-nums">{item.quantity.toLocaleString()}</span>}
                        <span className={isDraft ? 'ui-badge bg-slate-800 text-slate-300' : STOCK_STYLES[stock]}>
                          {isDraft ? 'Draft' : stock}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      {/* Spotlight: opens on the far right when a row is selected */}
      <DetailPanel label="Item details" open={!!spotlightItem}>
        {spotlightItem && (
          <ItemDetails
            key={`${spotlightItem.id}-${editing}-${formVersion}`}
            item={spotlightItem}
            isDraft={spotlightItem.id === DRAFT_ID}
            editing={editing}
            canModify={canModifyItem}
            canDelete={canDeleteItem}
            saving={saving}
            adjusting={adjustingIds.includes(spotlightItem.id)}
            error={error}
            onDismissError={() => setError('')}
            onDirtyChange={setDirty}
            onEdit={() => { setError(''); setEditing(true); }}
            onClose={() => selectItem(null)}
            onCancel={cancelForm}
            onSave={editing ? saveEdit : saveNew}
            onAdjust={adjustQuantity}
            onDelete={removeItem}
            tags={<TagEditor allTags={tags} selectedIds={tagIdsOf(spotlightItem)} canEdit={canEditTags && tagsLoaded} canCreateTags={canCreateTags} onChange={(ids) => void updateItemTags(spotlightItem.id, ids)} onCreate={createTagByName} />}
            draftTags={(ids, onChange) => <TagEditor allTags={tags} selectedIds={ids} canEdit={canEditTags && tagsLoaded} canCreateTags={canCreateTags} onChange={onChange} onCreate={createTagByName} />}
          />
        )}
      </DetailPanel>
    </Workspace>
  );
};
