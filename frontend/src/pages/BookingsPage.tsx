import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Trash2, MapPin, Printer, Wrench } from 'lucide-react';
import { useAuth, useLogout } from '../features/auth/useAuth';
import {
  getEquipment,
  getBookings,
  createBooking,
  cancelBooking,
  type Equipment,
  type Booking,
  type NewBooking,
} from '../features/bookings/bookingsapi';

// Booking rules. Move these to the backend if you want them enforced server-side.
const OPEN_HOUR = 8; // equipment can be booked from 8:00...
const CLOSE_HOUR = 20; // ...until 20:00
const MAX_HOURS = 8; // longest single booking

// TODO: set these to your real routes. Plain <a> links work with any router (they reload the page);
// swap for your router's <Link> if you want client-side navigation.
const INVENTORY_PATH = '/app';
const BOOKINGS_PATH = '/app/bookings';

/* ---------- Date helpers ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (dateStr: string) => new Date(`${dateStr}T00:00`);
const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const fmtDay = (d: Date, now: Date) => {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && bStart < aEnd;

/* ---------- Availability ---------- */
type Availability =
  | { kind: 'maintenance' }
  | { kind: 'in-use'; until: Date; by: string }
  | { kind: 'free'; next: Booking | null };

const getAvailability = (eq: Equipment, bookings: Booking[], now: Date): Availability => {
  if (eq.Status === 'MAINTENANCE') return { kind: 'maintenance' };
  const current = bookings.find((b) => new Date(b.Start) <= now && new Date(b.End) > now);
  if (current) return { kind: 'in-use', until: new Date(current.End), by: current.Mine ? 'you' : current.UserName };
  const next =
    bookings
      .filter((b) => new Date(b.Start) > now)
      .sort((a, b) => a.Start.localeCompare(b.Start))[0] ?? null;
  return { kind: 'free', next };
};

const BADGE: Record<Availability['kind'], { label: string; style: string }> = {
  free: { label: 'Available', style: 'bg-emerald-500/15 text-emerald-300' },
  'in-use': { label: 'In use', style: 'bg-amber-500/15 text-amber-300' },
  maintenance: { label: 'Out of service', style: 'bg-rose-500/15 text-rose-300' },
};

const availabilityText = (a: Availability, now: Date) => {
  if (a.kind === 'maintenance') return 'Not bookable right now';
  if (a.kind === 'in-use') return `In use by ${a.by} until ${fmtTime(a.until)}`;
  if (a.next) return `Next booking: ${fmtDay(new Date(a.next.Start), now)} ${fmtTime(new Date(a.next.Start))}`;
  return 'No upcoming bookings';
};

const CategoryIcon = ({ category, className }: { category: string; className?: string }) =>
  category === '3D printers' ? <Printer className={className} /> : <Wrench className={className} />;

/* ---------- Shared bits ---------- */
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

