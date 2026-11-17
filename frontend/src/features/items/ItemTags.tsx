import { useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import { X, Plus, Trash2, Move, Tag as TagIcon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { INPUT } from '../../components/styles';
import type { CategoryEntry } from './categoryHierarchy';
import type { Tag, TagID } from './tagsapi';

export const TagChip = ({ tag, label = tag.Name, onRemove }: { tag: Tag; label?: string; onRemove?: () => void }) => (
  <span className="ui-badge-accent">
    <span className="truncate" title={label}>{label}</span>
    {onRemove && (
      <button type="button" onClick={onRemove} className="hover:text-slate-100 -mr-0.5" title={`Remove ${label}`} aria-label={`Remove category ${label}`}>
        <X className="w-3 h-3" />
      </button>
    )}
  </span>
);

export const TagEditor = ({ categories, selectedIds, canEdit, canCreateTags, onChange, onCreate }: {
  categories: ReadonlyMap<TagID, CategoryEntry>;
  selectedIds: TagID[];
  canEdit: boolean;
  canCreateTags: boolean;
  onChange: (ids: TagID[]) => void;
  onCreate: (name: string) => Promise<Tag | null>;
}) => {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const entries = [...categories.values()];
  const selected = entries.filter(({ tag }) => selectedIds.includes(tag.ID));
  const query = text.trim().toLowerCase();
  const suggestions = entries.filter(({ tag, path }) => !selectedIds.includes(tag.ID) && path.toLowerCase().includes(query));
  const nameTaken = entries.some(({ tag }) => !tag.ParentID && tag.Name.toLowerCase() === query);
  const canCreate = canEdit && canCreateTags && query !== '' && !nameTaken;

  const add = (id: TagID) => {
    if (!canEdit) return;
    onChange([...selectedIds, id]);
    setText('');
  };
  const create = async () => {
    if (!canCreate || busy) return;
    setBusy(true);
    try {
      const tag = await onCreate(text);
      if (tag) add(tag.ID);
    } finally {
      setBusy(false);
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const exact = suggestions.filter(({ tag, path }) => tag.Name.toLowerCase() === query || path.toLowerCase() === query);
    if (exact.length > 1) return;
    if (exact.length === 1) add(exact[0].tag.ID);
    else if (canCreate) void create();
    else if (suggestions.length === 1) add(suggestions[0].tag.ID);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selected.length === 0 && <span className="text-xs text-slate-600">No categories yet</span>}
        {selected.map(({ tag, path }) => <TagChip key={tag.ID} tag={tag} label={path} onRemove={canEdit ? () => onChange(selectedIds.filter((id) => id !== tag.ID)) : undefined} />)}
      </div>
      {canEdit && (
        <div className="relative">
          <input
            value={text}
            onChange={(event) => { setText(event.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            placeholder="Add a category…"
            aria-label="Add a category"
            disabled={busy}
            className={INPUT}
          />
          {open && (suggestions.length > 0 || canCreate) && (
            <ul className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 shadow-lg py-1">
              {suggestions.map(({ tag, path }) => (
                <li key={tag.ID}>
                  <button type="button" title={path} onMouseDown={(event) => event.preventDefault()} onClick={() => add(tag.ID)} className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-slate-800 truncate">{path}</button>
                </li>
              ))}
              {canCreate && (
                <li>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => void create()} disabled={busy} className="w-full text-left px-2.5 py-1.5 text-sm text-white hover:bg-slate-800 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Create category “{text.trim()}”</span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export const TagSidebar = ({
  open, onToggleOpen, categories, counts, totalItems, activeIds, canCreateTags, canDeleteTags,
  onToggleTag, onClearTags, onCreate, onMove, onDelete,
}: {
  open: boolean;
  onToggleOpen: () => void;
  categories: ReadonlyMap<TagID, CategoryEntry>;
  counts: Map<TagID, number>;
  totalItems: number;
  activeIds: TagID[];
  canCreateTags: boolean;
  canDeleteTags: boolean;
  onToggleTag: (id: TagID) => void;
  onClearTags: () => void;
  onCreate: (name: string) => Promise<Tag | null>;
  onMove: (id: TagID, parentID: TagID | null) => Promise<void>;
  onDelete: (tag: Tag) => void;
}) => {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState(false);
  const [draggedId, setDraggedId] = useState<TagID | null>(null);
  const [moveId, setMoveId] = useState<TagID | null>(null);
  const [dropTarget, setDropTarget] = useState<TagID | null>();
  const entries = [...categories.values()];
  const sourceId = draggedId ?? moveId;
  const source = sourceId ? categories.get(sourceId) : undefined;
  const choosingDestination = moveId !== null;

  const canMoveTo = (parentID: TagID | null) => {
    if (!canCreateTags || moving || !source || (source.tag.ParentID ?? null) === parentID) return false;
    if (parentID === null) return true;
    const parent = categories.get(parentID);
    return !!parent && parentID !== sourceId && !parent.ancestors.some((ancestor) => ancestor.ID === sourceId);
  };
  const resetDrag = () => {
    setDraggedId(null);
    setDropTarget(undefined);
  };
  const moveTo = async (parentID: TagID | null) => {
    if (!sourceId || !canMoveTo(parentID)) return;
    resetDrag();
    setMoveId(null);
    setMoving(true);
    try {
      await onMove(sourceId, parentID);
    } finally {
      setMoving(false);
    }
  };
  const dragOver = (event: DragEvent<HTMLButtonElement>, parentID: TagID | null) => {
    if (!draggedId || !canMoveTo(parentID)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget(parentID);
  };
  const dragLeave = (event: DragEvent<HTMLButtonElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setDropTarget(undefined);
  };
  const drop = (event: DragEvent<HTMLButtonElement>, parentID: TagID | null) => {
    if (!draggedId || !canMoveTo(parentID)) return;
    event.preventDefault();
    void moveTo(parentID);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreateTags || creating) return;
    setCreating(true);
    try {
      const tag = await onCreate(name);
      if (tag) setName('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <aside onKeyDown={(event) => {
      if (event.key !== 'Escape' || !choosingDestination) return;
      event.stopPropagation();
      setMoveId(null);
    }} className={`shrink-0 bg-slate-900 border-r border-slate-800 overflow-hidden transition-[width] duration-200 flex flex-col ${open ? 'w-48 sm:w-64' : 'w-12'}`}>
      <div className="min-h-16 shrink-0 px-2 flex items-center gap-2 border-b border-slate-800">
        <button onClick={() => { setMoveId(null); onToggleOpen(); }} className="ui-icon-button relative" title={open ? 'Collapse categories' : 'Expand categories'} aria-label={open ? 'Collapse categories' : 'Expand categories'} aria-expanded={open}>
          {open ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          {!open && activeIds.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-white text-[10px] leading-4 text-center text-slate-950">{activeIds.length}</span>}
        </button>
        {open && <>
          <h2 className="text-sm font-semibold flex-1">Categories</h2>
          {activeIds.length > 0 && <button onClick={onClearTags} className="text-xs text-slate-200 hover:text-white pr-1">Clear</button>}
        </>}
      </div>
      {open && (
        <div className="w-48 sm:w-64 flex-1 min-h-0 flex flex-col">
          {choosingDestination && (
            <div className="flex items-center gap-2 px-2.5 pb-2 text-xs">
              <span role="status" className="flex-1">Choose a destination</span>
              <button autoFocus onClick={() => setMoveId(null)} className="ui-button-ghost">Cancel</button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            <button
              onClick={choosingDestination ? () => void moveTo(null) : onClearTags}
              onDragOver={(event) => dragOver(event, null)}
              onDragLeave={dragLeave}
              onDrop={(event) => drop(event, null)}
              disabled={choosingDestination && !canMoveTo(null)}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-40 ${activeIds.length === 0 ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:bg-slate-800/60'} ${dropTarget === null ? 'ring-1 ring-inset ring-slate-300' : ''}`}
            >
              {choosingDestination ? 'Move to top level' : draggedId && canMoveTo(null) ? 'Drop to make top level' : (
                <><span>All items</span><span className="text-xs tabular-nums text-slate-500">{totalItems}</span></>
              )}
            </button>
            {entries.length === 0 && <p className="px-2.5 py-3 text-xs text-slate-500">{canCreateTags ? 'No categories yet. Create one below, then add it to items.' : 'No categories yet.'}</p>}
            {entries.map(({ tag, ancestors, path }) => {
              const active = activeIds.includes(tag.ID);
              const count = counts.get(tag.ID) ?? 0;
              return (
                <div key={tag.ID} className="group relative">
                  <button
                    onClick={choosingDestination ? () => void moveTo(tag.ID) : () => onToggleTag(tag.ID)}
                    aria-pressed={choosingDestination ? undefined : active}
                    aria-label={choosingDestination ? `Move under ${path}` : `${path}, ${count} ${count === 1 ? 'item' : 'items'}`}
                    title={path}
                    disabled={choosingDestination && !canMoveTo(tag.ID)}
                    draggable={canCreateTags && !moving && !choosingDestination}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', path);
                      setDraggedId(tag.ID);
                    }}
                    onDragEnd={resetDrag}
                    onDragOver={(event) => dragOver(event, tag.ID)}
                    onDragLeave={dragLeave}
                    onDrop={(event) => drop(event, tag.ID)}
                    style={{ paddingInlineStart: 10 + Math.min(ancestors.length, 5) * 12 }}
                    className={`w-full flex items-center justify-between gap-2 pr-2.5 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-40 ${active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-slate-800/60'} ${canCreateTags && !moving && !choosingDestination ? 'cursor-grab' : ''} ${dropTarget === tag.ID ? 'ring-1 ring-inset ring-slate-300' : ''}`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <TagIcon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-white' : 'text-slate-500'}`} />
                      <span className="truncate">{tag.Name}</span>
                    </span>
                    <span className={`text-xs tabular-nums text-slate-500 ${!choosingDestination && (canCreateTags || canDeleteTags) ? 'group-hover:opacity-0 group-focus-within:opacity-0 [@media(pointer:coarse)]:opacity-0' : ''}`}>{count}</span>
                  </button>
                  {!choosingDestination && !draggedId && (canCreateTags || canDeleteTags) && (
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100">
                      {canCreateTags && <button onClick={() => setMoveId(tag.ID)} disabled={moving} className="p-1 rounded text-slate-500 hover:text-white" title="Move category" aria-label={`Move category ${path}`}><Move className="w-3.5 h-3.5" /></button>}
                      {canDeleteTags && <button onClick={() => onDelete(tag)} className="p-1 rounded text-slate-500 hover:text-rose-300" title={`Delete category "${path}"`} aria-label={`Delete category ${path}`}><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {canCreateTags && (
            <form onSubmit={submit} className="p-2 border-t border-slate-800 flex gap-1.5">
              <input value={name} onChange={(event) => setName(event.target.value)} disabled={creating} placeholder="New category" aria-label="New category" className={INPUT} />
              <button type="submit" disabled={!name.trim() || creating} className="ui-button-primary" title="Create category"><Plus className="w-4 h-4" /></button>
            </form>
          )}
        </div>
      )}
    </aside>
  );
};
