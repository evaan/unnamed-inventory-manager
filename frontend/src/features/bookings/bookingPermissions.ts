import { hasPermission, type AuthState } from '../auth/auth';
import type { Booking } from './bookingsapi';

export const canManageReservation = (auth: AuthState | undefined, booking: Booking) =>
  !!(auth?.loggedIn && !auth.disabled && (booking.Mine || hasPermission(auth, 'BookingManage')));
