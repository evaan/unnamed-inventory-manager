import { useRef, useState } from 'react';
import { Activity, CircuitBoard, MapPin, Printer, ScanLine, Wrench } from 'lucide-react';
import type { Booking, Equipment } from './bookingsapi';
import { bookingError, equipmentHours, formatEquipmentHours, freeHours, hourToTime, MAX_HOURS, overlaps, pad, SLOT_HOURS } from './bookingTime';
import { iconFor } from './equipmentIcons';

export const CategoryIcon = ({ category, icon, className }: { category: string; icon?: string; className?: string }) => {
  const Icon = iconFor(icon) ?? (category === '3D printers' ? Printer
    : category === 'Soldering' ? CircuitBoard
    : category === 'Test equipment' ? Activity
    : category === 'Fabrication' ? ScanLine : Wrench);
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
  onSelectBooking: (booking: Booking) => void;
  onSelectEquipment?: (id: number) => void;
}

const hours = Array.from({ length: 24 }, (_, i) => i);
const slots = Array.from({ length: 24 / SLOT_HOURS }, (_, i) => i * SLOT_HOURS);

interface Selection {
  equipmentId: number;
  anchor: number;
  end: number;
  pointerId: number;
}

export const BookingSchedule = ({ equipment, bookings, day, now, selectedId, loaded, onSelect, onSelectBooking, onSelectEquipment }: Props) => {
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
        const available = new Set(freeHours(day, equipmentBookings, now, eq));
        const { open, close } = equipmentHours(eq);
        const maintenance = eq.Status === 'MAINTENANCE';
        const selectedRange = selection?.equipmentId === eq.ID ? {
          start: Math.min(selection.anchor, selection.end),
          end: Math.max(selection.anchor, selection.end) + SLOT_HOURS,
        } : null;
        const cells = slots.map((hour) => {
          const start = new Date(day);
          start.setHours(0, hour * 60, 0, 0);
          const end = new Date(start);
          end.setMinutes(end.getMinutes() + SLOT_HOURS * 60);
          return { hour, booking: equipmentBookings.find((b) => overlaps(start, end, new Date(b.Start), new Date(b.End))) };
        });
        return (
          <div key={eq.ID} className="flex border-b border-slate-800 last:border-b-0">
            <button
              onClick={() => onSelectEquipment?.(eq.ID)}
              disabled={!onSelectEquipment}
              aria-label={`Equipment: ${eq.Name}`}
              aria-pressed={selectedId === eq.ID}
              className={`sticky left-0 z-10 flex w-52 shrink-0 items-center gap-2.5 border-r border-slate-800 px-3 py-2.5 text-left enabled:hover:bg-slate-800 disabled:cursor-default ${selectedId === eq.ID ? 'bg-slate-800' : 'bg-slate-900'}`}
            >
              <CategoryIcon category={eq.Category} icon={eq.Icon} className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{eq.Name}</span>
                <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                  <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{eq.Location}</span>
                </span>
                <span className="mt-1 block text-[10px] text-slate-400">{maintenance ? 'Out of service' : formatEquipmentHours(eq)}</span>
              </span>
            </button>
            <div
              className="grid flex-1 touch-pan-y select-none grid-cols-[repeat(48,minmax(0,1fr))] gap-1 p-1"
              onPointerMove={(event) => {
                const active = drag.current;
                if (!active || active.equipmentId !== eq.ID || active.pointerId !== event.pointerId) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (!rect.width) return;
                const target = Math.max(0, Math.min(slots.length - 1, Math.floor(((event.clientX - rect.left) / rect.width) * slots.length))) * SLOT_HOURS;
                const direction = target >= active.anchor ? 1 : -1;
                let end = active.anchor;
                for (let hour = active.anchor; direction > 0 ? hour <= target : hour >= target; hour += direction * SLOT_HOURS) {
                  if (!available.has(hour) || Math.abs(hour - active.anchor) >= MAX_HOURS) break;
                  const start = new Date(day);
                  start.setHours(0, Math.min(active.anchor, hour) * 60, 0, 0);
                  const finish = new Date(day);
                  finish.setHours(0, (Math.max(active.anchor, hour) + SLOT_HOURS) * 60, 0, 0);
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
                onSelect(eq.ID, Math.min(active.anchor, active.end), Math.abs(active.end - active.anchor) + SLOT_HOURS);
              }}
              onPointerCancel={clearSelection}
              onLostPointerCapture={clearSelection}
            >
              {cells.map(({ hour, booking }, index) => {
                // Merge only cells belonging to the same reservation, not adjacent bookings.
                if (booking && cells[index - 1]?.booking?.ID === booking.ID) return null;
                let span = 1;
                if (booking) {
                  while (cells[index + span]?.booking?.ID === booking.ID) span++;
                }
                const endHour = hour + span * SLOT_HOURS;
                const closed = maintenance || hour < open || hour >= close;
                const free = !closed && loaded && available.has(hour);
                const status = !loaded ? 'Loading' : booking ? booking.Mine ? 'Your booking' : 'Booked' : closed ? 'Unavailable' : free ? 'Available' : 'Past';
                const highlighted = !!selectedRange && hour >= selectedRange.start && hour < selectedRange.end;
                const color = !loaded ? 'bg-slate-900/40 opacity-40'
                  : booking ? booking.Mine ? 'bg-emerald-500/80' : 'bg-rose-500/80'
                  : closed ? 'bg-slate-900/40 opacity-40'
                  : free ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-800/40 opacity-40';
                return (
                  <button
                    key={hour}
                    disabled={!loaded || (!free && !booking)}
                    onPointerDown={(event) => {
                      if (event.button !== 0 || event.isPrimary === false) return;
                      suppressClick.current = false;
                      if (!free) return;
                      const active = { equipmentId: eq.ID, anchor: hour, end: hour, pointerId: event.pointerId };
                      drag.current = active;
                      setSelection(active);
                      event.currentTarget.parentElement?.setPointerCapture?.(event.pointerId);
                    }}
                    onClick={(event) => {
                      if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
                      if (booking) { onSelectBooking(booking); return; }
                      onSelect(eq.ID, hour, SLOT_HOURS);
                    }}
                    aria-label={`${eq.Name} ${booking ? `from ${hourToTime(hour)} to ${hourToTime(endHour)}` : `at ${hourToTime(hour)}`}: ${status}`}
                    title={`${hourToTime(hour)}–${hourToTime(endHour)} · ${status}`}
                    aria-pressed={highlighted}
                    style={{ gridColumn: `${index + 1} / span ${span}`, gridRow: 1 }}
                    className={`booking-hour my-2 h-11 rounded-md transition-colors ${booking ? 'enabled:cursor-pointer hover:brightness-110' : 'enabled:cursor-crosshair'} disabled:cursor-default ${color} ${highlighted ? 'opacity-0' : ''}`}
                  />
                );
              })}
              {selectedRange && <div
                role="status"
                aria-label={`New reservation from ${hourToTime(selectedRange.start)} to ${hourToTime(selectedRange.end)}`}
                style={{ gridColumn: `${selectedRange.start / SLOT_HOURS + 1} / span ${(selectedRange.end - selectedRange.start) / SLOT_HOURS}`, gridRow: 1 }}
                className="pointer-events-none z-10 my-2 flex h-11 items-center justify-center overflow-hidden rounded-md bg-slate-500 px-1 text-xs font-medium text-white ring-1 ring-inset ring-slate-300/40"
              >
                <span className="truncate">{hourToTime(selectedRange.start)}–{hourToTime(selectedRange.end)}</span>
              </div>}
            </div>
          </div>
        );
      })}
    </div>
  </div>
  );
};
