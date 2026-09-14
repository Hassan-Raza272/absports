import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import BackButton from '../../../components/BackButton';
import { SkeletonEntityList } from '../../../components/Skeleton';
import { showAlert } from '../../../components/PremiumAlert';
import { useAuthStore } from '../../../store';
import { listenUsers, setUserGoLiveAccess, ensureSuperAdminProfile } from '../../../firebase';
import { User } from '../../../types';
import {
  canUserGoLive,
  endOfLocalDay,
  formatGoLiveDay,
  goLiveWindowLabel,
  goLiveWindowStatus,
  isSuperAdmin,
  startOfLocalDay,
} from '../../../utils/account';

function roleLabel(role?: string) {
  if (role === 'superadmin') return 'Super admin';
  if (role === 'admin') return 'Organiser';
  if (role === 'scorer') return 'Scorer';
  if (role === 'manager') return 'Manager';
  return 'Player / fan';
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export default function AdminUsersScreen({ navigation }: any) {
  const user = useAuthStore(state => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [grantUser, setGrantUser] = useState<User | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(daysFromNow(7));
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (!isSuperAdmin(user)) {
      showAlert('Super admin only', 'Only a super admin can view all users and grant Go Live access.');
      navigation.goBack();
    }
  }, [user, navigation]);

  useEffect(() => {
    if (!user?.id || !isSuperAdmin(user)) return undefined;
    let stop: (() => void) | undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      await ensureSuperAdminProfile({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
      if (cancelled) return;
      stop = listenUsers(
        rows => {
          const mine =
            user && isSuperAdmin(user)
              ? {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  role: user.role,
                  photoURL: user.photoURL,
                  canGoLive: user.canGoLive,
                  goLiveAccess: user.goLiveAccess,
                }
              : null;
          const merged =
            mine && !rows.some(row => row.id === mine.id) ? [mine, ...rows] : rows;
          setUsers(merged);
          setLoading(false);
          setLoadError(null);
        },
        message => {
          if (!message) {
            setLoadError(null);
            return;
          }
          setLoading(false);
          setLoadError(message);
        },
      );
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [user?.id, user?.email, user?.role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(row =>
      [row.name, row.email, row.role].some(value => (value || '').toLowerCase().includes(q)),
    );
  }, [users, query]);

  const grantedCount = users.filter(row => canUserGoLive(row)).length;

  function openGrant(row: User) {
    if (row.role === 'superadmin') return;
    const start = row.goLiveAccess?.startAt ? new Date(row.goLiveAccess.startAt) : new Date();
    const end = row.goLiveAccess?.endAt ? new Date(row.goLiveAccess.endAt) : daysFromNow(7);
    setStartDate(start);
    setEndDate(end < start ? start : end);
    setPicker(null);
    setGrantUser(row);
  }

  function onPickDate(which: 'start' | 'end') {
    return (event: DateTimePickerEvent, selected?: Date) => {
      if (Platform.OS === 'android') setPicker(null);
      if (event.type === 'dismissed' || !selected) return;
      if (which === 'start') {
        setStartDate(selected);
        if (endOfLocalDay(endDate) < startOfLocalDay(selected)) setEndDate(selected);
      } else {
        setEndDate(selected);
      }
    };
  }

  async function saveGrant() {
    if (!grantUser) return;
    if (endOfLocalDay(endDate) < startOfLocalDay(startDate)) {
      showAlert('Invalid dates', 'End date must be on or after the start date.');
      return;
    }
    setBusy(true);
    try {
      await setUserGoLiveAccess(grantUser.id, {
        startAt: startOfLocalDay(startDate),
        endAt: endOfLocalDay(endDate),
      });
      setGrantUser(null);
    } catch (error: any) {
      showAlert('Could not save access', error?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeGrant() {
    if (!grantUser) return;
    setBusy(true);
    try {
      await setUserGoLiveAccess(grantUser.id, null);
      setGrantUser(null);
    } catch (error: any) {
      showAlert('Could not remove access', error?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} style={{ marginBottom: 4 }} />
        <Text style={styles.title}>All users</Text>
        <Text style={styles.sub}>
          Grant Go Live for a start and end date. That user can stream only matches they start, during that window.
        </Text>
        <View style={styles.stats}>
          <Text style={styles.stat}>{users.length} accounts</Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.stat}>{grantedCount} live now</Text>
        </View>
      </LinearGradient>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search name or email"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <SkeletonEntityList count={8} />
      ) : loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.empty}>{loadError}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoading(true);
              setLoadError(null);
              ensureSuperAdminProfile({
                id: user!.id,
                email: user!.email,
                name: user!.name,
                role: user!.role,
              }).then(() => {
                const stop = listenUsers(
                  rows => {
                    setUsers(rows);
                    setLoading(false);
                    setLoadError(null);
                    stop();
                  },
                  message => {
                    setLoading(false);
                    setLoadError(message);
                    stop();
                  },
                );
              });
            }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>
              {users.length === 0 ? 'No user profiles yet. People appear here after they sign up.' : 'No matching users.'}
            </Text>
          ) : (
            filtered.map(row => {
              const locked = row.role === 'superadmin';
              const status = goLiveWindowStatus(row);
              const self = row.id === user?.id;
              return (
                <LinearGradient key={row.id} colors={Colors.gradCard} style={styles.card}>
                  {row.photoURL ? (
                    <Image source={{ uri: row.photoURL }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(row.name || row.email || '?').slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.meta}>
                    <Text style={styles.name} numberOfLines={1}>
                      {row.name || 'Unnamed'}
                      {self ? ' (you)' : ''}
                    </Text>
                    <Text style={styles.email} numberOfLines={1}>{row.email || 'No email'}</Text>
                    <Text style={styles.role}>{roleLabel(row.role)}</Text>
                    <Text
                      style={[
                        styles.window,
                        status === 'active' && styles.windowOn,
                        status === 'upcoming' && styles.windowSoon,
                        status === 'expired' && styles.windowOff,
                      ]}>
                      {goLiveWindowLabel(row)}
                    </Text>
                  </View>
                  {locked ? (
                    <Text style={styles.always}>Always on</Text>
                  ) : (
                    <TouchableOpacity style={styles.grantBtn} onPress={() => openGrant(row)}>
                      <Text style={styles.grantBtnText}>{status === 'none' ? 'Give access' : 'Edit dates'}</Text>
                    </TouchableOpacity>
                  )}
                </LinearGradient>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal visible={!!grantUser} transparent animationType="slide" onRequestClose={() => setGrantUser(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Go Live dates</Text>
            <Text style={styles.modalSub} numberOfLines={2}>
              {grantUser ? `${grantUser.name || 'User'} can stream only matches they start between these dates.` : ''}
            </Text>

            <Text style={styles.fieldLabel}>Start date</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setPicker('start')}>
              <Text style={styles.pickerIcon}>📅</Text>
              <Text style={styles.pickerText}>{formatGoLiveDay(startDate.getTime())}</Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>End date</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setPicker('end')}>
              <Text style={styles.pickerIcon}>📅</Text>
              <Text style={styles.pickerText}>{formatGoLiveDay(endDate.getTime())}</Text>
            </TouchableOpacity>

            {picker && (
              <DateTimePicker
                value={picker === 'start' ? startDate : endDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickDate(picker)}
                themeVariant="dark"
              />
            )}
            {Platform.OS === 'ios' && picker && (
              <TouchableOpacity style={styles.pickerDone} onPress={() => setPicker(null)}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={saveGrant} disabled={busy}>
              <LinearGradient colors={Colors.gradPrimary} style={styles.saveGrad}>
                <Text style={styles.saveText}>{busy ? 'Saving…' : 'Save access'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            {grantUser?.goLiveAccess && (
              <TouchableOpacity style={styles.revokeBtn} onPress={revokeGrant} disabled={busy}>
                <Text style={styles.revokeText}>Remove access</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setGrantUser(null)} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: 50,
    paddingBottom: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: Typography.xxl, fontWeight: '800', color: Colors.onPrimary },
  sub: { fontSize: Typography.sm, color: Colors.onPrimary, opacity: 0.92, marginTop: 4, lineHeight: 18, fontWeight: '600' },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, gap: 6 },
  stat: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.xs },
  statDot: { color: 'rgba(255,255,255,0.7)' },
  searchWrap: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  search: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: Typography.sm,
  },
  list: { padding: Spacing.base, paddingBottom: 80, gap: Spacing.sm },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xl, paddingHorizontal: Spacing.base, lineHeight: 20 },
  errorBox: { marginTop: Spacing.xl, alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.base },
  retryBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  retryText: { color: Colors.primary, fontWeight: '800' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '22',
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { color: Colors.primary, fontWeight: '900', fontSize: Typography.base },
  meta: { flex: 1, minWidth: 0 },
  name: { color: Colors.textPrimary, fontWeight: '800', fontSize: Typography.sm },
  email: { color: Colors.textSecondary, fontSize: Typography.xs, marginTop: 2 },
  role: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },
  window: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: '700', marginTop: 6 },
  windowOn: { color: Colors.primary },
  windowSoon: { color: Colors.accentBlue },
  windowOff: { color: Colors.loss },
  always: { color: Colors.primary, fontSize: 10, fontWeight: '800' },
  grantBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  grantBtnText: { color: Colors.primary, fontSize: 10, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.base,
    paddingBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.textPrimary },
  modalSub: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.base },
  fieldLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 6, fontWeight: '700' },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  pickerIcon: { fontSize: 16 },
  pickerText: { color: Colors.textPrimary, fontSize: Typography.sm, fontWeight: '700' },
  pickerDone: { alignSelf: 'flex-end', marginBottom: Spacing.md, paddingVertical: 6, paddingHorizontal: Spacing.md },
  pickerDoneText: { color: Colors.primary, fontWeight: '800' },
  saveBtn: { borderRadius: Radius.md, overflow: 'hidden', marginTop: Spacing.xs },
  saveGrad: { paddingVertical: Spacing.md, alignItems: 'center' },
  saveText: { color: Colors.onPrimary, fontWeight: '800' },
  revokeBtn: { alignItems: 'center', padding: Spacing.md },
  revokeText: { color: Colors.loss, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingBottom: Spacing.sm },
  cancelText: { color: Colors.textSecondary, fontWeight: '700' },
});
