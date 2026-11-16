import type { ReactNode } from 'react';

export const AuthPageShell = ({ children, background }: {
  children: ReactNode;
  background?: ReactNode;
}) => (
  <main className="relative isolate flex min-h-dvh w-full items-center justify-center overflow-hidden bg-slate-950 p-4">
    {background}
    <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-6 text-center shadow-2xl sm:p-8">
      {children}
    </div>
  </main>
);