const NavLink = ({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) => (
  <a
    href={href}
    aria-current={active ? 'page' : undefined}
    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
      active ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
    }`}
  >
    {children}
  </a>
);

const FilterChip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`px-3 py-1 rounded-full text-xs transition-colors ${
      active
        ? 'bg-indigo-500/20 text-indigo-200'
        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
    }`}
  >
    {children}
  </button>
);

/* ---------- Day timeline ---------- */
const Timeline = ({ day, bookings }: { day: Date; bookings: Booking[] }) => {
  const open = new Date(day);
  open.setHours(OPEN_HOUR, 0, 0, 0);
  const close = new Date(day);
  close.setHours(CLOSE_HOUR, 0, 0, 0);
  const span = close.getTime() - open.getTime();
  const pct = (t: number) => ((t - open.getTime()) / span) * 100;

  const labels: number[] = [];
  for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h += 2) labels.push(h);

  return (
    <div>
      <div className="relative h-7 rounded-md bg-slate-950 border border-slate-800 overflow-hidden">
        {bookings.map((b) => {
          const s = Math.max(new Date(b.Start).getTime(), open.getTime());
          const e = Math.min(new Date(b.End).getTime(), close.getTime());
          if (e <= s) return null;
          return (
            <div
              key={b.ID}
              title={`${b.Mine ? 'You' : b.UserName}: ${fmtTime(new Date(b.Start))} – ${fmtTime(new Date(b.End))}`}
              className={`absolute top-0 bottom-0 border-x ${
                b.Mine ? 'bg-indigo-500/60 border-indigo-300/40' : 'bg-slate-600/70 border-slate-400/30'
              }`}
              style={{ left: `${pct(s)}%`, width: `${pct(e) - pct(s)}%` }}
            />
          );
        })}
      </div>
      <div className="relative h-4 mt-1">
        {labels.map((h) => (
          <span
            key={h}
            className="absolute -translate-x-1/2 text-[10px] text-slate-500 tabular-nums"
            style={{ left: `${((h - OPEN_HOUR) / (CLOSE_HOUR - OPEN_HOUR)) * 100}%` }}
          >
            {h % 12 === 0 ? 12 : h % 12}
            {h < 12 ? 'a' : 'p'}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ---------- Spotlight panel ---------- */
interface PanelProps {
  equipment: Equipment;
  bookings: Booking[]; // this equipment's bookings only
  now: Date;
  onClose: () => void;
  onBook: (booking: NewBooking) => Promise<string | null>; // returns an error message, or null on success
  onCancel: (id: number) => void;
}

// Next whole hour (clamped into opening hours) as the default slot
const defaultSlot = (dateStr: string, now: Date) => {
  let startHour = OPEN_HOUR;
  if (dateStr === toDateInput(now)) startHour = Math.min(Math.max(now.getHours() + 1, OPEN_HOUR), CLOSE_HOUR - 1);
  return { start: `${pad(startHour)}:00`, end: `${pad(startHour + 1)}:00` };
};

const BookingPanel = ({ equipment, bookings, now, onClose, onBook, onCancel }: PanelProps) => {
  const today = toDateInput(now);
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState(() => defaultSlot(today, now));
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const availability = getAvailability(equipment, bookings, now);
  const bookable = equipment.Status === 'ACTIVE';

  const day = startOfDay(date);
  const dayBookings = bookings
    .filter((b) => sameDay(new Date(b.Start), day))
    .sort((a, b) => a.Start.localeCompare(b.Start));

  const changeDate = (value: string) => {
    setDate(value);
    setSlot(defaultSlot(value, now));
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const start = new Date(`${date}T${slot.start}`);
    const end = new Date(`${date}T${slot.end}`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return setError('Pick a date and times.');
    if (end <= start) return setError('End time must be after the start time.');
    if (start < now) return setError('That start time is in the past.');

    const open = new Date(day);
    open.setHours(OPEN_HOUR, 0, 0, 0);
    const close = new Date(day);
    close.setHours(CLOSE_HOUR, 0, 0, 0);
    if (start < open || end > close) return setError(`Bookings must be between ${OPEN_HOUR}:00 and ${CLOSE_HOUR}:00.`);
    if (end.getTime() - start.getTime() > MAX_HOURS * 3600_000) {
      return setError(`Bookings can be at most ${MAX_HOURS} hours.`);
    }
    if (bookings.some((b) => overlaps(start, end, new Date(b.Start), new Date(b.End)))) {
      return setError('That time overlaps an existing booking.');
    }

    setSaving(true);
    const message = await onBook({
      EquipmentID: equipment.ID,
      Start: start.toISOString(),
      End: end.toISOString(),
      Purpose: purpose.trim(),
    });
    setSaving(false);
    if (message) setError(message);
    else setPurpose('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-slate-800">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug">{equipment.Name}</h2>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {equipment.Location}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full ${BADGE[availability.kind].style}`}>
              {BADGE[availability.kind].label}
            </span>
            <span className="text-xs text-slate-500">{equipment.Category}</span>
          </div>
          <p className="text-sm text-slate-400">{availabilityText(availability, now)}</p>
          {equipment.Description && <p className="text-sm">{equipment.Description}</p>}
          {!bookable && equipment.MaintenanceNote && (
            <p className="text-sm text-rose-300">{equipment.MaintenanceNote}</p>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <Field label="Date" className="flex-1">
              <input type="date" min={today} value={date} onChange={(e) => changeDate(e.target.value)} className={INPUT} />
            </Field>
            <p className="text-sm text-slate-400 pb-1.5">{fmtDay(day, now)}</p>
          </div>

          <Timeline day={day} bookings={dayBookings} />

          {dayBookings.length === 0 ? (
            <p className="text-xs text-slate-500">Nothing booked on this day.</p>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {dayBookings.map((b) => {
                const cancellable = b.Mine && new Date(b.End) > now;
                return (
                  <li key={b.ID} className="py-2 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm tabular-nums">
                        {fmtTime(new Date(b.Start))} – {fmtTime(new Date(b.End))}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {b.Mine ? 'You' : b.UserName}
                        {b.Purpose ? ` · ${b.Purpose}` : ''}
                      </p>
                    </div>
                    {cancellable && (
                      <button
                        onClick={() => {
                          if (window.confirm('Cancel this booking?')) onCancel(b.ID);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-slate-800 transition-colors shrink-0"
                        title="Cancel booking"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {bookable ? (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-xs text-slate-500">
              Book a slot on {fmtDay(day, now).toLowerCase()} ({OPEN_HOUR}:00–{CLOSE_HOUR}:00, up to {MAX_HOURS} h)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <input
                  type="time"
                  step={900}
                  value={slot.start}
                  onChange={(e) => {
                    setSlot((s) => ({ ...s, start: e.target.value }));
                    setError('');
                  }}
                  className={INPUT}
                />
              </Field>
              <Field label="End">
                <input
                  type="time"
                  step={900}
                  value={slot.end}
                  onChange={(e) => {
                    setSlot((s) => ({ ...s, end: e.target.value }));
                    setError('');
                  }}
                  className={INPUT}
                />
              </Field>
            </div>
            <Field label="What are you using it for? (optional)">
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Enclosure prototype"
                className={INPUT}
              />
            </Field>
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-sm font-medium text-white transition-colors"
            >
              {saving ? 'Booking…' : 'Book it'}
            </button>
          </form>
        ) : (
          <p className="text-sm text-slate-500">This equipment can't be booked until it's back in service.</p>
        )}
      </div>
    </div>
  );
};

/* ---------- Page ---------- */
export const BookingsPage = () => {
  /* Auth */
  const auth = useAuth();
  const logout = useLogout();

  /* Data */
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => new Date());

  // Filters
  const [category, setCategory] = useState<string | null>(null);
  const [availableNow, setAvailableNow] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong');

  // GET /equipment  and  GET /bookings
  useEffect(() => {
    let cancelled = false;
    Promise.all([getEquipment(), getBookings()])
      .then(([eq, bk]) => {
        if (cancelled) return;
        setEquipment(eq);
        setBookings(bk);
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

  // Keep "in use" status fresh
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  /* Spotlight */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = equipment.find((e) => e.ID === selectedId) ?? null;

  const closeRef = useRef(() => setSelectedId(null));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // POST /bookings. Resolves to an error message for the form, or null when it worked.
  const book = async (booking: NewBooking): Promise<string | null> => {
    try {
      const created = await createBooking(booking);
      setBookings((prev) => [...prev, created]);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Something went wrong';
    }
  };

  // DELETE /bookings/:id
  const cancel = async (id: number) => {
    setError('');
    try {
      await cancelBooking(id);
      setBookings((prev) => prev.filter((b) => b.ID !== id));
    } catch (e) {
      fail(e);
    }
  };

  const bookingsByEquipment = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (const b of bookings) map.set(b.EquipmentID, [...(map.get(b.EquipmentID) ?? []), b]);
    return map;
  }, [bookings]);

  const categories = useMemo(() => [...new Set(equipment.map((e) => e.Category))].sort(), [equipment]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return equipment.filter((eq) => {
      const mine = bookingsByEquipment.get(eq.ID) ?? [];
      if (category && eq.Category !== category) return false;
      if (availableNow && getAvailability(eq, mine, now).kind !== 'free') return false;
      if (mineOnly && !mine.some((b) => b.Mine && new Date(b.End) > now)) return false;
      if (!q) return true;
      return (
        eq.Name.toLowerCase().includes(q) ||
        eq.Location.toLowerCase().includes(q) ||
        eq.Category.toLowerCase().includes(q)
      );
    });
  }, [equipment, bookingsByEquipment, query, category, availableNow, mineOnly, now]);

  const filtering = query.trim() !== '' || category !== null || availableNow || mineOnly;

  // Must stay below all hooks above (rules of hooks).
  if (!auth.data?.loggedIn || auth.data.disabled) {
    return null;
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Main: equipment list */}
      <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden min-w-0">
        <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-3 flex items-center gap-4">
          <nav className="flex items-center gap-1 shrink-0">
            <NavLink href={INVENTORY_PATH}>Inventory</NavLink>
            <NavLink href={BOOKINGS_PATH} active>
              Equipment
            </NavLink>
          </nav>
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search equipment or location"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <span className="ml-auto text-sm text-slate-500 shrink-0">
            {visible.length} of {equipment.length}
          </span>
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

        <div className="px-6 py-2.5 border-b border-slate-800 flex flex-wrap items-center gap-2">
          <FilterChip active={category === null} onClick={() => setCategory(null)}>
            All
          </FilterChip>
          {categories.map((c) => (
            <FilterChip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {c}
            </FilterChip>
          ))}
          <span className="w-px h-4 bg-slate-800 mx-1" />
          <FilterChip active={availableNow} onClick={() => setAvailableNow((v) => !v)}>
            Available now
          </FilterChip>
          <FilterChip active={mineOnly} onClick={() => setMineOnly((v) => !v)}>
            My bookings
          </FilterChip>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">Loading equipment…</div>
          ) : visible.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
              <p>{equipment.length === 0 ? 'No equipment yet.' : 'No equipment matches your filters.'}</p>
              {filtering && (
                <button
                  onClick={() => {
                    setQuery('');
                    setCategory(null);
                    setAvailableNow(false);
                    setMineOnly(false);
                  }}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {visible.map((eq) => {
                const availability = getAvailability(eq, bookingsByEquipment.get(eq.ID) ?? [], now);
                const isSelected = eq.ID === selectedId;
                return (
                  <li key={eq.ID}>
                    <button
                      onClick={() => setSelectedId(isSelected ? null : eq.ID)}
                      aria-pressed={isSelected}
                      className={`w-full px-6 py-3.5 flex items-center gap-4 text-left border-l-2 transition-colors ${
                        isSelected
                          ? 'bg-indigo-500/10 border-indigo-400'
                          : 'border-transparent hover:bg-slate-900/60'
                      }`}
                    >
                      <CategoryIcon category={eq.Category} className="w-5 h-5 text-slate-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{eq.Name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {eq.Category} · {eq.Location}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{availabilityText(availability, now)}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${BADGE[availability.kind].style}`}
                      >
                        {BADGE[availability.kind].label}
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
          selected ? 'w-96 border-l border-slate-800' : 'w-0'
        }`}
      >
        <div className="w-96 h-full">
          {selected && (
            <BookingPanel
              key={selected.ID}
              equipment={selected}
              bookings={bookingsByEquipment.get(selected.ID) ?? []}
              now={now}
              onClose={() => setSelectedId(null)}
              onBook={book}
              onCancel={cancel}
            />
          )}
        </div>
      </aside>
    </div>
  );
};