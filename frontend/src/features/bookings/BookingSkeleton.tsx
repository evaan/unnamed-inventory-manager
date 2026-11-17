import { pad } from './bookingTime';

export const BookingSkeleton = ({ view }: { view: 'schedule' | 'mine' | 'all' }) => {
  const label = view === 'schedule' ? 'Loading booking schedule' : view === 'all' ? 'Loading all bookings' : 'Loading your bookings';

  return (
    <div role="status" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}</span>
      {view === 'schedule' ? (
        <div aria-hidden="true" className="overflow-x-auto rounded-lg border border-slate-800">
          <div className="min-w-[1560px]">
            <div className="flex border-b border-slate-800 bg-slate-900 text-[10px] text-slate-400">
              <div className="sticky left-0 z-10 w-52 shrink-0 bg-slate-900 px-4 py-3 text-xs font-medium">Equipment</div>
              <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] py-3">
                {Array.from({ length: 24 }, (_, hour) => <span key={hour} className="text-center tabular-nums">{pad(hour)}:00</span>)}
              </div>
            </div>
            <div className="motion-safe:animate-pulse">
              {Array.from({ length: 6 }, (_, row) => (
                <div key={row} className="flex border-b border-slate-800 last:border-b-0">
                  <div className="sticky left-0 z-10 flex w-52 shrink-0 items-center gap-2.5 border-r border-slate-800 bg-slate-900 px-3 py-2.5">
                    <div className="h-4 w-4 shrink-0 rounded bg-slate-800" />
                    <div className="flex-1 space-y-2">
                      <div className={`h-4 rounded bg-slate-800 ${row % 2 === 0 ? 'w-28' : 'w-32'}`} />
                      <div className="h-2.5 w-24 rounded bg-slate-800/60" />
                      <div className="h-2.5 w-16 rounded bg-slate-800/60" />
                    </div>
                  </div>
                  <div className="grid flex-1 grid-cols-[repeat(48,minmax(0,1fr))] gap-1 p-1">
                    {Array.from({ length: 48 }, (_, slot) => <div key={slot} className="my-2 h-11 rounded-md bg-slate-800/60" />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div aria-hidden="true" className="divide-y divide-slate-800 motion-safe:animate-pulse">
          {Array.from({ length: 6 }, (_, row) => (
            <div key={row} className="flex items-center gap-3 py-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className={`h-4 max-w-full rounded bg-slate-800 ${row % 2 === 0 ? 'w-40' : 'w-52'}`} />
                <div className="h-3 w-44 max-w-full rounded bg-slate-800/60" />
                <div className="h-3 w-32 max-w-full rounded bg-slate-800/60" />
              </div>
              <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-800/60" />
              <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-800/60" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
