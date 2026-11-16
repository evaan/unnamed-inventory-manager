import { CalendarClock, Package, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export const PageNavigation = () => (
  <nav
    aria-label="Main navigation"
    className="inline-flex items-center gap-1 shrink-0 rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-inner"
  >
    {[
      { to: '/app', label: 'Inventory', icon: Package },
      { to: '/app/bookings', label: 'Bookings', icon: CalendarClock },
      { to: '/app/settings', label: 'Settings', icon: Settings },
    ].map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        end={to !== '/app/settings'}
        className={({ isActive }) =>
          `flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
            isActive
              ? 'bg-blue-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`
        }
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </NavLink>
    ))}
  </nav>
);
