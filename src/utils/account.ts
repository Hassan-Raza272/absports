import { Club, Match, User } from '../types';

export function startOfLocalDay(value: number | Date): number {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfLocalDay(value: number | Date): number {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function formatGoLiveDay(value: number): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function isSignedIn(user: User | null | undefined): user is User {
  return !!user;
}

/** Any signed-in account can score matches and create tournaments. */
export function canOrganise(user: User | null | undefined): user is User {
  return !!user;
}

export function isSuperAdmin(user: User | null | undefined): boolean {
  return user?.role === 'superadmin';
}

/** Emails containing "admin" are treated as super admins (must also be stored in RTDB). */
export function emailLooksLikeSuperAdmin(email?: string | null): boolean {
  return !!(email && email.toLowerCase().includes('admin'));
}

export type GoLiveWindowStatus = 'always' | 'active' | 'upcoming' | 'expired' | 'none';

export function goLiveWindowStatus(user: User | null | undefined, now = Date.now()): GoLiveWindowStatus {
  if (!user) return 'none';
  if (user.role === 'superadmin') return 'always';
  const startAt = user.goLiveAccess?.startAt;
  const endAt = user.goLiveAccess?.endAt;
  if (startAt == null || endAt == null) return 'none';
  if (now < startOfLocalDay(startAt)) return 'upcoming';
  if (now > endOfLocalDay(endAt)) return 'expired';
  return 'active';
}

/** Super admin always can. Everyone else needs a date window that includes today. */
export function canUserGoLive(user: User | null | undefined, now = Date.now()): boolean {
  const status = goLiveWindowStatus(user, now);
  return status === 'always' || status === 'active';
}

/**
 * True only for the account that created / started this match.
 * Used to show Go Live — club staff on someone else's match do not qualify.
 */
export function isMatchStarter(
  user: User | null | undefined,
  match: Match | null | undefined,
): boolean {
  if (!user || !match) return false;
  return !!match.createdBy && match.createdBy === user.id;
}

/** Match belongs to this user (or legacy club staff if createdBy is missing). */
export function isUsersOwnMatch(
  user: User | null | undefined,
  match: Match | null | undefined,
  clubs: Club[] = [],
): boolean {
  if (!user || !match) return false;
  if (user.role === 'superadmin') return true;
  if (match.createdBy) return match.createdBy === user.id;
  const club = clubs.find(c => c.id === match.clubId);
  if (club) return isClubStaff(user, club);
  return (
    (user.clubIds || []).includes(match.clubId) ||
    user.currentClubId === match.clubId
  );
}

/**
 * Go Live button / stream: must have access AND be the match starter.
 * Super admins always have access and may go live on any match.
 */
export function canUserGoLiveOnMatch(
  user: User | null | undefined,
  match: Match | null | undefined,
  _clubs: Club[] = [],
  now = Date.now(),
): boolean {
  if (!user || !match) return false;
  if (!canUserGoLive(user, now)) return false;
  if (user.role === 'superadmin') return true;
  return isMatchStarter(user, match);
}

export function goLiveWindowLabel(user: User | null | undefined, now = Date.now()): string {
  const status = goLiveWindowStatus(user, now);
  if (status === 'always') return 'Always on';
  const startAt = user?.goLiveAccess?.startAt;
  const endAt = user?.goLiveAccess?.endAt;
  if (startAt == null || endAt == null || status === 'none') return 'No access';
  if (status === 'upcoming') return `Starts ${formatGoLiveDay(startAt)}`;
  if (status === 'expired') return `Ended ${formatGoLiveDay(endAt)}`;
  return `${formatGoLiveDay(startAt)} – ${formatGoLiveDay(endAt)}`;
}

export function goLiveDeniedMessage(
  user: User | null | undefined,
  match?: Match | null,
  clubs: Club[] = [],
): string {
  if (match && canUserGoLive(user) && user?.role !== 'superadmin' && !isMatchStarter(user, match)) {
    return 'Go Live is only for the user who started this match, and only while your access dates are active.';
  }
  if (match && canUserGoLive(user) && !isUsersOwnMatch(user, match, clubs)) {
    return 'You can only go live on matches you created — not other users\' matches.';
  }
  const status = goLiveWindowStatus(user);
  if (status === 'upcoming' && user?.goLiveAccess?.startAt) {
    return `Go Live access starts on ${formatGoLiveDay(user.goLiveAccess.startAt)}.`;
  }
  if (status === 'expired' && user?.goLiveAccess?.endAt) {
    return `Go Live access ended on ${formatGoLiveDay(user.goLiveAccess.endAt)}. Ask a super admin to extend the dates.`;
  }
  return 'Ask a super admin to grant Go Live access with a start and end date. Then start your own match to stream.';
}

export function isClubStaff(user: User | null | undefined, club?: Club | null) {
  if (!user || !club) return false;
  const email = user.email?.toLowerCase();
  return (
    user.role === 'superadmin' ||
    club.ownerId === user.id ||
    (club.adminIds || []).includes(user.id) ||
    (!!email && (club.adminEmails || []).includes(email)) ||
    (user.clubIds || []).includes(club.id)
  );
}

export function userClubs(user: User | null | undefined, clubs: Club[]) {
  if (!user) return [];
  return clubs.filter(club => isClubStaff(user, club));
}

export function requireAccount(
  user: User | null | undefined,
  navigation: { navigate: (name: string) => void },
  action = 'continue',
) {
  if (user) return true;
  navigation.navigate('Login');
  return false;
}
