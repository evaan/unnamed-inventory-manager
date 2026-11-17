import { MapPin, Pencil, Trash2, X } from 'lucide-react';
import { ErrorBanner } from '../../components/ErrorBanner';
import type { AuthState } from '../auth/auth';
import { canManageReservation } from './bookingPermissions';
import type { Booking, Equipment } from './bookingsapi';
import { fmtTime } from './bookingTime';

interface Props {
  equipment: Equipment;
  booking: Booking;
  auth: AuthState;
  now: Date;
  busy: boolean;
  error: string;
  onDismissError: () => void;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

const formatDate = (date: Date) => date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

export const ReservationDetails = ({ equipment, booking, auth, now, busy, error, onDismissError, onClose, onEdit, onCancel }: Props) => {
  const start = new Date(booking.Start);
  const end = new Date(booking.End);
  const duration = (end.getTime() - start.getTime()) / 3600_000;
  const manageable = canManageReservation(auth, booking) && end > now;
  const editable = manageable && equipment.Status === 'ACTIVE' && start > now;
  const status = end <= now ? 'Ended' : start <= now ? 'In progress' : 'Upcoming';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{equipment.Name}</h2>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><MapPin className="h-3 w-3" />{equipment.Location}</p>
        </div>
        <button onClick={onClose} disabled={busy} aria-label="Close reservation details" className="ui-icon-button -mr-1.5"><X className="h-4 w-4" /></button>
      </div>
      {error && <ErrorBanner message={error} onDismiss={onDismissError} />}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div>
          <h3 className="text-sm font-medium">Reservation details</h3>
          <p className={`mt-1 text-xs ${booking.Mine ? 'text-emerald-300' : 'text-rose-300'}`}>{booking.Mine ? 'Your booking' : 'Booked'} · {status}</p>
        </div>
        <dl className="space-y-4 text-sm">
          <div><dt className="text-xs text-slate-400">Reserved by</dt><dd className="mt-1">{booking.Mine ? 'You' : booking.UserName}</dd></div>
          <div><dt className="text-xs text-slate-400">Starts</dt><dd className="mt-1">{formatDate(start)} · {fmtTime(start)}</dd></div>
          <div><dt className="text-xs text-slate-400">Ends</dt><dd className="mt-1">{formatDate(end)} · {fmtTime(end)}</dd></div>
          <div><dt className="text-xs text-slate-400">Duration</dt><dd className="mt-1">{duration < 1 ? `${duration * 60} minutes` : `${duration} ${duration === 1 ? 'hour' : 'hours'}`}</dd></div>
          <div><dt className="text-xs text-slate-400">Purpose</dt><dd className="mt-1 whitespace-pre-wrap break-words">{booking.Purpose || 'No purpose provided.'}</dd></div>
        </dl>
        {manageable && <div className="flex flex-wrap gap-2">
          {editable && <button disabled={busy} onClick={onEdit} className="ui-button-secondary"><Pencil className="h-4 w-4" />Edit reservation</button>}
          <button disabled={busy} onClick={onCancel} className="ui-button-secondary hover:!text-rose-300"><Trash2 className="h-4 w-4" />Cancel booking</button>
        </div>}
      </div>
    </div>
  );
};
