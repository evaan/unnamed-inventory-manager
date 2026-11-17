import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../features/auth/useAuth';
import { hasPermission } from '../features/auth/auth';
import { DetailPanel, Workspace } from '../components/Workspace';
import { SearchInput } from '../components/SearchInput';
import { ErrorBanner } from '../components/ErrorBanner';
import { BookingSkeleton } from '../features/bookings/BookingSkeleton';
import { BookingSchedule } from '../features/bookings/BookingSchedule';
import { BookingFilters } from '../features/bookings/BookingFilters';
import { BookingPanel } from '../features/bookings/BookingPanel';
import { ReservationDetails } from '../features/bookings/ReservationDetails';
import { equipmentHours, fmtDay, fmtTime, sameDay, SLOT_HOURS, startOfDay, toDateInput, weekDates } from '../features/bookings/bookingTime';
import { getEquipment, getBookings, createBooking, cancelBooking, updateBooking, createEquipment, updateEquipment, deleteEquipment, type Equipment, type Booking, type NewBooking, type NewEquipment } from '../features/bookings/bookingsapi';
import { EquipmentEditor } from '../features/bookings/EquipmentEditor';
import { canManageReservation } from '../features/bookings/bookingPermissions';
import { useConfirm } from '../hooks/useConfirm';

const EMPTY_EQUIPMENT: Equipment[] = [];
const EMPTY_BOOKINGS: Booking[] = [];

