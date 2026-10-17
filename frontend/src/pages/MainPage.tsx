import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  ChevronDown,
  CircleDot,
  Tag,
  MapPin,
  Truck,
  Search,
  X,
  Check,
  Pencil,
  Plus,
} from 'lucide-react';

interface MainPageProps {
  token: string;
  onLogout: () => void;
}

// Data model
// TODO: swap with API call info
interface Item {
  id: number;
  name: string;
  partNumber: string;
  category: string;
  location: string; // cabinet / shelf
  bin: string; // drawer / bin within the location
  quantity: number;
  minQuantity: number; // reorder point
  unit: string;
  unitCost: number;
  supplier: string;
  specs: Record<string, string>; // free-form, shown in the spotlight panel
  notes?: string;
  updated: string;
}

type Stock = 'In stock' | 'Low stock' | 'Out of stock';

// Stock status is derived from quantity vs. reorder point, not stored.
const getStock = (item: Item): Stock =>
  item.quantity === 0 ? 'Out of stock' : item.quantity <= item.minQuantity ? 'Low stock' : 'In stock';

const STOCK_STYLES: Record<Stock, string> = {
  'In stock': 'bg-emerald-500/15 text-emerald-300',
  'Low stock': 'bg-amber-500/15 text-amber-300',
  'Out of stock': 'bg-rose-500/15 text-rose-300',
};

const STOCK_BAR: Record<Stock, string> = {
  'In stock': 'bg-emerald-500',
  'Low stock': 'bg-amber-500',
  'Out of stock': 'bg-rose-500',
};

type FilterKey = 'category' | 'stock' | 'location';

const FILTER_GROUPS: {
  key: FilterKey;
  label: string;
  order?: string[];
}[] = [
  { key: 'category', label: 'Category'},
  { key: 'stock', label: 'Stock level', order: ['Out of stock', 'Low stock', 'In stock'] },
  { key: 'location', label: 'Location'},
];

const getFilterValue = (item: Item, key: FilterKey): string =>
  key === 'stock' ? getStock(item) : item[key];

const EMPTY_SELECTION: Record<FilterKey, string[]> = { category: [], stock: [], location: [] };

