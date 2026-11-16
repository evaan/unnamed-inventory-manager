import { useRef, useState } from 'react';
import { Activity, CircuitBoard, MapPin, Printer, ScanLine, Wrench } from 'lucide-react';
import type { Booking, Equipment } from './bookingsapi';
import { bookingError, equipmentHours, freeHours, MAX_HOURS, overlaps, pad } from './bookingTime';

export const CategoryIcon = ({ category, className }: { category: string; className?: string }) => {
  const Icon = category === '3D printers' ? Printer
    : category === 'Soldering' ? CircuitBoard
    : category === 'Test equipment' ? Activity
    : category === 'Fabrication' ? ScanLine : Wrench;
  return <Icon className={className} aria-hidden="true" />;
};

interface Props {
  equipment: Equipment[];
  bookings: Map<number, Booking[]>;
  day: Date;
  now: Date;
  selectedId: number | null;
  loaded: boolean;
  onSelect: (id: number, hour?: number, duration?: number) => void;
}

const hours = Array.from({ length: 24 }, (_, i) => i);

interface Selection {
  equipmentId: number;
  anchor: number;
  end: number;
  pointerId: number;
}

export const BookingSchedule = ({ equipment, bookings, day, now, selectedId, loaded, onSelect }: Props) => {
  const [selection, setSelection] = useState<Selection | null>(null);
  const drag = useRef<Selection | null>(null);
  const suppressClick = useRef(false);
  const clearSelection = () => { drag.current = null; setSelection(null); };

  return (
  <div className="overflow-x-auto rounded-lg border border-slate-800">
    <div className="min-w-[1560px]">
      <div className="flex border-b border-slate-800 bg-slate-900 text-[10px] text-slate-400">
        <div className="sticky left-0 z-10 w-52 shrink-0 bg-slate-900 px-4 py-3 text-xs font-medium">Equipment</div>
        <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] py-3">
          {hours.map((hour) => <span key={hour} className="text-center tabular-nums">{pad(hour)}:00</span>)}
        </div>
      </div>
      {equipment.map((eq) => {
        const equipmentBookings = bookings.get(eq.ID) ?? [];
        const available = new Set(freeHours(day, equipmentBookings, now, eq.Category));
        const { open, close } = equipmentHours(eq.Category);
        const maintenance = eq.Status === 'MAINTENANCE';
        return (
          <div key={eq.ID} className="flex border-b border-slate-800 last:border-b-0">
            <button
              onClick={() => onSelect(eq.ID)}
              aria-label={`Equipment: ${eq.Name}`}
              aria-pressed={selectedId === eq.ID}
              className={`sticky left-0 z-10 flex w-52 shrink-0 items-center gap-2.5 border-r border-slate-800 px-3 py-2.5 text-left hover:bg-slate-800 ${selectedId === eq.ID ? 'bg-slate-800' : 'bg-slate-900'}`}
            >
              <CategoryIcon category={eq.Category} className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{eq.Name}</span>
                <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                  <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{eq.Location}</span>
                </span>
                <span className="mt-1 block text-[10px] text-slate-400">{maintenance ? 'Out of service' : close === 24 ? '24/7' : '08:00–20:00'}</span>
              </span>
            </button>
            <div
              className="grid flex-1 touch-pan-y select-none grid-cols-[repeat(24,minmax(0,1fr))] gap-1 p-1"
              onPointerMove={(event) => {
                const active = drag.current;
                if (!active || active.equipmentId !== eq.ID || active.pointerId !== event.pointerId) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (!rect.width) return;
                const target = Math.max(0, Math.min(23, Math.floor(((event.clientX - rect.left) / rect.width) * 24)));
                const direction = target >= active.anchor ? 1 : -1;
                let end = active.anchor;
                for (let hour = active.anchor; direction > 0 ? hour <= target : hour >= target; hour += direction) {
                  if (!available.has(hour) || Math.abs(hour - active.anchor) >= MAX_HOURS) break;
                  const start = new Date(day);
                  start.setHours(Math.min(active.anchor, hour), 0, 0, 0);
                  const finish = new Date(day);
                  finish.setHours(Math.max(active.anchor, hour) + 1, 0, 0, 0);
                  if (bookingError(eq, equipmentBookings, start, finish, now)) break;
                  end = hour;
                }
                drag.current = { ...active, end };
                setSelection(drag.current);
              }}
              onPointerUp={(event) => {
                const active = drag.current;
                if (!active || active.equipmentId !== eq.ID || active.pointerId !== event.pointerId) return;
                suppressClick.current = true;
                clearSelection();
                if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                onSelect(eq.ID, Math.min(active.anchor, active.end), Math.abs(active.end - active.anchor) + 1);
              }}
              onPointerCancel={clearSelection}
              onLostPointerCapture={clearSelection}
            >
              {hours.map((hour) => {
                const start = new Date(day);
                start.setHours(hour, 0, 0, 0);
                const end = new Date(start);
                end.setHours(hour + 1);
                const booking = equipmentBookings.find((b) => overlaps(start, end, new Date(b.Start), new Date(b.End)));
                const closed = maintenance || hour < open || hour >= close;
                const free = !closed && loaded && available.has(hour);
                const status = !loaded ? 'Loading' : closed ? 'Unavailable' : booking ? booking.Mine ? 'Your booking' : 'Booked' : free ? 'Available' : 'Past';
                const highlighted = selection?.equipmentId === eq.ID && hour >= Math.min(selection.anchor, selection.end) && hour <= Math.max(selection.anchor, selection.end);
                const color = !loaded || closed ? 'bg-slate-900/40 opacity-40'
                  : booking ? booking.Mine ? 'bg-emerald-500/70' : 'bg-rose-500/70'
                  : free ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-800/40 opacity-40';
                return (
                  <button
                    key={hour}
                    disabled={!free}
                    onPointerDown={(event) => {
                      if (event.button !== 0 || event.isPrimary === false || !free) return;
                      suppressClick.current = false;
                      const active = { equipmentId: eq.ID, anchor: hour, end: hour, pointerId: event.pointerId };
                      drag.current = active;
                      setSelection(active);
                      event.currentTarget.parentElement?.setPointerCapture?.(event.pointerId);
                    }}
                    onClick={(event) => {
                      if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
                      onSelect(eq.ID, hour, 1);
                    }}
                    aria-label={`${eq.Name} at ${pad(hour)}:00: ${status}`}
                    title={`${pad(hour)}:00–${pad(hour + 1)}:00 · ${status}`}
                    aria-pressed={highlighted}
                    className={`booking-hour my-2 h-11 rounded-md transition-colors enabled:cursor-crosshair disabled:cursor-default ${color} ${highlighted ? '!bg-slate-500' : ''}`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </div>
  );
};
