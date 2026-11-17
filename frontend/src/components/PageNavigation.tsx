import { CalendarClock, Package, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export const PageNavigation = () => (
  <nav
    aria-label="Main navigation"
    className="flex w-full items-center gap-6 sm:w-auto sm:gap-8"
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
          `flex flex-1 items-center justify-center gap-2 border-b-2 px-1.5 py-2 text-sm font-medium transition-colors sm:flex-none ${
             isActive
               ? 'border-white text-white'
               : 'border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-200'
          }`
        }
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </NavLink>
    ))}
  </nav>
);