export const BookingsPage = () => {
  const confirm = useConfirm();
  const auth = useAuth();
  const session = auth.data?.loggedIn && !auth.data.disabled ? auth.data : null;
  const canAdd = hasPermission(auth.data, 'BookingAdd');
  const canModify = hasPermission(auth.data, 'BookingModify');
  const canDelete = hasPermission(auth.data, 'BookingDelete');
  const canViewAll = hasPermission(auth.data, 'BookingManage');
  const canManageEquipment = canModify || canDelete;
  const client = useQueryClient();
  const equipmentQuery = useQuery({ queryKey: ['equipment', session?.email], queryFn: getEquipment, enabled: !!session, retry: false });
  const bookingsKey = ['bookings', session?.email] as const;
  const bookingsQuery = useQuery({ queryKey: bookingsKey, queryFn: getBookings, enabled: !!session, retry: false, refetchInterval: 30_000 });
  const equipment = equipmentQuery.data ?? EMPTY_EQUIPMENT;
  const bookings = bookingsQuery.data ?? EMPTY_BOOKINGS;
  const loadError = equipmentQuery.error ?? bookingsQuery.error;
  const retrying = equipmentQuery.isFetching || bookingsQuery.isFetching;
  const retry = () => { void equipmentQuery.refetch(); void bookingsQuery.refetch(); };
  const setBookings = (update: (previous: Booking[]) => Booking[]) =>
    client.setQueryData<Booking[]>(bookingsKey, (previous) => update(previous ?? []));

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [category, setCategory] = useState<string | null>(null);
  const [availableNow, setAvailableNow] = useState(false);
  const [requestedView, setView] = useState<'schedule' | 'mine' | 'all'>('schedule');
  const view = requestedView === 'all' && !canViewAll ? 'mine' : requestedView;
  const loading = equipmentQuery.isLoading || bookingsQuery.isLoading;
  const [scheduleDate, setScheduleDate] = useState(() => toDateInput(new Date()));
  const [initialHour, setInitialHour] = useState<number | undefined>();
  const [initialDuration, setInitialDuration] = useState(SLOT_HOURS);
  const [panelVersion, setPanelVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | undefined>();
  const [viewingBookingId, setViewingBookingId] = useState<number | null>(null);
  const [equipmentEditor, setEquipmentEditor] = useState<Equipment | 'new' | null>(null);
  const editor = equipmentEditor && (equipmentEditor === 'new' ? canAdd : canManageEquipment) ? equipmentEditor : null;
  const mutationRef = useRef(false);
  const selected = equipment.find((eq) => eq.ID === selectedId) ?? null;
  const viewingBooking = bookings.find((booking) => booking.ID === viewingBookingId);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const selectEquipment = (id: number | null, hour?: number, date?: string, duration = SLOT_HOURS) => {
    if (saving) return;
    setError('');
    setEquipmentEditor(null);
    setEditingBooking(undefined);
    setViewingBookingId(null);
    if (date) setScheduleDate(date);
    setInitialHour(hour);
    setInitialDuration(duration);
    setPanelVersion((version) => version + 1);
    setSelectedId(id);
  };
  const viewEquipment = (id: number) => {
    if (saving || !canManageEquipment) return;
    const item = equipment.find((eq) => eq.ID === id);
    if (!item) return;
    selectEquipment(null);
    setEquipmentEditor(item);
  };
  const viewReservation = (booking: Booking) => {
    if (saving) return;
    selectEquipment(booking.EquipmentID);
    setViewingBookingId(booking.ID);
  };
  const changeScheduleDate = (value: string) => {
    if (saving) return;
    setSelectedId(null);
    setEquipmentEditor(null);
    setScheduleDate(value);
  };
  const closeRef = useRef(() => selectEquipment(null));
  closeRef.current = () => {
    if (saving) return;
    if (editor) setEquipmentEditor(null);
    else selectEquipment(null);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const book = async (booking: NewBooking): Promise<string | null> => {
    try {
      await client.cancelQueries({ queryKey: bookingsKey });
      const created = await createBooking(booking);
      setBookings((previous) => [...previous, created]);
      setSelectedId(null);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Something went wrong';
    }
  };
  const updateReservation = async (id: number, booking: NewBooking): Promise<string | null> => {
    const existing = bookings.find((entry) => entry.ID === id);
    if (!session || !existing || !canManageReservation(session, existing)) return 'You cannot edit this reservation.';
    try {
      await client.cancelQueries({ queryKey: bookingsKey });
      const updated = await updateBooking(id, booking, session);
      setBookings((previous) => previous.map((entry) => entry.ID === id ? updated : entry));
      setSelectedId(null);
      setEditingBooking(undefined);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Something went wrong';
    }
  };
  const editReservation = (booking: Booking) => {
    if (saving || !canManageReservation(auth.data, booking)) return;
    selectEquipment(booking.EquipmentID, undefined, toDateInput(new Date(booking.Start)));
    setEditingBooking(booking);
  };
  const saveEquipment = async (item: NewEquipment): Promise<string | null> => {
    if (!session || !equipmentEditor || !(equipmentEditor === 'new' ? canAdd : canModify)) return 'You cannot manage this equipment.';
    try {
      await client.cancelQueries({ queryKey: ['equipment', session.email] });
      const saved = equipmentEditor === 'new' ? await createEquipment(item, session) : await updateEquipment(equipmentEditor.ID, item, session);
      client.setQueryData<Equipment[]>(['equipment', session.email], (previous = []) =>
        equipmentEditor === 'new' ? [...previous, saved] : previous.map((entry) => entry.ID === saved.ID ? saved : entry));
      if (equipmentEditor === 'new') { setQuery(''); setCategory(null); setAvailableNow(false); setView('schedule'); }
      setEquipmentEditor(null);
      setPanelVersion((version) => version + 1);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Something went wrong';
    }
  };
  const removeEquipment = async (item: Equipment) => {
    if (!session || !canDelete || mutationRef.current || saving) return;
    mutationRef.current = true;
    try {
      if (!await confirm({
        title: 'Delete equipment?', message: `Delete ${item.Name}? All of its reservations will also be removed.`,
        confirmLabel: 'Delete equipment', destructive: true,
      })) return;
      setSaving(true);
      setError('');
      await Promise.all([
        client.cancelQueries({ queryKey: ['equipment', session.email] }),
        client.cancelQueries({ queryKey: bookingsKey }),
      ]);
      await deleteEquipment(item.ID, session);
      client.setQueryData<Equipment[]>(['equipment', session.email], (previous) => previous?.filter((entry) => entry.ID !== item.ID));
      setBookings((previous) => previous.filter((booking) => booking.EquipmentID !== item.ID));
      setSelectedId(null);
      setEquipmentEditor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      mutationRef.current = false;
      setSaving(false);
    }
  };
  const cancel = async (id: number) => {
    const booking = bookings.find((entry) => entry.ID === id);
    if (!session || !booking || !canManageReservation(session, booking) || mutationRef.current || saving) return;
    mutationRef.current = true;
    try {
      if (!await confirm({
        title: 'Cancel booking?',
        message: 'Cancel this booking? The reserved time will become available to others.',
        confirmLabel: 'Cancel booking',
        cancelLabel: 'Keep booking',
        destructive: true,
      })) return;
      setSaving(true);
      setError('');
      await client.cancelQueries({ queryKey: bookingsKey });
      await cancelBooking(id, session);
      setBookings((previous) => previous.filter((booking) => booking.ID !== id));
      if (editingBooking?.ID === id) { setEditingBooking(undefined); setPanelVersion((version) => version + 1); }
      if (viewingBookingId === id) { setViewingBookingId(null); setSelectedId(null); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      mutationRef.current = false;
      setSaving(false);
    }
  };

  const bookingsByEquipment = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (const booking of bookings) map.set(booking.EquipmentID, [...(map.get(booking.EquipmentID) ?? []), booking]);
    return map;
  }, [bookings]);
  const visible = equipment.filter((eq) => {
    if (category && eq.Category !== category) return false;
    if (availableNow) {
      const { open, close } = equipmentHours(eq);
      if (!bookingsQuery.data || eq.Status !== 'ACTIVE' || now.getHours() < open || now.getHours() >= close ||
        (bookingsByEquipment.get(eq.ID) ?? []).some((booking) => new Date(booking.Start) <= now && new Date(booking.End) > now)) return false;
    }
    const q = query.trim().toLowerCase();
    return !q || [eq.Name, eq.Location, eq.Category].some((text) => text.toLowerCase().includes(q));
  });
  const upcoming = bookings.filter((booking) => booking.Mine && new Date(booking.End) > now)
    .sort((a, b) => a.Start.localeCompare(b.Start));
  const allBookings = bookings.filter((booking) => new Date(booking.End) > now)
    .sort((a, b) => a.Start.localeCompare(b.Start));
  const listedBookings = view === 'all' ? allBookings : upcoming;
  const days = weekDates(now);
  const day = startOfDay(scheduleDate);
  const filtering = !!query.trim() || category !== null || availableNow;

  if (!auth.data?.loggedIn || auth.data.disabled) return null;

  return (
    <Workspace onBeforeLeave={() => !saving}>
      <BookingFilters open={sidebarOpen} onToggleOpen={() => setSidebarOpen((open) => !open)} equipment={equipment} category={category} onCategory={setCategory} availableNow={availableNow} onAvailableNow={() => setAvailableNow((value) => !value)} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-950">
        <header className="shrink-0 border-b border-slate-800 px-4 pt-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold">Equipment bookings</h1>
            {canAdd && <button disabled={saving} onClick={() => setEquipmentEditor('new')} className="ui-button-primary"><Plus className="h-4 w-4" />Add equipment</button>}
          </div>
          <nav aria-label="Booking views" className="mt-5 flex flex-wrap gap-5">
            <button aria-current={view === 'schedule' ? 'page' : undefined} onClick={() => setView('schedule')} className={`border-b-2 pb-3 text-sm font-medium ${view === 'schedule' ? 'border-white text-slate-100' : 'border-transparent text-slate-500'}`}>Schedule</button>
            <button aria-current={view === 'mine' ? 'page' : undefined} onClick={() => setView('mine')} className={`border-b-2 pb-3 text-sm font-medium ${view === 'mine' ? 'border-white text-slate-100' : 'border-transparent text-slate-500'}`}>My bookings {bookingsQuery.data && <span className="ml-1 text-xs text-slate-500">({upcoming.length})</span>}</button>
            {canViewAll && <button aria-current={view === 'all' ? 'page' : undefined} onClick={() => setView('all')} className={`border-b-2 pb-3 text-sm font-medium ${view === 'all' ? 'border-white text-slate-100' : 'border-transparent text-slate-500'}`}>All bookings {bookingsQuery.data && <span className="ml-1 text-xs text-slate-500">({allBookings.length})</span>}</button>}
          </nav>
        </header>
        {loadError && <ErrorBanner message={loadError.message} onRetry={retry} retrying={retrying} />}
        {error && !selected && !editor && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {view === 'schedule' && <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <section aria-label="Choose a booking day" className="grid w-full max-w-md grid-cols-7 gap-1">
                {days.map((date) => {
                  const value = toDateInput(date);
                  const active = value === scheduleDate;
                  return (
                    <button key={value} aria-label={date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} aria-pressed={active} onClick={() => changeScheduleDate(value)} className={`rounded-sm px-1 py-1.5 text-center ${active ? 'bg-white text-slate-950' : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800'}`}>
                      <span className="block text-[10px]">{sameDay(date, now) ? 'Today' : date.toLocaleDateString([], { weekday: 'short' })}</span>
                      <span className="block text-sm font-medium">{date.getDate()}</span>
                    </button>
                  );
                })}
              </section>
              <div className="w-full sm:w-60"><SearchInput value={query} onChange={setQuery} placeholder="Search equipment" label="Search equipment" /></div>
            </div>
            <div className="mb-3 flex justify-end text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="h-3 w-5 bg-slate-700" />Free</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-5 bg-rose-500/80" />Booked</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-5 bg-emerald-500/80" />Your booking</span>
              </div>
            </div>
          </>}
          {loading ? <BookingSkeleton view={view} />
            : loadError && equipment.length === 0 ? <div className="ui-empty-state"><p>Equipment could not be loaded.</p></div>
            : view === 'mine' || view === 'all' ? (
              <section aria-label={view === 'all' ? 'All bookings' : 'Your upcoming bookings'}>
                {!bookingsQuery.data ? <p className="text-sm text-slate-400">{view === 'all' ? 'Bookings' : 'Your bookings'} could not be loaded. Try again above.</p>
                  : listedBookings.length === 0 ? <div className="ui-empty-state"><CalendarDays className="mb-2 h-6 w-6" /><p>{view === 'all' ? 'No current or upcoming bookings.' : 'No upcoming reservations yet.'}</p><button onClick={() => setView('schedule')} className="ui-button-secondary mt-2">View schedule</button></div>
                  : <ul className="divide-y divide-slate-800">
                    {listedBookings.map((booking) => {
                      const eq = equipment.find((item) => item.ID === booking.EquipmentID);
                      const start = new Date(booking.Start);
                      const end = new Date(booking.End);
                      const manageable = canManageReservation(auth.data, booking) && end > now;
                      const editable = manageable && eq?.Status === 'ACTIVE' && start > now;
                      const bookingLabel = view === 'all' ? `${booking.Mine ? 'you' : booking.UserName} on ${eq?.Name ?? 'equipment'}` : eq?.Name ?? 'equipment';
                      return (
                        <li key={booking.ID} className="flex flex-wrap items-center gap-3 py-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{eq?.Name ?? 'Equipment'}</p>
                            {view === 'all' && <p className="mt-1 text-sm text-slate-300">{booking.Mine ? 'You' : booking.UserName} · <span className="text-xs text-slate-400">{start <= now ? 'In progress' : 'Upcoming'}</span></p>}
                            <p className="mt-1 text-xs text-slate-400">{fmtDay(start, now)} · {fmtTime(start)} – {!sameDay(start, end) && `${fmtDay(end, now)} · `}{fmtTime(end)}</p>
                            <p className="mt-1 text-xs text-slate-500">{eq?.Location}{booking.Purpose ? ` · ${booking.Purpose}` : ''}</p>
                          </div>
                          {eq && <button disabled={saving} onClick={() => editable ? editReservation(booking) : viewReservation(booking)} className="ui-icon-button" aria-label={`${editable ? 'Edit' : 'View'} booking for ${bookingLabel}`}><Pencil className="h-4 w-4" /></button>}
                          {manageable && <button aria-label={`Cancel booking for ${bookingLabel}`} disabled={saving} onClick={() => void cancel(booking.ID)} className="ui-button-secondary hover:!text-rose-300"><Trash2 className="h-4 w-4" />Cancel</button>}
                        </li>
                      );
                    })}
                  </ul>}
              </section>
            ) : visible.length === 0 ? (
              <div className="ui-empty-state">
                <p>{equipment.length === 0 ? 'No equipment yet.' : 'No equipment matches your filters.'}</p>
                {filtering && <button onClick={() => { setQuery(''); setCategory(null); setAvailableNow(false); }} className="text-slate-200 hover:text-white">Clear filters</button>}
              </div>
            ) : <BookingSchedule equipment={visible} bookings={bookingsByEquipment} day={day} now={now} selectedId={editor && editor !== 'new' ? editor.ID : selectedId} loaded={bookingsQuery.data !== undefined} onSelect={(id, hour, duration) => selectEquipment(id, hour, undefined, duration)} onSelectBooking={viewReservation} onSelectEquipment={canManageEquipment ? viewEquipment : undefined} />}
        </div>
      </main>
      <DetailPanel label={editor ? editor === 'new' ? 'Add bookable equipment' : canModify ? 'Edit bookable equipment' : 'Bookable equipment' : viewingBooking ? 'Reservation details' : 'Equipment details'} open={!!editor || (!!selected && (viewingBookingId === null || !!viewingBooking))}>
        {editor ? <EquipmentEditor key={editor === 'new' ? 'new' : editor.ID} equipment={editor === 'new' ? null : editor} categories={[...new Set(equipment.map((item) => item.Category))]} onSave={saveEquipment} onClose={() => { if (!saving) setEquipmentEditor(null); }} onSavingChange={setSaving} readOnly={editor !== 'new' && !canModify} busy={saving} errorMessage={error} onDelete={editor !== 'new' && canDelete ? () => void removeEquipment(editor) : undefined} />
          : selected && viewingBooking ? <ReservationDetails equipment={selected} booking={viewingBooking} auth={session!} now={now} busy={saving} error={error} onDismissError={() => setError('')} onClose={() => selectEquipment(null)} onEdit={() => editReservation(viewingBooking)} onCancel={() => void cancel(viewingBooking.ID)} />
          : selected && <BookingPanel key={`${selected.ID}-${panelVersion}`} equipment={selected} initialDate={scheduleDate} initialHour={initialHour} initialDuration={initialDuration} bookings={bookingsByEquipment.get(selected.ID) ?? []} now={now} onClose={() => selectEquipment(null)} onBook={book} onCancel={cancel} onSavingChange={setSaving} error={error} onDismissError={() => setError('')} bookingsLoaded={bookingsQuery.data !== undefined} auth={session!} initialBooking={editingBooking} onUpdate={updateReservation} busy={saving} />}
      </DetailPanel>
    </Workspace>
  );
};
