import { Pencil, Trash2 } from 'lucide-react';
import type { Equipment } from './bookingsapi';
import { formatEquipmentHours } from './bookingTime';

export const EquipmentList = ({ equipment, busy, onEdit, onDelete }: {
  equipment: Equipment[];
  busy: boolean;
  onEdit?: (item: Equipment) => void;
  onDelete?: (item: Equipment) => void;
}) => (
  <ul className="divide-y divide-slate-800">
    {equipment.map((item) => (
      <li key={item.ID} className="flex flex-wrap items-center gap-3 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{item.Name}</p>
          <p className="mt-1 text-xs text-slate-400">{item.Category} · {item.Location}</p>
          <p className="mt-1 text-xs text-slate-400">Working hours · {formatEquipmentHours(item)}</p>
          {item.Description && <p className="mt-1 text-xs text-slate-500">{item.Description}</p>}
          {item.Status === 'MAINTENANCE' && item.MaintenanceNote && <p className="mt-1 text-xs text-amber-300">{item.MaintenanceNote}</p>}
        </div>
        <span className={`text-xs ${item.Status === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-300'}`}>{item.Status === 'ACTIVE' ? 'Active' : 'Out of service'}</span>
        {onEdit && <button disabled={busy} onClick={() => onEdit(item)} className="ui-icon-button" aria-label={`Edit equipment: ${item.Name}`}><Pencil className="h-4 w-4" /></button>}
        {onDelete && <button disabled={busy} onClick={() => onDelete(item)} className="ui-icon-button hover:!text-rose-300" aria-label={`Delete equipment: ${item.Name}`}><Trash2 className="h-4 w-4" /></button>}
      </li>
    ))}
  </ul>
);
