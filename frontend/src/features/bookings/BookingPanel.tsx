import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, MapPin, Pencil, Trash2, X } from 'lucide-react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Field } from '../../components/Field';
import { INPUT } from '../../components/styles';
import type { AuthState } from '../auth/auth';
import { canManageReservation } from './bookingPermissions';
import type { Booking, Equipment, NewBooking } from './bookingsapi';
import { bookingError, bookingsForDay, equipmentHours, fmtDay, fmtTime, formatEquipmentHours, freeHours, hourToTime, MAX_HOURS, pad, sameDay, SLOT_HOURS, startOfDay, toDateInput, weekDates } from './bookingTime';

interface Props {
  equipment: Equipment;
  initialDate: string;
  initialHour?: number;
  initialDuration?: number;
  bookings: Booking[];
  now: Date;
  onClose: () => void;
  onBook: (booking: NewBooking) => Promise<string | null>;
  onCancel: (id: number) => void;
  onSavingChange: (saving: boolean) => void;
  error: string;
  onDismissError: () => void;
  bookingsLoaded: boolean;
  auth: AuthState;
  initialBooking?: Booking;
  onUpdate: (id: number, booking: NewBooking) => Promise<string | null>;
  busy: boolean;
}

export const BookingPanel = ({ equipment, initialDate, initialHour, initialDuration = SLOT_HOURS, bookings, now, onClose, onBook, onCancel, onSavingChange, error: cancelError, onDismissError, bookingsLoaded, auth, initialBooking, onUpdate, busy }: Props) => {
  const hours = equipmentHours(equipment);
  const defaultStart = (value: string) => hourToTime(freeHours(startOfDay(value), bookings, now, equipment)[0] ?? hours.open);
  const [editing, setEditing] = useState<Booking | null>(initialBooking ?? null);
  const [date, setDate] = useState(initialBooking ? toDateInput(new Date(initialBooking.Start)) : initialDate);
  const [startTime, setStartTime] = useState(() => initialBooking ? `${pad(new Date(initialBooking.Start).getHours())}:${pad(new Date(initialBooking.Start).getMinutes())}` : initialHour === undefined ? defaultStart(initialDate) : hourToTime(initialHour));
  const [duration, setDuration] = useState(initialBooking ? (new Date(initialBooking.End).getTime() - new Date(initialBooking.Start).getTime()) / 3600_000 : initialDuration);
  const [purpose, setPurpose] = useState(initialBooking?.Purpose ?? '');
  const [error, setError] = useState('');
  const [submitting, setSaving] = useState(false);
  const saving = submitting || busy;
  const savingRef = useRef(false);
  useEffect(() => {
    if (editing && !bookings.some((booking) => booking.ID === editing.ID)) {
      setEditing(null);
      setPurpose('');
      setError('');
    }
  }, [bookings, editing]);

  const day = startOfDay(date);
  const start = new Date(`${date}T${startTime}`);
  const end = new Date(start.getTime() + duration * 3600_000);
  const dayBookings = bookingsForDay(bookings, day);
  const bookable = equipment.Status === 'ACTIVE';
  const editable = !editing || canManageReservation(auth, editing);
  const otherBookings = bookings.filter((booking) => booking.ID !== editing?.ID);
  const edit = (booking: Booking) => {
    if (savingRef.current || busy || !canManageReservation(auth, booking)) return;
    const start = new Date(booking.Start);
    setEditing(booking);
    setDate(toDateInput(start));
    setStartTime(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
    setDuration((new Date(booking.End).getTime() - start.getTime()) / 3600_000);
    setPurpose(booking.Purpose);
    setError('');
  };
  const clearMessages = () => setError('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || busy || !bookable || !bookingsLoaded || !editable) return;
    clearMessages();
    const validationBookings = editing ? otherBookings.map((booking) => ({
      ...booking, Mine: editing.Mine ? booking.Mine : !booking.Mine && booking.UserName === editing.UserName,
    })) : otherBookings;
    const invalid = bookingError(equipment, validationBookings, start, end, now);
    if (invalid) { setError(invalid); return; }
    savingRef.current = true;
    setSaving(true);
    onSavingChange(true);
    try {
      const payload = { EquipmentID: equipment.ID, Start: start.toISOString(), End: end.toISOString(), Purpose: purpose.trim() };
      const message = editing ? await onUpdate(editing.ID, payload) : await onBook(payload);
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
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{equipment.Name}</h2>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><MapPin className="h-3 w-3" />{equipment.Location}</p>
        </div>
        <button onClick={onClose} disabled={saving} aria-label="Close equipment details" className="ui-icon-button -mr-1.5"><X className="h-4 w-4" /></button>
      </div>
      {cancelError && <ErrorBanner message={cancelError} onDismiss={onDismissError} />}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div className="space-y-2 text-sm text-slate-400">
          <p>{equipment.Description}</p>
          <p>Working hours · {formatEquipmentHours(equipment)}</p>
          <p>Maximum {MAX_HOURS} consecutive hours. Next seven days only.</p>
        </div>
        {!bookable ? <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">Out of service. {equipment.MaintenanceNote} This equipment can't be booked until it's back in service.</p> : (
          <form onSubmit={submit} className="space-y-4">
            {editing && <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">{editing.Mine ? 'Edit reservation' : `Edit reservation for ${editing.UserName}`}</h3>
              <button type="button" disabled={saving} onClick={() => { setEditing(null); setPurpose(''); setError(''); }} className="ui-button-ghost">New reservation</button>
            </div>}
            <Field label="Date" required>
              <input type="date" required min={toDateInput(now)} max={toDateInput(weekDates(now)[6])} value={date} disabled={saving} onChange={(event) => { setDate(event.target.value); setStartTime(hourToTime(freeHours(startOfDay(event.target.value), otherBookings, now, equipment)[0] ?? hours.open)); clearMessages(); }} className={INPUT} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start" required>
                <input type="time" required step={SLOT_HOURS * 3600} min={`${pad(hours.open)}:00`} max={hourToTime(hours.close - SLOT_HOURS)} value={startTime} disabled={saving} onChange={(event) => { setStartTime(event.target.value); clearMessages(); }} className={INPUT} />
              </Field>
              <Field label="Duration" required>
                <select value={duration} disabled={saving} onChange={(event) => { setDuration(Number(event.target.value)); clearMessages(); }} className={INPUT}>
                  {[...new Set([...Array.from({ length: MAX_HOURS / SLOT_HOURS }, (_, i) => (i + 1) * SLOT_HOURS), duration])].sort((a, b) => a - b).map((hour) => <option key={hour} value={hour}>{hour < 1 ? `${hour * 60} minutes` : `${hour} ${hour === 1 ? 'hour' : 'hours'}`}</option>)}
                </select>
              </Field>
            </div>
            {!Number.isNaN(end.getTime()) && <p className="text-xs text-slate-400">Ends {sameDay(start, end) ? '' : `${fmtDay(end, now)}, `}{fmtTime(end)}</p>}
            <Field label="What are you using it for? (optional)">
              <input value={purpose} disabled={saving} onChange={(event) => { setPurpose(event.target.value); clearMessages(); }} placeholder="e.g. Enclosure prototype" className={INPUT} />
            </Field>
            {!bookingsLoaded && <p className="text-xs text-rose-300">Load bookings before choosing a slot.</p>}
            {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
            <button type="submit" disabled={saving || !bookingsLoaded || !editable} className="ui-button-primary w-full"><CalendarDays className="h-4 w-4" />{saving ? 'Saving…' : editing ? 'Save reservation' : 'Confirm reservation'}</button>
          </form>
        )}
        {bookingsLoaded && dayBookings.length > 0 && <section>
          <h3 className="mb-2 text-xs font-medium text-slate-400">Booked on {fmtDay(day, now)}</h3>
          <ul className="divide-y divide-slate-800">
            {dayBookings.map((booking) => <li key={booking.ID} className="flex items-center justify-between gap-2 py-2">
              <div><p className="text-sm">{fmtTime(new Date(booking.Start))} – {fmtTime(new Date(booking.End))}</p><p className={`text-xs ${booking.Mine ? 'text-emerald-300' : 'text-rose-300'}`}>{booking.Mine ? 'Your booking' : 'Booked'}</p></div>
              {canManageReservation(auth, booking) && new Date(booking.End) > now && <div className="flex gap-1">
                {bookable && new Date(booking.Start) > now && <button aria-label={booking.Mine ? 'Edit booking' : `Edit booking for ${booking.UserName}`} disabled={saving} onClick={() => edit(booking)} className="ui-icon-button"><Pencil className="h-4 w-4" /></button>}
                <button aria-label={booking.Mine ? 'Cancel booking' : `Cancel booking for ${booking.UserName}`} disabled={saving} onClick={() => onCancel(booking.ID)} className="ui-icon-button hover:!text-rose-300"><Trash2 className="h-4 w-4" /></button>
              </div>}
            </li>)}
          </ul>
        </section>}
      </div>
    </div>
  );
};
