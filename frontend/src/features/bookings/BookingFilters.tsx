import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { CategoryIcon } from './BookingSchedule';
import type { Equipment } from './bookingsapi';

export const BookingFilters = ({ open, onToggleOpen, equipment, category, onCategory, availableNow, onAvailableNow, showAvailability = true }: {
  open: boolean;
  onToggleOpen: () => void;
  equipment: Equipment[];
  category: string | null;
  onCategory: (category: string | null) => void;
  availableNow: boolean;
  onAvailableNow: () => void;
  showAvailability?: boolean;
}) => {
  const categories = [...new Set(equipment.map((eq) => eq.Category))].sort();
  const iconByCategory = new Map<string, string | undefined>();
  for (const eq of equipment) if (!iconByCategory.get(eq.Category)) iconByCategory.set(eq.Category, eq.Icon);
  return (
    <aside aria-label="Equipment filters" className={`flex shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-slate-900 transition-[width] duration-200 ${open ? 'w-48 sm:w-64' : 'w-12'}`}>
      <div className="flex min-h-16 shrink-0 items-center gap-2 border-b border-slate-800 px-2">
        <button onClick={onToggleOpen} aria-label={open ? 'Collapse filters' : 'Expand filters'} aria-expanded={open} className="ui-icon-button">
          {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
        {open && <h2 className="flex-1 text-sm font-semibold">Filters</h2>}
        {open && (category || (showAvailability && availableNow)) && <button className="pr-1 text-xs text-slate-300" onClick={() => { onCategory(null); if (availableNow) onAvailableNow(); }}>Clear</button>}
      </div>
      {open && <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        <button onClick={() => onCategory(null)} aria-pressed={category === null} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${category === null ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:bg-slate-800/60'}`}>
          All equipment <span className="text-xs text-slate-500">{equipment.length}</span>
        </button>
        {categories.map((name) => <button key={name} onClick={() => onCategory(category === name ? null : name)} aria-pressed={category === name} className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm ${category === name ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-slate-800/60'}`}>
          <span className="flex min-w-0 items-center gap-2"><CategoryIcon category={name} icon={iconByCategory.get(name)} className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{name}</span></span>
          <span className="text-xs text-slate-500">{equipment.filter((eq) => eq.Category === name).length}</span>
        </button>)}
        {showAvailability && <div className="!mt-4 border-t border-slate-800 pt-3">
          <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm text-slate-300">
            <input type="checkbox" checked={availableNow} onChange={onAvailableNow} className="accent-emerald-600" /> Available now
          </label>
        </div>}
      </div>}
    </aside>
  );
};