// Placeholder data until the database is wired up.
const MOCK_ITEMS: Item[] = [
  {
    id: 1, name: '10 kΩ resistor, 0805', partNumber: 'R-0805-10K', category: 'Resistors',
    location: 'Cabinet A', bin: 'Drawer 1', quantity: 1200, minQuantity: 200, unit: 'pcs',
    unitCost: 0.01, supplier: 'Digi-Key',
    specs: { Resistance: '10 kΩ', Tolerance: '1%', Power: '0.125 W', Package: '0805 SMD' },
    updated: '2026-10-15',
  },
  {
    id: 2, name: '220 Ω resistor, axial', partNumber: 'R-TH-220', category: 'Resistors',
    location: 'Cabinet A', bin: 'Drawer 2', quantity: 340, minQuantity: 100, unit: 'pcs',
    unitCost: 0.02, supplier: 'Digi-Key',
    specs: { Resistance: '220 Ω', Tolerance: '5%', Power: '0.25 W', Package: 'Axial through-hole' },
    notes: 'Common LED current-limiting value for 5 V projects.',
    updated: '2026-10-14',
  },
  {
    id: 3, name: '1 kΩ resistor, axial', partNumber: 'R-TH-1K', category: 'Resistors',
    location: 'Cabinet A', bin: 'Drawer 2', quantity: 60, minQuantity: 100, unit: 'pcs',
    unitCost: 0.02, supplier: 'Digi-Key',
    specs: { Resistance: '1 kΩ', Tolerance: '5%', Power: '0.25 W', Package: 'Axial through-hole' },
    updated: '2026-10-12',
  },
  {
    id: 4, name: '100 kΩ trimmer potentiometer', partNumber: 'POT-100K-TRIM', category: 'Resistors',
    location: 'Cabinet A', bin: 'Drawer 3', quantity: 0, minQuantity: 5, unit: 'pcs',
    unitCost: 0.85, supplier: 'Mouser',
    specs: { Resistance: '100 kΩ', Turns: 'Single', Mounting: 'Through-hole' },
    notes: 'Used up in the ECE 201 lab. Reorder before next term.',
    updated: '2026-10-10',
  },
  {
    id: 5, name: '100 nF ceramic capacitor, 0603', partNumber: 'C-0603-100N', category: 'Capacitors',
    location: 'Cabinet A', bin: 'Drawer 4', quantity: 850, minQuantity: 150, unit: 'pcs',
    unitCost: 0.02, supplier: 'Digi-Key',
    specs: { Capacitance: '100 nF', Voltage: '50 V', Dielectric: 'X7R', Package: '0603 SMD' },
    updated: '2026-10-09',
  },
  {
    id: 6, name: '10 µF electrolytic capacitor', partNumber: 'C-EL-10U-25V', category: 'Capacitors',
    location: 'Cabinet A', bin: 'Drawer 5', quantity: 45, minQuantity: 50, unit: 'pcs',
    unitCost: 0.08, supplier: 'Mouser',
    specs: { Capacitance: '10 µF', Voltage: '25 V', Type: 'Aluminum electrolytic', Mounting: 'Radial through-hole' },
    updated: '2026-10-07',
  },
  {
    id: 7, name: '100 µF electrolytic capacitor', partNumber: 'C-EL-100U-16V', category: 'Capacitors',
    location: 'Cabinet A', bin: 'Drawer 5', quantity: 120, minQuantity: 40, unit: 'pcs',
    unitCost: 0.12, supplier: 'Mouser',
    specs: { Capacitance: '100 µF', Voltage: '16 V', Type: 'Aluminum electrolytic', Mounting: 'Radial through-hole' },
    updated: '2026-10-05',
  },
  {
    id: 8, name: '22 pF ceramic capacitor, 0603', partNumber: 'C-0603-22P', category: 'Capacitors',
    location: 'Cabinet A', bin: 'Drawer 4', quantity: 400, minQuantity: 100, unit: 'pcs',
    unitCost: 0.03, supplier: 'Digi-Key',
    specs: { Capacitance: '22 pF', Voltage: '50 V', Dielectric: 'C0G', Package: '0603 SMD' },
    notes: 'Crystal load capacitors.',
    updated: '2026-09-30',
  },
  {
    id: 9, name: 'Lead-free solder, 0.8 mm', partNumber: 'SLD-SAC305-08', category: 'Soldering',
    location: 'Cabinet B', bin: 'Shelf 1', quantity: 4, minQuantity: 2, unit: 'rolls',
    unitCost: 18.5, supplier: 'Digi-Key',
    specs: { Alloy: 'SAC305', Diameter: '0.8 mm', Weight: '250 g', Flux: 'Rosin core' },
    updated: '2026-10-11',
  },
  {
    id: 10, name: 'Desoldering wick, 2.0 mm', partNumber: 'SLD-WICK-20', category: 'Soldering',
    location: 'Cabinet B', bin: 'Shelf 1', quantity: 6, minQuantity: 3, unit: 'pcs',
    unitCost: 3.25, supplier: 'Mouser',
    specs: { Width: '2.0 mm', Length: '1.6 m' },
    updated: '2026-10-02',
  },
  {
    id: 11, name: 'No-clean flux pen', partNumber: 'SLD-FLUX-PEN', category: 'Soldering',
    location: 'Cabinet B', bin: 'Shelf 2', quantity: 1, minQuantity: 2, unit: 'pcs',
    unitCost: 9.9, supplier: 'Digi-Key',
    specs: { Type: 'No-clean', Volume: '10 mL' },
    updated: '2026-10-13',
  },
  {
    id: 12, name: 'Chisel soldering tip, 2.4 mm', partNumber: 'SLD-TIP-24D', category: 'Soldering',
    location: 'Cabinet B', bin: 'Shelf 2', quantity: 8, minQuantity: 4, unit: 'pcs',
    unitCost: 6.5, supplier: 'Mouser',
    specs: { Shape: 'Chisel', Width: '2.4 mm', Fits: 'Station iron, bench series' },
    updated: '2026-09-28',
  },
  {
    id: 13, name: 'M3 × 8 mm socket head cap screw', partNumber: 'FST-M3-8-SHCS', category: 'Fasteners',
    location: 'Cabinet C', bin: 'Drawer 1', quantity: 500, minQuantity: 100, unit: 'pcs',
    unitCost: 0.06, supplier: 'McMaster-Carr',
    specs: { Thread: 'M3 × 0.5', Length: '8 mm', Material: 'A2 stainless', Drive: '2.5 mm hex' },
    updated: '2026-10-08',
  },
  {
    id: 14, name: 'M3 hex nut', partNumber: 'FST-M3-NUT', category: 'Fasteners',
    location: 'Cabinet C', bin: 'Drawer 1', quantity: 80, minQuantity: 100, unit: 'pcs',
    unitCost: 0.04, supplier: 'McMaster-Carr',
    specs: { Thread: 'M3 × 0.5', Material: 'A2 stainless', 'Across flats': '5.5 mm' },
    updated: '2026-10-08',
  },
  {
    id: 15, name: 'M3 × 12 mm brass standoff', partNumber: 'FST-SO-M3-12', category: 'Fasteners',
    location: 'Cabinet C', bin: 'Drawer 2', quantity: 150, minQuantity: 50, unit: 'pcs',
    unitCost: 0.35, supplier: 'McMaster-Carr',
    specs: { Thread: 'M3 × 0.5', Length: '12 mm', Type: 'Female–female hex', Material: 'Brass' },
    updated: '2026-10-01',
  },
  {
    id: 16, name: 'M2.5 × 6 mm pan head screw', partNumber: 'FST-M2.5-6-PH', category: 'Fasteners',
    location: 'Cabinet C', bin: 'Drawer 3', quantity: 0, minQuantity: 50, unit: 'pcs',
    unitCost: 0.05, supplier: 'McMaster-Carr',
    specs: { Thread: 'M2.5 × 0.45', Length: '6 mm', Material: 'Zinc-plated steel', Drive: 'Phillips' },
    notes: 'Raspberry Pi mounting size.',
    updated: '2026-10-16',
  },
  {
    id: 17, name: '22 AWG hookup wire, red', partNumber: 'WIR-22-RED', category: 'Wire & Cable',
    location: 'Cabinet B', bin: 'Shelf 3', quantity: 3, minQuantity: 2, unit: 'spools',
    unitCost: 14, supplier: 'Digi-Key',
    specs: { Gauge: '22 AWG', Type: 'Solid core', Insulation: 'PVC', Length: '30 m' },
    updated: '2026-09-25',
  },
  {
    id: 18, name: 'Heat shrink assortment', partNumber: 'WIR-HS-ASST', category: 'Wire & Cable',
    location: 'Cabinet B', bin: 'Shelf 3', quantity: 4, minQuantity: 2, unit: 'kits',
    unitCost: 12.5, supplier: 'Mouser',
    specs: { Contents: '530 pcs, 2:1 ratio', Sizes: '2–13 mm' },
    updated: '2026-09-20',
  },
];

