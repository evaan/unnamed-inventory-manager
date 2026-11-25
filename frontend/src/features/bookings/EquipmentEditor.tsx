import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import { Field } from '../../components/Field';
import { INPUT } from '../../components/styles';
import type { Equipment, NewEquipment } from './bookingsapi';
import { equipmentHours, equipmentHoursError, pad } from './bookingTime';
import { EQUIPMENT_ICONS, type EquipmentIconName } from './equipmentIcons';

export const EquipmentEditor = ({ equipment, categories, onSave, onClose, onSavingChange, onDelete, readOnly = false, busy = false, errorMessage = '' }: {
  equipment: Equipment | null;
  categories: string[];
  onSave: (item: NewEquipment) => Promise<string | null>;
  onClose: () => void;
  onSavingChange: (saving: boolean) => void;
  onDelete?: () => void;
  readOnly?: boolean;
  busy?: boolean;
  errorMessage?: string;
}) => {
  const [draft, setDraft] = useState<NewEquipment>(() => equipment ?? {
    Name: '', Category: '', Location: '', Description: '', Status: 'ACTIVE', MaintenanceNote: '',
  });
  const [submitting, setSaving] = useState(false);
  const saving = submitting || busy;
  const inputRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    // Let the mobile sidebar record its trigger before focusing the form.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);
  const hours = equipmentHours(draft);
  const icon: EquipmentIconName = draft.Icon ?? 'wrench';
  const setHours = (open: number, close: number) => {
    setDraft((previous) => ({ ...previous, OpenHour: open, CloseHour: close }));
    setError('');
  };
  const set = <K extends keyof NewEquipment>(key: K, value: NewEquipment[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setError('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || busy || readOnly) return;
    if (![draft.Name, draft.Category, draft.Location].every((value) => value.trim())) {
      setError('Name, category, and location are required.');
      return;
    }
    const hoursError = equipmentHoursError(draft);
    if (hoursError) { setError(hoursError); return; }
    savingRef.current = true;
    setSaving(true);
    onSavingChange(true);
    try {
      const message = await onSave({ ...draft, OpenHour: hours.open, CloseHour: hours.close });
      if (message) setError(message);
    } finally {
      savingRef.current = false;
      setSaving(false);
      onSavingChange(false);
    }
  };
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <h2 className="text-base font-semibold">{equipment ? readOnly ? 'Bookable equipment' : 'Edit bookable equipment' : 'Add bookable equipment'}</h2>
        <button type="button" disabled={saving} onClick={onClose} aria-label="Close equipment editor" className="ui-icon-button -mr-1.5"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <fieldset disabled={saving || readOnly} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Field label="Name" required><input ref={inputRef} data-panel-focus required value={draft.Name} onChange={(e) => set('Name', e.target.value)} className={INPUT} /></Field>
          <Field label="Category" required>
            <input required list="equipment-categories" value={draft.Category} onChange={(e) => set('Category', e.target.value)} className={INPUT} />
            <datalist id="equipment-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Icon</legend>
            <div role="radiogroup" aria-label="Icon" className="flex flex-wrap gap-2">
              {(Object.entries(EQUIPMENT_ICONS) as [EquipmentIconName, (typeof EQUIPMENT_ICONS)[EquipmentIconName]][]).map(([name, Icon]) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={icon === name}
                  aria-label={name}
                  title={name}
                  onClick={() => set('Icon', name)}
                  className={`ui-icon-button ${icon === name ? 'bg-white/10 text-white' : ''}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Working hours</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Opening time" required>
                <select value={hours.open} onChange={(e) => setHours(Number(e.target.value), hours.close)} className={INPUT}>
                  {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{pad(hour)}:00</option>)}
                </select>
              </Field>
              <Field label="Closing time" required>
                <select value={hours.close} onChange={(e) => setHours(hours.open, Number(e.target.value))} className={INPUT}>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((hour) => <option key={hour} value={hour}>{pad(hour)}:00</option>)}
                </select>
              </Field>
            </div>
            <p className="text-xs text-slate-400">Daily availability in whole hours. Use 00:00–24:00 for 24/7. Existing reservations are unchanged.</p>
          </fieldset>
          <Field label="Location" required><input required value={draft.Location} onChange={(e) => set('Location', e.target.value)} className={INPUT} /></Field>
          <Field label="Description"><textarea rows={3} value={draft.Description} onChange={(e) => set('Description', e.target.value)} className={INPUT} /></Field>
          <Field label="Status"><select value={draft.Status} onChange={(e) => set('Status', e.target.value as Equipment['Status'])} className={INPUT}><option value="ACTIVE">Active</option><option value="MAINTENANCE">Out of service</option></select></Field>
          {draft.Status === 'MAINTENANCE' && <Field label="Maintenance note"><input value={draft.MaintenanceNote ?? ''} onChange={(e) => set('MaintenanceNote', e.target.value)} className={INPUT} /></Field>}
          {(error || errorMessage) && <p role="alert" className="text-sm text-rose-300">{error || errorMessage}</p>}
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-5 py-3">
          <div>{equipment && onDelete && <button type="button" disabled={saving} onClick={onDelete} aria-label="Delete equipment" className="ui-button-secondary !text-rose-300"><Trash2 className="h-4 w-4" />Delete</button>}</div>
          <div className="ml-auto flex gap-2">
            <button type="button" disabled={saving} onClick={onClose} className="ui-button-ghost">Cancel</button>
            {!readOnly && <button type="submit" disabled={saving} className="ui-button-primary">{submitting ? 'Saving…' : equipment ? 'Save equipment' : 'Add equipment'}</button>}
          </div>
        </div>
      </form>
    </div>
  );
};
