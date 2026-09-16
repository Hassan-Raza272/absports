import {
  equalTo,
  get,
  getDatabase,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  set,
  setPersistenceEnabled,
  update,
} from '@react-native-firebase/database';
import type { DataSnapshot, Database } from '@react-native-firebase/database';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import { Team, Player, Match, Tournament, User, UserRole, Club, GoLiveAccess } from '../types';
import { resolveImageUrl } from '../services/cloudinary';
import { DEFAULT_CLUB, TOURNAMENT } from '../utils/mockData';
import { DEFAULT_CLUB_ID, DEFAULT_TOURNAMENT_ID } from '../constants/scope';
import { endOfLocalDay, startOfLocalDay, emailLooksLikeSuperAdmin } from '../utils/account';

/** Must match the Realtime Database URL in Firebase console. */
export const DATABASE_URL = 'https://ahscore-31710-default-rtdb.firebaseio.com';

// ─── Auth ───────────────────────────────────────────────────────────────────────
export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(getAuth(), email, password);

export const signUp = (email: string, password: string) =>
  createUserWithEmailAndPassword(getAuth(), email, password);

export const signOut = () => firebaseSignOut(getAuth());

export const onAuthChange = (cb: (user: any) => void) =>
  onAuthStateChanged(getAuth(), cb);

// ─── Realtime Database ──────────────────────────────────────────────────────────
let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const instance = getDatabase(undefined, DATABASE_URL);
    db = instance;
    try {
      await setPersistenceEnabled(instance, true);
    } catch {
      // Persistence must be set before the first ref; ignore if already active.
    }
    return instance;
  })();
  return initPromise;
}

function database(): Database {
  if (!db) {
    db = getDatabase(undefined, DATABASE_URL);
  }
  return db;
}

function pathRef(path: string) {
  return ref(database(), path);
}

/** Realtime Database rejects `undefined`; optional fields are omitted. */
const withoutUndefined = (value: any): any => {
  if (Array.isArray(value)) return value.filter(item => item !== undefined).map(withoutUndefined);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.entries(value).reduce<Record<string, any>>((clean, [key, item]) => {
      if (item !== undefined) clean[key] = withoutUndefined(item);
      return clean;
    }, {});
  }
  return value;
};

function readVal<T>(snap: DataSnapshot): T | null {
  if (!snap.exists()) return null;
  const value = snap.val() as T;
  if (value && typeof value === 'object') {
    return { ...(value as object), id: snap.key || '' } as T;
  }
  return value ?? null;
}

function mapChildren<T>(snap: DataSnapshot): T[] {
  if (!snap.exists()) return [];
  const rows: T[] = [];
  snap.forEach(child => {
    const value = child.val();
    if (value && typeof value === 'object') {
      rows.push({ ...(value as object), id: child.key } as T);
    }
    return undefined;
  });
  return rows;
}

async function pushNode(path: string, data: Record<string, any>) {
  const node = push(pathRef(path));
  const id = node.key;
  if (!id) throw new Error('Could not allocate a Realtime Database key.');
  await set(node, withoutUndefined({ ...data, id }));
  return { id };
}

async function mergeNode(path: string, data: Record<string, any>) {
  const clean = withoutUndefined(data);
  if (!clean || Object.keys(clean).length === 0) return;
  await update(pathRef(path), clean);
}

function listenAll<T>(path: string, cb: (rows: T[]) => void, sort?: (a: T, b: T) => number) {
  return onValue(
    pathRef(path),
    snap => {
      const rows = mapChildren<T>(snap);
      cb(sort ? [...rows].sort(sort) : rows);
    },
    error => {
      console.log(`RTDB listen ${path} failed:`, error?.message || error);
      cb([]);
    },
  );
}

function listenByChild<T>(
  path: string,
  childKey: string,
  value: string | number,
  cb: (rows: T[]) => void,
  sort?: (a: T, b: T) => number,
) {
  if (value === '' || value == null) {
    cb([]);
    return () => {};
  }
  return onValue(
    query(pathRef(path), orderByChild(childKey), equalTo(value)),
    snap => {
      const rows = mapChildren<T>(snap);
      cb(sort ? [...rows].sort(sort) : rows);
    },
    error => {
      console.log(`RTDB query ${path}/${childKey} failed:`, error?.message || error);
      cb([]);
    },
  );
}

