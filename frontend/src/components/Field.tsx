import type { ReactNode } from 'react';

export const Field = ({ label, required = false, className = '', children }: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <label className={`block ${className}`}>
    <span className="mb-1 block text-xs font-medium text-slate-400">
      {label}{required && <span aria-hidden="true" className="ml-1 text-rose-300 after:content-['*']" />}
    </span>
    {children}
  </label>
);
