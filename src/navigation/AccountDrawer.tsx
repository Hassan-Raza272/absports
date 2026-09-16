import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../theme';
import PremiumIcon, { PremiumIconName } from '../components/PremiumIcon';
import { showAlert } from '../components/PremiumAlert';
import { useAuthStore } from '../store';
import { signOut } from '../firebase';

const logo = require('../assets/logo.png');

type Item = {
  label: string;
  hint?: string;
  icon: PremiumIconName;
  route?: string;
  params?: Record<string, unknown>;
  auth?: boolean;
  guestOnly?: boolean;
  signup?: boolean;
  superadmin?: boolean;
};

const ACCOUNT: Item[] = [
  { label: 'Profile', hint: 'Account & settings', icon: 'profile', route: 'AccountProfile', auth: true },
  { label: 'My Matches', hint: 'Games you host or score', icon: 'fixtures', route: 'MyMatches', auth: true },
  { label: 'Create match', hint: 'Pick teams and start scoring', icon: 'quick', route: 'CreateMatch', auth: true },
  { label: 'Manage teams', hint: 'Add, edit, or delete squads', icon: 'teams', route: 'AdminTeams', auth: true },
  { label: 'Create Tournament', hint: 'Start a new competition', icon: 'points', route: 'CreateTournament', auth: true },
];

const ORGANISE: Item[] = [
  { label: 'Scoring desk', hint: 'Start and score matches', icon: 'admin', route: 'AdminDashboard', auth: true },
  { label: 'My tournaments', hint: 'Competitions you host', icon: 'points', route: 'AdminTournaments', auth: true },
  { label: 'All users', hint: 'Grant Go Live access', icon: 'players', route: 'AdminUsers', auth: true, superadmin: true },
];

const GUEST: Item[] = [
  { label: 'Login', hint: 'Welcome back', icon: 'sign-in', route: 'Login', guestOnly: true },
  { label: 'Signup', hint: 'Create a free account', icon: 'spark', route: 'Signup', guestOnly: true, signup: true },
];

export default function AccountDrawer(props: DrawerContentComponentProps) {
  const { navigation } = props;
  const insets = useSafeAreaInsets();
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const organiseItems = ORGANISE.filter(item => {
    if (item.superadmin && user?.role !== 'superadmin') return false;
    return true;
  });

  function go(item: Item) {
    if (item.auth && !user) {
      navigation.closeDrawer();
      navigation.getParent()?.navigate('Login' as never);
      return;
    }
    if (!item.route) return;
    navigation.closeDrawer();
    (navigation.getParent() as any)?.navigate(item.route, item.params);
  }

  function handleSignOut() {
    showAlert('Sign out', 'Leave this AB Sports session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try { await signOut(); } catch { /* local sign-out still proceeds */ }
          setUser(null);
          navigation.closeDrawer();
        },
      },
    ]);
  }

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 20) }]}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={Colors.gradHeader} style={styles.hero}>
          <View style={styles.logoRing}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.brand}>AB SPORTS</Text>
          <Text style={styles.tagline}>CRICKET SCORING PLATFORM</Text>
          <Text style={styles.taglineSub}>Tournaments · teams · live scoring</Text>
        </LinearGradient>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => go(user
            ? { label: 'Profile', icon: 'profile', route: 'AccountProfile', auth: true }
            : { label: 'Login', icon: 'sign-in', route: 'Login', guestOnly: true })}
          style={styles.userCard}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.name || 'G').slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Guest'}</Text>
            <Text style={styles.userMeta} numberOfLines={1}>
              {user ? (user.role === 'public' ? 'Player / fan' : user.role) : 'Sign in to score matches'}
            </Text>
          </View>
          <PremiumIcon name="chevron" size={16} color={Colors.primary} />
        </TouchableOpacity>

        {user ? (
          <>
            <Section title="Account">
              {ACCOUNT.map(item => <Row key={item.label} item={item} onPress={() => go(item)} />)}
            </Section>
            <Section title="Organise">
              {organiseItems.map(item => <Row key={item.label} item={item} onPress={() => go(item)} />)}
            </Section>
          </>
        ) : (
          <Section title="Get started">
            {GUEST.map(item => <Row key={item.label} item={item} onPress={() => go(item)} />)}
          </Section>
        )}
      </DrawerContentScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.base) }]}>
        {user ? (
          <TouchableOpacity style={styles.signOut} onPress={handleSignOut} activeOpacity={0.85}>
            <PremiumIcon name="sign-out" size={18} color={Colors.loss} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.footMeta}>AB Sports · cricket scoring platform</Text>
        )}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({ item, onPress }: { item: Item; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.iconWell, item.signup && styles.iconWellGold]}>
        <PremiumIcon name={item.icon} size={18} color={item.signup ? Colors.onPrimary : Colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.label, item.signup && styles.signupLabel]}>{item.label}</Text>
        {!!item.hint && <Text style={styles.hint}>{item.hint}</Text>}
      </View>
      <PremiumIcon name="chevron" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingTop: 0, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.md },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    marginBottom: Spacing.md,
  },
  logoRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgCard,
  },
  logo: { width: 84, height: 84 },
  brand: {
    color: Colors.onPrimary,
    fontWeight: '900',
    fontSize: Typography.xl,
    letterSpacing: 2,
  },
  tagline: {
    color: Colors.onPrimary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginTop: 6,
    opacity: 0.95,
  },
  taglineSub: { color: Colors.onPrimary, fontSize: 11, marginTop: 4, fontWeight: '600', opacity: 0.9 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary + '18',
    borderWidth: 1,
    borderColor: Colors.primary + '66',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { color: Colors.primary, fontWeight: '900', fontSize: Typography.lg },
  userName: { color: Colors.textPrimary, fontWeight: '800' },
  userMeta: { color: Colors.textSecondary, fontSize: Typography.xs, marginTop: 2, textTransform: 'capitalize' },
  section: { marginBottom: Spacing.md },
  sectionTitle: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primary + '14',
    borderWidth: 1,
    borderColor: Colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWellGold: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  label: { color: Colors.textPrimary, fontWeight: '800', fontSize: Typography.sm },
  signupLabel: { color: Colors.accent },
  hint: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  footer: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.primary + '22',
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.loss + '55',
    backgroundColor: Colors.loss + '12',
  },
  signOutText: { color: Colors.loss, fontWeight: '800' },
  footMeta: { textAlign: 'center', color: Colors.textMuted, fontSize: 11, paddingVertical: 8 },
});