function listenInClubIds<T>(
  path: string,
  clubIds: string[],
  cb: (rows: T[]) => void,
  sort?: (a: T, b: T) => number,
) {
  const unique = Array.from(new Set(clubIds.filter(Boolean)));
  if (unique.length === 0) {
    cb([]);
    return () => {};
  }
  const bucket: Record<string, T[]> = {};
  const emit = () => {
    const seen = new Set<string>();
    const merged = unique.flatMap(id => bucket[id] || []).filter((row: any) => {
      if (!row?.id || seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
    cb(sort ? merged.sort(sort) : merged);
  };
  const unsubs = unique.map(clubId =>
    listenByChild<T>(path, 'clubId', clubId, rows => {
      bucket[clubId] = rows;
      emit();
    }),
  );
  return () => unsubs.forEach(unsub => unsub());
}

// ─── Clubs ──────────────────────────────────────────────────────────────────────
export const listenClubs = (cb: (clubs: Club[]) => void) =>
  listenAll<Club>('clubs', cb, (a, b) => a.name.localeCompare(b.name));

// ─── Tournaments ────────────────────────────────────────────────────────────────
export const listenTournaments = (clubId: string, cb: (tournaments: Tournament[]) => void) =>
  listenByChild<Tournament>('tournaments', 'clubId', clubId, cb, (a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return a.name.localeCompare(b.name);
  });

/** Public catalog for Discover search (every competition on the platform). */
export const listenPublicTournaments = (cb: (tournaments: Tournament[]) => void) =>
  listenAll<Tournament>('tournaments', cb, (a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return a.name.localeCompare(b.name);
  });

/** Public squad catalog for Discover search. */
export const listenPublicTeams = (cb: (teams: Team[]) => void) =>
  listenAll<Team>('teams', cb, (a, b) => a.name.localeCompare(b.name));

export const createTournament = (data: Omit<Tournament, 'id'>) => pushNode('tournaments', data);

export const updateTournament = (id: string, data: Partial<Tournament>) =>
  mergeNode(`tournaments/${id}`, data);

/** Seeds a starter organisation for legacy data. AB Sports itself is the platform, not a club. */
export async function ensureDefaultClub(): Promise<{ clubId: string; tournamentId: string }> {
  await initDatabase();
  try {
    const clubSnap = await get(pathRef(`clubs/${DEFAULT_CLUB_ID}`));
    if (!clubSnap.exists()) {
      const { id: _id, ...clubData } = DEFAULT_CLUB;
      await set(pathRef(`clubs/${DEFAULT_CLUB_ID}`), withoutUndefined({
        ...clubData,
        id: DEFAULT_CLUB_ID,
        createdAt: Date.now(),
      }));
    } else {
      const data = clubSnap.val() || {};
      const staleName = String(data.name || '').toLowerCase();
      if (staleName === 'ahscore club' || staleName === 'ahscore') {
        await mergeNode(`clubs/${DEFAULT_CLUB_ID}`, {
          name: DEFAULT_CLUB.name,
          shortName: DEFAULT_CLUB.shortName,
          description: DEFAULT_CLUB.description,
        });
      }
    }

    const tournamentSnap = await get(pathRef(`tournaments/${DEFAULT_TOURNAMENT_ID}`));
    if (!tournamentSnap.exists()) {
      const { id: _tid, ...tournamentData } = TOURNAMENT;
      await set(pathRef(`tournaments/${DEFAULT_TOURNAMENT_ID}`), withoutUndefined({
        ...tournamentData,
        id: DEFAULT_TOURNAMENT_ID,
      }));
    } else {
      const data = tournamentSnap.val() || {};
      const patch: Partial<Tournament> = {};
      if (!data.clubId) patch.clubId = DEFAULT_CLUB_ID;
      if (!data.format) patch.format = 'T20';
      if (!data.type) patch.type = 'league';
      const staleTournament = String(data.name || '').toLowerCase();
      if (staleTournament === 'markhor cricket league' || staleTournament === 'mcl') {
        patch.name = TOURNAMENT.name;
        patch.venue = TOURNAMENT.venue;
      }
      if (Object.keys(patch).length > 0) {
        await mergeNode(`tournaments/${DEFAULT_TOURNAMENT_ID}`, patch);
      }
    }

    const latestClub = await get(pathRef(`clubs/${DEFAULT_CLUB_ID}`));
    const alreadyAdopted = latestClub.exists() && !!latestClub.val()?.legacyAdopted;
    if (!alreadyAdopted) {
      await adoptUnscopedData(DEFAULT_CLUB_ID, DEFAULT_TOURNAMENT_ID);
      await mergeNode(`clubs/${DEFAULT_CLUB_ID}`, { legacyAdopted: true });
    }
  } catch (error) {
    console.log('ensureDefaultClub failed:', error);
  }

  return { clubId: DEFAULT_CLUB_ID, tournamentId: DEFAULT_TOURNAMENT_ID };
}

async function adoptUnscopedData(clubId: string, tournamentId: string) {
  const stamp = async (path: string, extra?: Record<string, any>) => {
    const snap = await get(pathRef(path));
    if (!snap.exists()) return;
    const writes: Promise<any>[] = [];
    snap.forEach(child => {
      const data = child.val() || {};
      if (data.clubId || !child.key) return undefined;
      writes.push(mergeNode(`${path}/${child.key}`, { clubId, ...extra }));
      return undefined;
    });
    await Promise.all(writes);
  };

  await stamp('teams');
  await stamp('players');
  await stamp('matches', { tournamentId });
  await stamp('tournaments');
}

// ─── Teams ──────────────────────────────────────────────────────────────────────
export const listenTeams = (clubId: string, cb: (teams: Team[]) => void) =>
  listenByChild<Team>('teams', 'clubId', clubId, cb, (a, b) => a.name.localeCompare(b.name));

export const addTeam = (data: Omit<Team, 'id'>) => pushNode('teams', data);

export const updateTeam = (id: string, data: Partial<Team>) => mergeNode(`teams/${id}`, data);

export const deleteTeam = (id: string) => remove(pathRef(`teams/${id}`));

// ─── Players ────────────────────────────────────────────────────────────────────
export const listenPlayers = (clubId: string, cb: (players: Player[]) => void) =>
  listenByChild<Player>('players', 'clubId', clubId, cb, (a, b) => a.name.localeCompare(b.name));

export const addPlayer = (data: Omit<Player, 'id'>) => pushNode('players', data);

export const updatePlayer = (id: string, data: Partial<Player>) => mergeNode(`players/${id}`, data);

export const deletePlayer = (id: string) => remove(pathRef(`players/${id}`));

// ─── Matches ────────────────────────────────────────────────────────────────────
export const listenMatches = (clubId: string, cb: (matches: Match[]) => void) =>
  listenByChild<Match>('matches', 'clubId', clubId, cb, (a, b) =>
    String(a.dateTime || '').localeCompare(String(b.dateTime || '')),
  );

/** Single-match listener for Match Center / scorecard (works across clubs). */
export const listenMatch = (matchId: string, cb: (match: Match | null) => void) =>
  onValue(
    pathRef(`matches/${matchId}`),
    snap => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const val = snap.val() || {};
      cb({ ...val, id: matchId } as Match);
    },
    () => cb(null),
  );

export const listenPublicLiveMatches = (cb: (matches: Match[]) => void) =>
  onValue(
    query(pathRef('matches'), orderByChild('status'), equalTo('LIVE'), limitToLast(20)),
    snap => cb(mapChildren<Match>(snap)),
    error => {
      console.log('RTDB live feed failed:', error?.message || error);
      cb([]);
    },
  );

export const listenPublicUpcomingMatches = (cb: (matches: Match[]) => void) =>
  onValue(
    query(pathRef('matches'), orderByChild('status'), equalTo('UPCOMING'), limitToLast(20)),
    snap => {
      const matches = mapChildren<Match>(snap).sort((a, b) =>
        String(a.dateTime || '').localeCompare(String(b.dateTime || '')),
      );
      cb(matches);
    },
    error => {
      console.log('RTDB upcoming feed failed:', error?.message || error);
      cb([]);
    },
  );

export const listenPublicCompletedMatches = (cb: (matches: Match[]) => void) =>
  onValue(
    query(pathRef('matches'), orderByChild('status'), equalTo('COMPLETED'), limitToLast(20)),
    snap => {
      const matches = mapChildren<Match>(snap).sort((a, b) =>
        String(b.dateTime || '').localeCompare(String(a.dateTime || '')),
      );
      cb(matches);
    },
    error => {
      console.log('RTDB completed feed failed:', error?.message || error);
      cb([]);
    },
  );

export const listenMatchesInClubs = (clubIds: string[], cb: (matches: Match[]) => void) =>
  listenInClubIds<Match>('matches', clubIds, cb, (a, b) =>
    String(b.dateTime || '').localeCompare(String(a.dateTime || '')),
  );

export const listenUserMatches = (userId: string, cb: (matches: Match[]) => void) =>
  listenByChild<Match>('matches', 'createdBy', userId, cb, (a, b) =>
    String(b.dateTime || '').localeCompare(String(a.dateTime || '')),
  );

export const listenTournamentsInClubs = (clubIds: string[], cb: (tournaments: Tournament[]) => void) =>
  listenInClubIds<Tournament>('tournaments', clubIds, cb, (a, b) =>
    b.year - a.year || a.name.localeCompare(b.name),
  );

export const listenTeamsInClubs = (clubIds: string[], cb: (teams: Team[]) => void) =>
  listenInClubIds<Team>('teams', clubIds, cb, (a, b) => a.name.localeCompare(b.name));

export const listenUserTeams = (userId: string, cb: (teams: Team[]) => void) =>
  listenByChild<Team>('teams', 'createdBy', userId, cb, (a, b) => a.name.localeCompare(b.name));

export const createMatch = (data: Omit<Match, 'id'>) => pushNode('matches', data);

export const updateMatch = (id: string, data: Partial<Match>) =>
  mergeNode(`matches/${id}`, data);

export const deleteMatch = (id: string) => remove(pathRef(`matches/${id}`));

// ─── Storage (Cloudinary) ───────────────────────────────────────────────────────
/** Uploads local image URIs to Cloudinary and returns a CDN URL. */
export const uploadImage = async (
  uri: string,
  path?: string,
): Promise<string> => {
  const folder = path?.includes('players')
    ? 'abs-score/players'
    : path?.includes('teams')
      ? 'abs-score/teams'
      : path?.includes('users')
        ? 'abs-score/users'
        : path?.includes('tournaments')
          ? 'abs-score/tournaments'
          : undefined;
  const url = await resolveImageUrl(uri, folder);
  if (!url) throw new Error('Image upload failed.');
  return url;
};

// ─── User Profile ───────────────────────────────────────────────────────────────
function directoryPayload(uid: string, data: Partial<User> & { email?: string; name?: string; role?: string }) {
  return withoutUndefined({
    id: uid,
    name: data.name || '',
    email: data.email || '',
    role: data.role || 'public',
    photoURL: data.photoURL || null,
    canGoLive: !!data.canGoLive,
    goLiveAccess: data.goLiveAccess || null,
  });
}

async function syncUserDirectory(uid: string, data: Partial<User> & { email?: string; name?: string; role?: string }) {
  try {
    await set(pathRef(`userDirectory/${uid}`), directoryPayload(uid, data));
  } catch (error) {
    console.log('userDirectory sync failed:', error);
  }
}

export const getUserProfile = async (uid: string) =>
  readVal<User>(await get(pathRef(`users/${uid}`)));

export const createUserProfile = async (uid: string, data: Omit<User, 'id'>) => {
  const profile = withoutUndefined({ ...data, id: uid });
  await set(pathRef(`users/${uid}`), profile);
  await syncUserDirectory(uid, profile);
};

export const updateUserProfile = async (uid: string, data: Partial<User>) => {
  await mergeNode(`users/${uid}`, data);
  try {
    const latest = await getUserProfile(uid);
    if (latest) await syncUserDirectory(uid, latest);
  } catch {
    await syncUserDirectory(uid, { ...data, id: uid } as User);
  }
};

export const listenUserProfile = (uid: string, cb: (user: User | null) => void) => {
  if (!uid) {
    cb(null);
    return () => {};
  }
  return onValue(
    pathRef(`users/${uid}`),
    snap => cb(readVal<User>(snap)),
    error => {
      console.log(`RTDB listen users/${uid} failed:`, error?.message || error);
      cb(null);
    },
  );
};

function sortUsers(rows: User[]) {
  return [...rows].sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
}

/** Live list of registered profiles for the All users screen. */
export const listenUsers = (
  cb: (users: User[]) => void,
  onError?: (message: string) => void,
) => {
  let fromUsers: User[] | null = null;
  let fromDirectory: User[] | null = null;
  let usersDenied = false;
  let directoryDenied = false;

  const emit = () => {
    if (fromUsers) {
      cb(sortUsers(fromUsers));
      onError?.('');
      return;
    }
    if (fromDirectory) {
      cb(sortUsers(fromDirectory));
      onError?.('');
      return;
    }
    if (usersDenied && directoryDenied) {
      onError?.(
        'Permission denied loading users. In Firebase Console → Realtime Database → Rules, publish the rules from database.rules.json in this project.',
      );
      cb([]);
    }
  };

  const unsubUsers = onValue(
    pathRef('users'),
    snap => {
      usersDenied = false;
      fromUsers = mapChildren<User>(snap);
      emit();
    },
    error => {
      usersDenied = true;
      fromUsers = null;
      console.log('RTDB listen users failed:', error?.message || error);
      emit();
    },
  );

  const unsubDirectory = onValue(
    pathRef('userDirectory'),
    snap => {
      directoryDenied = false;
      fromDirectory = mapChildren<User>(snap);
      emit();
    },
    error => {
      directoryDenied = true;
      fromDirectory = null;
      console.log('RTDB listen userDirectory failed:', error?.message || error);
      emit();
    },
  );

  (async () => {
    try {
      const snap = await get(pathRef('users'));
      usersDenied = false;
      fromUsers = mapChildren<User>(snap);
      emit();
      return;
    } catch (error: any) {
      usersDenied = true;
      console.log('RTDB get users failed:', error?.message || error);
    }
    try {
      const snap = await get(pathRef('userDirectory'));
      directoryDenied = false;
      fromDirectory = mapChildren<User>(snap);
      emit();
    } catch (error: any) {
      directoryDenied = true;
      console.log('RTDB get userDirectory failed:', error?.message || error);
      emit();
    }
  })();

  return () => {
    unsubUsers();
    unsubDirectory();
  };
};

/** Persist superadmin in RTDB so Go Live grants and admin tools work. */
export async function ensureSuperAdminProfile(input: {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: UserRole | string | null;
}): Promise<UserRole | null> {
  const email = (input.email || '').trim();
  if (!input.id) return null;
  const shouldBeSuper = input.role === 'superadmin' || emailLooksLikeSuperAdmin(email);
  if (!shouldBeSuper) return null;

  try {
    const existing = await getUserProfile(input.id);
    if (existing?.role === 'superadmin') {
      await syncUserDirectory(input.id, existing);
      return 'superadmin';
    }
    if (!existing) {
      await createUserProfile(input.id, {
        name: input.name || 'AB Sports Super Admin',
        email: email || `${input.id}@absports.app`,
        role: 'superadmin',
      });
    } else {
      await updateUserProfile(input.id, { role: 'superadmin' });
    }
    return 'superadmin';
  } catch (error) {
    console.log('Could not ensure superadmin profile:', error);
    return null;
  }
}

export const setUserGoLiveAccess = async (uid: string, window: GoLiveAccess | null) => {
  if (!window) {
    await Promise.all([
      set(pathRef(`users/${uid}/goLiveAccess`), null),
      set(pathRef(`users/${uid}/canGoLive`), false),
    ]);
  } else {
    const goLiveAccess: GoLiveAccess = {
      startAt: startOfLocalDay(window.startAt),
      endAt: endOfLocalDay(window.endAt),
    };
    await Promise.all([
      set(pathRef(`users/${uid}/goLiveAccess`), goLiveAccess),
      set(pathRef(`users/${uid}/canGoLive`), true),
    ]);
  }
  try {
    const latest = await getUserProfile(uid);
    if (latest) await syncUserDirectory(uid, latest);
  } catch (error) {
    console.log('Could not sync directory after go-live update:', error);
  }
};