// Edit helpers
const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => `$${n.toFixed(2)}`;

// While editing, numbers are kept as strings so the inputs can be empty mid-typing.
// Notes are not part of the draft: they save on their own (see NotesSection).
interface Draft {
  name: string;
  partNumber: string;
  category: string;
  location: string;
  bin: string;
  supplier: string;
  unit: string;
  quantity: string;
  minQuantity: string;
  unitCost: string;
  specs: { key: string; value: string }[];
}

const toDraft = (i: Item): Draft => ({
  name: i.name,
  partNumber: i.partNumber,
  category: i.category,
  location: i.location,
  bin: i.bin,
  supplier: i.supplier,
  unit: i.unit,
  quantity: String(i.quantity),
  minQuantity: String(i.minQuantity),
  unitCost: String(i.unitCost),
  specs: Object.entries(i.specs).map(([key, value]) => ({ key, value })),
});

const toCount = (s: string) => Math.max(0, Math.floor(Number(s) || 0));

const fromDraft = (d: Draft): Partial<Item> => ({
  name: d.name.trim(),
  partNumber: d.partNumber.trim(),
  category: d.category.trim() || 'Uncategorized',
  location: d.location.trim() || 'Unassigned',
  bin: d.bin.trim(),
  supplier: d.supplier.trim(),
  unit: d.unit.trim() || 'pcs',
  quantity: toCount(d.quantity),
  minQuantity: toCount(d.minQuantity),
  unitCost: Math.max(0, Number(d.unitCost) || 0),
  specs: Object.fromEntries(
    d.specs.filter((s) => s.key.trim()).map((s) => [s.key.trim(), s.value.trim()])
  ),
});

// Existing values offered as autocomplete while typing in the edit form.
type Suggestions = Record<'category' | 'location' | 'bin' | 'supplier' | 'unit', string[]>;

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

