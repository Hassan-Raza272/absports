import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import ScreenScaffold from '../../components/ScreenScaffold';
import PremiumIcon, { PremiumIconName } from '../../components/PremiumIcon';
import { useAuthStore } from '../../store';
import { EaseEnter, EasePress } from '../../motion';

type Tile = {
  label: string;
  hint: string;
  icon: PremiumIconName;
  route: string;
  auth?: boolean;
  superadmin?: boolean;
};

const TILES: Tile[] = [
  { label: 'Teams', hint: 'Squads and form', icon: 'teams', route: 'TeamsList' },
  { label: 'Players', hint: 'Directory and stats', icon: 'players', route: 'PlayersList' },
  { label: 'Leaders', hint: 'Runs, wickets, sixes', icon: 'stats', route: 'StatsList' },
  { label: 'Scoring desk', hint: 'Start and score matches', icon: 'admin', route: 'AdminDashboard', auth: true },
  { label: 'My tournaments', hint: 'Competitions you host', icon: 'points', route: 'AdminTournaments', auth: true },
  { label: 'All users', hint: 'Grant Go Live access', icon: 'players', route: 'AdminUsers', superadmin: true },
];

export default function MoreScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user);
  const isSuper = user?.role === 'superadmin';

  function go(tile: Tile) {
    if ((tile.auth || tile.superadmin) && !user) {
      navigation.navigate('Login');
      return;
    }
    navigation.navigate(tile.route);
  }

  return (
    <ScreenScaffold title="More" subtitle="Directory and scoring">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <EaseEnter>
          <LinearGradient colors={[Colors.bgElevated, Colors.bgCard]} style={styles.userCard}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(user?.name || 'G').slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user?.name || 'Guest'}</Text>
              <Text style={styles.userMeta}>{user ? user.email : 'Public viewer'}</Text>
            </View>
            {!user && (
              <TouchableOpacity onPress={() => navigation.navigate('Login')}><Text style={styles.link}>Sign in</Text></TouchableOpacity>
            )}
          </LinearGradient>
        </EaseEnter>

        <View style={styles.grid}>
          {TILES.filter(t => (!t.auth || !!user) && (!t.superadmin || isSuper)).map((tile, i) => (
            <EaseEnter key={tile.label} index={i} style={styles.tileWrap}>
              <EasePress onPress={() => go(tile)} style={styles.tile}>
                <View style={[styles.iconWrap, tile.auth && { backgroundColor: Colors.accent + '18' }]}>
                  <PremiumIcon name={tile.icon} size={18} color={tile.auth ? Colors.accent : Colors.primary} />
                </View>
                <Text style={styles.tileLabel}>{tile.label}</Text>
                <Text style={styles.tileHint}>{tile.hint}</Text>
              </EasePress>
            </EaseEnter>
          ))}
        </View>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.base, paddingBottom: 40 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    overflow: 'hidden',
  },
  avatarText: { color: Colors.primary, fontWeight: '900', fontSize: Typography.lg },
  userName: { color: Colors.textPrimary, fontWeight: '800' },
  userMeta: { color: Colors.textSecondary, fontSize: Typography.xs, marginTop: 2 },
  link: { color: Colors.accent, fontWeight: '800', fontSize: Typography.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tileWrap: { width: '48%' },
  tile: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  tileLabel: { color: Colors.textPrimary, fontWeight: '800' },
  tileHint: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
});
