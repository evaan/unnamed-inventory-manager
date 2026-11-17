export const ListSkeleton = ({ label, equipment = false }: { label: string; equipment?: boolean }) => (
  <div role="status" aria-label={label} aria-busy="true">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="divide-y divide-slate-800/80 motion-safe:animate-pulse">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-6 py-3.5 border-l-2 border-transparent">
          {equipment && <div className="h-5 w-5 rounded bg-slate-800 shrink-0" />}
          <div className="min-w-0 flex-1 space-y-2">
            <div className={`h-4 max-w-full rounded bg-slate-800 ${index % 2 === 0 ? 'w-40' : 'w-52'}`} />
            <div className="h-3 w-28 max-w-full rounded bg-slate-800/60" />
            {equipment && <div className="h-3 w-44 max-w-full rounded bg-slate-800/60" />}
          </div>
          <div className="h-5 w-20 rounded-full bg-slate-800 shrink-0" />
        </div>
      ))}
    </div>
  </div>
);