// Notes: always editable, saves when the field loses focus
const NotesSection = ({ value, onCommit }: { value: string; onCommit: (v: string) => void }) => {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  return (
    <section>
      <h3 className="text-sm font-medium text-slate-300 mb-1">Notes</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== value) onCommit(text);
        }}
        rows={4}
        placeholder="Add a note"
        className={`${INPUT} resize-y`}
      />
    </section>
  );
};

// Edit form
const EditForm = ({
  item,
  isNew,
  suggestions,
  onSave,
  onCancel,
  onNotes,
}: {
  item: Item;
  isNew: boolean;
  suggestions: Suggestions;
  onSave: (id: number, patch: Partial<Item>) => void;
  onCancel: () => void;
  onNotes: (notes: string) => void;
}) => {
  const [d, setD] = useState<Draft>(() => toDraft(item));
  const [error, setError] = useState('');

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));

  const setSpec = (idx: number, field: 'key' | 'value', value: string) =>
    setD((prev) => ({
      ...prev,
      specs: prev.specs.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));

  const addSpec = () => setD((prev) => ({ ...prev, specs: [...prev.specs, { key: '', value: '' }] }));
  const removeSpec = (idx: number) =>
    setD((prev) => ({ ...prev, specs: prev.specs.filter((_, i) => i !== idx) }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.name.trim()) {
      setError('Add a name before saving.');
      return;
    }
    onSave(item.id, fromDraft(d));
  };

  const datalist = (id: string, values: string[]) => (
    <datalist id={id}>
      {values.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  );

  return (
    <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        <section className="grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2">
            <input
              autoFocus
              value={d.name}
              onChange={(e) => {
                set('name', e.target.value);
                setError('');
              }}
              placeholder="e.g. 4.7 kΩ resistor, 0805"
              className={INPUT}
            />
          </Field>
          <Field label="Part number" className="col-span-2">
            <input value={d.partNumber} onChange={(e) => set('partNumber', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Category">
            <input list="dl-category" value={d.category} onChange={(e) => set('category', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Supplier">
            <input list="dl-supplier" value={d.supplier} onChange={(e) => set('supplier', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Location">
            <input list="dl-location" value={d.location} onChange={(e) => set('location', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Bin / drawer">
            <input list="dl-bin" value={d.bin} onChange={(e) => set('bin', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Quantity">
            <input type="number" min={0} step={1} value={d.quantity} onChange={(e) => set('quantity', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Unit">
            <input list="dl-unit" value={d.unit} onChange={(e) => set('unit', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Reorder at">
            <input type="number" min={0} step={1} value={d.minQuantity} onChange={(e) => set('minQuantity', e.target.value)} className={INPUT} />
          </Field>
          <Field label="Unit cost ($)">
            <input type="number" min={0} step="0.01" value={d.unitCost} onChange={(e) => set('unitCost', e.target.value)} className={INPUT} />
          </Field>
        </section>

        <section>
          <h3 className="text-sm font-medium text-slate-300 mb-2">Specifications</h3>
          <div className="space-y-2">
            {d.specs.map((s, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  aria-label="Spec name"
                  placeholder="Name"
                  value={s.key}
                  onChange={(e) => setSpec(idx, 'key', e.target.value)}
                  className={`${INPUT} w-2/5`}
                />
                <input
                  aria-label="Spec value"
                  placeholder="Value"
                  value={s.value}
                  onChange={(e) => setSpec(idx, 'value', e.target.value)}
                  className={`${INPUT} flex-1 min-w-0`}
                />
                <button
                  type="button"
                  onClick={() => removeSpec(idx)}
                  title="Remove spec"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-slate-800 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSpec}
              className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
            >
              <Plus className="w-3.5 h-3.5" />
              Add spec
            </button>
          </div>
        </section>

        <NotesSection value={item.notes ?? ''} onCommit={onNotes} />

        {error && <p className="text-sm text-rose-300">{error}</p>}

        {datalist('dl-category', suggestions.category)}
        {datalist('dl-supplier', suggestions.supplier)}
        {datalist('dl-location', suggestions.location)}
        {datalist('dl-bin', suggestions.bin)}
        {datalist('dl-unit', suggestions.unit)}
      </div>

      <div className="px-5 py-3 border-t border-slate-800 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-400 text-white transition-colors"
        >
          {isNew ? 'Add item' : 'Save changes'}
        </button>
      </div>
    </form>
  );
};

// Spotlight panel
interface SpotlightProps {
  item: Item;
  isEditing: boolean;
  isNew: boolean;
  suggestions: Suggestions;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (id: number, patch: Partial<Item>) => void;
  onNotes: (id: number, notes: string) => void;
  onAdjust: (id: number, delta: number) => void;
}

const SpotlightPanel = ({
  item,
  isEditing,
  isNew,
  suggestions,
  onClose,
  onEdit,
  onCancel,
  onSave,
  onNotes,
  onAdjust,
}: SpotlightProps) => {
  const stock = getStock(item);
  const barMax = Math.max(item.quantity, item.minQuantity * 2, 1);
  const barPct = Math.min(100, (item.quantity / barMax) * 100);
  const reorderPct = Math.min(100, (item.minQuantity / barMax) * 100);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-slate-800">
        <div className="min-w-0">
          {isEditing ? (
            <h2 className="text-base font-semibold leading-snug">{isNew ? 'New item' : 'Edit item'}</h2>
          ) : (
            <>
              <p className="text-xs text-slate-500">{item.category}</p>
              <h2 className="text-base font-semibold leading-snug mt-0.5">{item.name}</h2>
              <p className="text-xs text-slate-400 font-mono mt-1">{item.partNumber}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 -mr-1.5 shrink-0">
          {!isEditing && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Edit item"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={isEditing ? onCancel : onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={isEditing ? 'Cancel (Esc)' : 'Close (Esc)'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isEditing ? (
        <EditForm
          item={item}
          isNew={isNew}
          suggestions={suggestions}
          onSave={onSave}
          onCancel={onCancel}
          onNotes={(notes) => onNotes(item.id, notes)}
        />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {/* Stock */}
            <section>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-semibold tabular-nums">
                  {item.quantity.toLocaleString()}{' '}
                  <span className="text-sm font-normal text-slate-400">{item.unit}</span>
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STOCK_STYLES[stock]}`}>{stock}</span>
              </div>

              <div className="relative mt-3 h-1.5 rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${STOCK_BAR[stock]}`} style={{ width: `${barPct}%` }} />
                <div
                  className="absolute -top-1 w-0.5 h-3.5 bg-slate-400 rounded-full"
                  style={{ left: `${reorderPct}%` }}
                  title="Reorder point"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Reorder at {item.minQuantity.toLocaleString()} {item.unit}
              </p>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {[-10, -1, 1, 10].map((delta) => (
                  <button
                    key={delta}
                    onClick={() => onAdjust(item.id, delta)}
                    disabled={delta < 0 && item.quantity === 0}
                    className="py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors tabular-nums"
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
            </section>

            {/* Specs */}
            {Object.keys(item.specs).length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Specifications</h3>
                <dl className="text-sm divide-y divide-slate-800/80 border-y border-slate-800/80">
                  {Object.entries(item.specs).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 py-1.5">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {/* Where / who / how much */}
            <section className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span>{[item.location, item.bin].filter(Boolean).join(', ')}</span>
              </div>
              {item.supplier && (
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-500" />
                  <span>{item.supplier}</span>
                </div>
              )}
              <p className="text-slate-400">
                {money(item.unitCost)} each · {money(item.unitCost * item.quantity)} on hand
              </p>
            </section>

            <NotesSection value={item.notes ?? ''} onCommit={(notes) => onNotes(item.id, notes)} />
          </div>

          <div className="px-5 py-3 border-t border-slate-800 text-xs text-slate-500">
            Last updated {item.updated}
          </div>
        </>
      )}
    </div>
  );
};


/* ---------- Page ---------- */
export const MainPage = ({ token, onLogout }: MainPageProps) => {
  /* Sidebar layout */
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX >= 180 && e.clientX <= 500) setSidebarWidth(e.clientX);
    };
    const handleMouseUp = () => setIsResizing(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  /* Data + filters */
  // Later: fetch with `token` and setItems(result).
  const [items, setItems] = useState<Item[]>(MOCK_ITEMS);
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<FilterKey, boolean>>({
    category: true,
    stock: true,
    location: false,
  });
  const [selected, setSelected] = useState<Record<FilterKey, string[]>>(EMPTY_SELECTION);

  /* Spotlight + editing */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null); // item in edit mode
  const [newItemId, setNewItemId] = useState<number | null>(null); // unsaved new item, if any
  const spotlightItem = items.find((i) => i.id === selectedId) ?? null;

  // Drops an unsaved new item. Nothing has been sent to the API yet, so this is purely local.
  const discardNew = () => {
    if (newItemId === null) return;
    setItems((prev) => prev.filter((i) => i.id !== newItemId));
    setNewItemId(null);
  };

  const selectItem = (id: number | null) => {
    if (newItemId !== null && id !== newItemId) discardNew();
    setEditingId(null);
    setSelectedId(id);
  };

  const cancelEdit = () => {
    if (editingId !== null && editingId === newItemId) {
      discardNew();
      setSelectedId(null);
    }
    setEditingId(null);
  };

  const onEscape = () => (editingId !== null ? cancelEdit() : selectItem(null));
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const el = e.target as HTMLElement;
      if (el.tagName === 'TEXTAREA') el.blur();
      onEscapeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Local-only for now. Later: PATCH /items/:id with the patch, then update state from the response.
  const updateItem = (id: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch, updated: today() } : i)));

  const adjustQuantity = (id: number, delta: number) =>
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta), updated: today() } : i
      )
    );

  // Later: POST /items the first time a new item is saved, PATCH /items/:id after that.
  const saveItem = (id: number, patch: Partial<Item>) => {
    updateItem(id, patch);
    setEditingId(null);
    if (id === newItemId) setNewItemId(null);
  };

  // Adds a blank draft at the top of the list and opens it in edit mode.
  const addItem = () => {
    const base = newItemId === null ? items : items.filter((i) => i.id !== newItemId);
    const id = Math.max(0, ...base.map((i) => i.id)) + 1;
    const draft: Item = {
      id,
      name: '',
      partNumber: '',
      // If exactly one category / location filter is on, start the new item there.
      category: selected.category.length === 1 ? selected.category[0] : '',
      location: selected.location.length === 1 ? selected.location[0] : '',
      bin: '',
      quantity: 0,
      minQuantity: 0,
      unit: 'pcs',
      unitCost: 0,
      supplier: '',
      specs: {},
      updated: today(),
    };
    setItems([draft, ...base]);
    setSelectedId(id);
    setEditingId(id);
    setNewItemId(id);
  };

  const suggestions = useMemo<Suggestions>(() => {
    const uniq = (pick: (i: Item) => string) => [...new Set(items.map(pick).filter(Boolean))].sort();
    return {
      category: uniq((i) => i.category),
      location: uniq((i) => i.location),
      bin: uniq((i) => i.bin),
      supplier: uniq((i) => i.supplier),
      unit: uniq((i) => i.unit),
    };
  }, [items]);

  const options = useMemo(() => {
    const result = {} as Record<FilterKey, { value: string; count: number }[]>;
    for (const { key, order } of FILTER_GROUPS) {
      const counts = new Map<string, number>();
      items.forEach((item) => {
        if (item.id === newItemId) return; // unsaved draft doesn't count yet
        const v = getFilterValue(item, key);
        counts.set(v, (counts.get(v) ?? 0) + 1);
      });
      result[key] = [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) =>
          order ? order.indexOf(a.value) - order.indexOf(b.value) : a.value.localeCompare(b.value)
        );
    }
    return result;
  }, [items, newItemId]);

  // Within a group: ORing Across groups: ANDing.
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (item.id === newItemId) return true; // keep the draft visible while it's being filled in
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.partNumber.toLowerCase().includes(q) ||
        Object.values(item.specs).some((v) => v.toLowerCase().includes(q));
      return (
        matchesQuery &&
        FILTER_GROUPS.every(
          ({ key }) => selected[key].length === 0 || selected[key].includes(getFilterValue(item, key))
        )
      );
    });
  }, [items, query, selected, newItemId]);

  const toggleGroup = (key: FilterKey) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleOption = (key: FilterKey, value: string) =>
    setSelected((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));

  const clearAll = () => setSelected(EMPTY_SELECTION);

  const activeFilters = FILTER_GROUPS.flatMap(({ key }) =>
    selected[key].map((value) => ({ key, value }))
  );

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* sidebar + filter tree */}
      <aside
        style={{ width: isCollapsed ? '72px' : `${sidebarWidth}px` }}
        className={`relative bg-slate-900 border-r border-slate-800 flex flex-col select-none z-20 shrink-0 ${
          isResizing ? '' : 'transition-[width] duration-150'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          {!isCollapsed && (
            <span className="font-bold text-sm tracking-tight truncate bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Design Lab Inventory
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors mx-auto"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {FILTER_GROUPS.map(({ key, label}) => {
            const isOpen = openGroups[key];
            const activeCount = selected[key].length;

            // Collapsed rail
            if (isCollapsed) {
              return (
                <button
                  key={key}
                  onClick={() => {
                    setIsCollapsed(false);
                    setOpenGroups((prev) => ({ ...prev, [key]: true }));
                  }}
                  title={label}
                  className="relative w-full flex justify-center p-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                >
                  {activeCount > 0 && (
                    <span className="absolute top-1.5 right-3 min-w-4 h-4 px-1 rounded-full bg-indigo-500 text-[10px] leading-4 text-white text-center">
                      {activeCount}
                    </span>
                  )}
                </button>
              );
            }

            return (
              <div key={key} className="mb-1">
                <button
                  onClick={() => toggleGroup(key)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <span className="truncate">{label}</span>
                  {activeCount > 0 && (
                    <span className="ml-auto text-xs px-1.5 rounded-full bg-indigo-500/20 text-indigo-300">
                      {activeCount}
                    </span>
                  )}
                </button>

                {isOpen && (
                  <ul className="ml-4 mt-0.5 pl-2 border-l border-slate-800">
                    {options[key].map(({ value, count }) => {
                      const checked = selected[key].includes(value);
                      return (
                        <li key={value}>
                          <button
                            onClick={() => toggleOption(key, value)}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors ${
                              checked
                                ? 'bg-indigo-500/10 text-indigo-200'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                                checked ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </span>
                            <span className="truncate">{value}</span>
                            <span className="ml-auto text-xs text-slate-500">{count}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {!isCollapsed && (
          <div className="p-3 border-t border-slate-800/80 bg-slate-900/50">
            <button
              onClick={onLogout}
              className="w-full px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors text-left"
            >
              Log out
            </button>
          </div>
        )}

        {/* Resize handle */}
        {!isCollapsed && (
          <div
            onMouseDown={() => setIsResizing(true)}
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize group flex items-center justify-center hover:bg-indigo-500/50 transition-colors"
            title="Drag to resize"
          >
            <div className="w-0.5 h-8 bg-slate-700 group-hover:bg-indigo-400 rounded-full" />
          </div>
        )}
      </aside>

      {/* Main: rowed list */}
      <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden min-w-0">
        <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, part number or spec"
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
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map(({ key, value }) => (
                <button
                  key={`${key}:${value}`}
                  onClick={() => toggleOption(key, value)}
                  className="flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-200 text-xs hover:bg-indigo-500/25 transition-colors"
                >
                  {value}
                  <X className="w-3 h-3" />
                </button>
              ))}
              <button onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-300 ml-1">
                Clear all
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          {visibleItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
              <p>No parts match these filters.</p>
              <button onClick={clearAll} className="text-indigo-400 hover:text-indigo-300">
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {visibleItems.map((item) => {
                const stock = getStock(item);
                const isSelected = item.id === selectedId;
                const isDraft = item.id === newItemId;
                const subtitle = [item.partNumber, [item.location, item.bin].filter(Boolean).join(', ')]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        if (!isDraft) selectItem(isSelected ? null : item.id);
                      }}
                      aria-pressed={isSelected}
                      className={`w-full px-6 py-3.5 flex items-center gap-4 text-left border-l-2 transition-colors ${
                        isSelected
                          ? 'bg-indigo-500/10 border-indigo-400'
                          : 'border-transparent hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${item.name ? '' : 'italic text-slate-500'}`}>
                          {item.name || 'Untitled item'}
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
                      <span className="text-sm text-slate-300 w-24 text-right tabular-nums shrink-0">
                        {isDraft ? '' : `${item.quantity.toLocaleString()} ${item.unit}`}
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
              key={spotlightItem.id}
              item={spotlightItem}
              isEditing={editingId === spotlightItem.id}
              isNew={newItemId === spotlightItem.id}
              suggestions={suggestions}
              onClose={() => selectItem(null)}
              onEdit={() => setEditingId(spotlightItem.id)}
              onCancel={cancelEdit}
              onSave={saveItem}
              onNotes={(id, notes) => updateItem(id, { notes })}
              onAdjust={adjustQuantity}
            />
          )}
        </div>
      </aside>
    </div>
  );
};