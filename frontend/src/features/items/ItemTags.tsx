import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { X, Plus, Trash2, Tag as TagIcon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { INPUT } from '../../components/styles';
import type { Tag, TagID } from './tagsapi';

export const TagChip = ({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) => (
  <span className="ui-badge-accent">
    <span className="truncate">{tag.Name}</span>
    {onRemove && (
      <button type="button" onClick={onRemove} className="hover:text-slate-100 -mr-0.5" title={`Remove ${tag.Name}`} aria-label={`Remove tag ${tag.Name}`}>
        <X className="w-3 h-3" />
      </button>
    )}
  </span>
);

// Existing item tags save immediately; a new item's tags stay in its draft.
export const TagEditor = ({ allTags, selectedIds, canEdit, canCreateTags, onChange, onCreate }: {
  allTags: Tag[];
  selectedIds: TagID[];
  canEdit: boolean;
  canCreateTags: boolean;
  onChange: (ids: TagID[]) => void;
  onCreate: (name: string) => Promise<Tag | null>;
}) => {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const selected = allTags.filter((tag) => selectedIds.includes(tag.ID));
  const query = text.trim().toLowerCase();
  const suggestions = allTags.filter((tag) => !selectedIds.includes(tag.ID) && tag.Name.toLowerCase().includes(query));
  const nameTaken = allTags.some((tag) => tag.Name.toLowerCase() === query);
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
    const exact = suggestions.find((tag) => tag.Name.toLowerCase() === query);
    if (exact) add(exact.ID);
    else if (canCreate) void create();
    else if (suggestions.length === 1) add(suggestions[0].ID);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selected.length === 0 && <span className="text-xs text-slate-600">No tags yet</span>}
        {selected.map((tag) => <TagChip key={tag.ID} tag={tag} onRemove={canEdit ? () => onChange(selectedIds.filter((id) => id !== tag.ID)) : undefined} />)}
      </div>
      {canEdit && (
        <div className="relative">
          <input
            value={text}
            onChange={(event) => { setText(event.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            placeholder="Add a tag…"
            aria-label="Add a tag"
            disabled={busy}
            className={INPUT}
          />
          {open && (suggestions.length > 0 || canCreate) && (
            <ul className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 shadow-lg py-1">
              {suggestions.map((tag) => (
                <li key={tag.ID}>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => add(tag.ID)} className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-slate-800 truncate">{tag.Name}</button>
                </li>
              ))}
              {canCreate && (
                <li>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => void create()} disabled={busy} className="w-full text-left px-2.5 py-1.5 text-sm text-white hover:bg-slate-800 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Create “{text.trim()}”</span>
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
  open, onToggleOpen, tags, counts, totalItems, activeIds, canCreateTags, canDeleteTags,
  onToggleTag, onClearTags, onCreate, onDelete,
}: {
  open: boolean;
  onToggleOpen: () => void;
  tags: Tag[];
  counts: Map<TagID, number>;
  totalItems: number;
  activeIds: TagID[];
  canCreateTags: boolean;
  canDeleteTags: boolean;
  onToggleTag: (id: TagID) => void;
  onClearTags: () => void;
  onCreate: (name: string) => Promise<Tag | null>;
  onDelete: (tag: Tag) => void;
}) => {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
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
    <aside className={`shrink-0 bg-slate-900 border-r border-slate-800 overflow-hidden transition-[width] duration-200 flex flex-col ${open ? 'w-48 sm:w-64' : 'w-12'}`}>
      <div className="min-h-16 shrink-0 px-2 flex items-center gap-2 border-b border-slate-800">
        <button onClick={onToggleOpen} className="ui-icon-button relative" title={open ? 'Collapse tags' : 'Expand tags'} aria-label={open ? 'Collapse tags' : 'Expand tags'} aria-expanded={open}>
          {open ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          {!open && activeIds.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-white text-[10px] leading-4 text-center text-slate-950">{activeIds.length}</span>}
        </button>
        {open && <>
          <h2 className="text-sm font-semibold flex-1">Tags</h2>
          {activeIds.length > 0 && <button onClick={onClearTags} className="text-xs text-slate-200 hover:text-white pr-1">Clear</button>}
        </>}
      </div>
      {open && (
        <div className="w-48 sm:w-64 flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            <button onClick={onClearTags} className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${activeIds.length === 0 ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:bg-slate-800/60'}`}>
              <span>All items</span><span className="text-xs tabular-nums text-slate-500">{totalItems}</span>
            </button>
            {tags.length === 0 && <p className="px-2.5 py-3 text-xs text-slate-500">{canCreateTags ? 'No tags yet. Create one below, then add it to items.' : 'No tags yet.'}</p>}
            {tags.map((tag) => {
              const active = activeIds.includes(tag.ID);
              return (
                <div key={tag.ID} className="group relative">
                  <button onClick={() => onToggleTag(tag.ID)} aria-pressed={active} className={`w-full flex items-center justify-between gap-2 pl-2.5 pr-2.5 py-1.5 rounded-lg text-sm transition-colors ${active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-slate-800/60'}`}>
                    <span className="flex items-center gap-2 min-w-0">
                      <TagIcon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-white' : 'text-slate-500'}`} />
                      <span className="truncate">{tag.Name}</span>
                    </span>
                    <span className={`text-xs tabular-nums text-slate-500 ${canDeleteTags ? 'group-hover:opacity-0 focus-within:opacity-0' : ''}`}>{counts.get(tag.ID) ?? 0}</span>
                  </button>
                  {canDeleteTags && (
                    <button onClick={() => onDelete(tag)} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-500 hover:text-rose-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" title={`Delete tag "${tag.Name}"`} aria-label={`Delete tag ${tag.Name}`}><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              );
            })}
          </div>
          {canCreateTags && (
            <form onSubmit={submit} className="p-2 border-t border-slate-800 flex gap-1.5">
              <input value={name} onChange={(event) => setName(event.target.value)} disabled={creating} placeholder="New tag" aria-label="New tag" className={INPUT} />
              <button type="submit" disabled={!name.trim() || creating} className="ui-button-primary" title="Create tag"><Plus className="w-4 h-4" /></button>
            </form>
          )}
        </div>
      )}
    </aside>
  );
};
