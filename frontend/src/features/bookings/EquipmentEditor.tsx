import { useRef, useState, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { Field } from '../../components/Field';
import { INPUT } from '../../components/styles';
import type { Equipment, NewEquipment } from './bookingsapi';

export const EquipmentEditor = ({ equipment, categories, onSave, onClose, onSavingChange }: {
  equipment: Equipment | null;
  categories: string[];
  onSave: (item: NewEquipment) => Promise<string | null>;
  onClose: () => void;
  onSavingChange: (saving: boolean) => void;
}) => {
  const [draft, setDraft] = useState<NewEquipment>(() => equipment ?? {
    Name: '', Category: '', Location: '', Description: '', Status: 'ACTIVE', MaintenanceNote: '',
  });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  const set = <K extends keyof NewEquipment>(key: K, value: NewEquipment[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setError('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    if (![draft.Name, draft.Category, draft.Location].every((value) => value.trim())) {
      setError('Name, category, and location are required.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    onSavingChange(true);
    try {
      const message = await onSave(draft);
      if (message) setError(message);
    } finally {
      savingRef.current = false;
      setSaving(false);
      onSavingChange(false);
    }
  };
  return (
    <Modal title={equipment ? 'Edit bookable equipment' : 'Add bookable equipment'} onClose={() => { if (!savingRef.current) onClose(); }}>
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={saving} className="space-y-4">
          <Field label="Name" required><input data-modal-focus required value={draft.Name} onChange={(e) => set('Name', e.target.value)} className={INPUT} /></Field>
          <Field label="Category" required>
            <input required list="equipment-categories" value={draft.Category} onChange={(e) => set('Category', e.target.value)} className={INPUT} />
            <datalist id="equipment-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
          </Field>
          <p className="text-xs text-slate-400">3D printers are available 24/7; other categories use 08:00–20:00.</p>
          <Field label="Location" required><input required value={draft.Location} onChange={(e) => set('Location', e.target.value)} className={INPUT} /></Field>
          <Field label="Description"><textarea rows={3} value={draft.Description} onChange={(e) => set('Description', e.target.value)} className={INPUT} /></Field>
          <Field label="Status"><select value={draft.Status} onChange={(e) => set('Status', e.target.value as Equipment['Status'])} className={INPUT}><option value="ACTIVE">Active</option><option value="MAINTENANCE">Out of service</option></select></Field>
          {draft.Status === 'MAINTENANCE' && <Field label="Maintenance note"><input value={draft.MaintenanceNote ?? ''} onChange={(e) => set('MaintenanceNote', e.target.value)} className={INPUT} /></Field>}
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="ui-button-ghost">Cancel</button>
            <button type="submit" className="ui-button-primary">{saving ? 'Saving…' : equipment ? 'Save equipment' : 'Add equipment'}</button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
};
