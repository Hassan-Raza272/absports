import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import BackButton from '../../../components/BackButton';
import { showAlert } from '../../../components/PremiumAlert';
import { SkeletonEntityList } from '../../../components/Skeleton';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import {
  useAuthStore,
  useClubsStore,
  useHubStore,
  useScopeStore,
  useTournamentsStore,
  useUserClubs,
} from '../../../store';
import { Tournament } from '../../../types';
import { isSuperAdmin } from '../../../utils/account';
import TournamentBanner from '../../../components/TournamentBanner';

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export default function AdminTournamentsScreen({ navigation, route }: any) {
  const user = useAuthStore(state => state.user);
  const clubs = useClubsStore(state => state.clubs);
  const myClubs = useUserClubs();
  const localTournaments = useTournamentsStore(state => state.tournaments);
  const tournamentsReady = useTournamentsStore(state => state.ready);
  const hubTournaments = useHubStore(state => state.tournaments);
  const hubReady = useHubStore(state => state.ready);
  const selectedTournamentId = useScopeStore(state => state.selectedTournamentId);
  const selectClub = useScopeStore(state => state.selectClub);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!user) {
      showAlert('Sign in', 'Sign in to create a tournament.');
      navigation.replace('Signup');
    }
  }, [user, navigation]);

  useEffect(() => {
    if (route?.params?.openCreate) {
      navigation.navigate('CreateTournament');
    }
  }, [route?.params?.openCreate, navigation]);

  const ownedClubIds = useMemo(() => {
    if (isSuperAdmin(user)) return new Set(clubs.map(c => c.id));
    return new Set(myClubs.map(c => c.id));
  }, [user, clubs, myClubs]);

  const mine = useMemo(() => {
    const merged = uniqueById([...localTournaments, ...hubTournaments]);
    return merged
      .filter(t => ownedClubIds.has(t.clubId) || (!!user && t.createdBy === user.id))
      .sort((a, b) => (b.year || 0) - (a.year || 0) || a.name.localeCompare(b.name));
  }, [localTournaments, hubTournaments, ownedClubIds, user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mine;
    return mine.filter(t => {
      const clubName = clubs.find(c => c.id === t.clubId)?.name || '';
      return (
        t.name.toLowerCase().includes(q) ||
        clubName.toLowerCase().includes(q) ||
        (t.format || '').toLowerCase().includes(q) ||
        (t.type || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q)
      );
    });
  }, [mine, query, clubs]);

  function handleSwitch(tournament: Tournament) {
    selectClub(tournament.clubId, tournament.id);
    showAlert('Tournament selected', `${tournament.name} is now active.`);
  }

  function toggleSearch() {
    setSearchOpen(open => {
      if (open) setQuery('');
      return !open;
    });
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <View style={styles.headerTop}>
          <BackButton onPress={() => navigation.goBack()} />
          <TouchableOpacity onPress={toggleSearch} style={styles.searchIconBtn} hitSlop={8} accessibilityLabel="Search tournaments">
            <Icon name={searchOpen ? 'close-outline' : 'search-outline'} size={22} color={Colors.onPrimary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>My Tournaments</Text>
        <Text style={styles.sub}>Competitions you host · {mine.length}</Text>

        {searchOpen && (
          <View style={styles.searchBar}>
            <Icon name="search-outline" size={18} color={Colors.textMuted} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Search tournaments"
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {query.length > 0 && Platform.OS === 'android' && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Icon name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {!tournamentsReady && !hubReady ? (
          <SkeletonEntityList count={5} />
        ) : (
          <>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateTournament')}
              activeOpacity={0.9}
              style={styles.addBtnWrap}>
              <LinearGradient colors={Colors.gradGold} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.addBtn}>
                <Icon name="add" size={18} color={Colors.onPrimary} />
                <Text style={styles.addBtnText}>Create Tournament</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Main', { screen: 'Tabs', params: { screen: 'Discover' } })}
              style={styles.browseLink}
              hitSlop={6}>
              <Text style={styles.browseLinkText}>Browse all tournaments & teams</Text>
              <Icon name="arrow-forward" size={14} color={Colors.accent} />
            </TouchableOpacity>

            {filtered.map(tournament => {
              const active = tournament.id === selectedTournamentId;
              const club = clubs.find(c => c.id === tournament.clubId);
              const teamCount = (tournament.teamIds || []).length;
              return (
                <View key={tournament.id} style={[styles.card, active && styles.cardActive]}>
                  {(tournament.bannerURL || tournament.bannerPresetId) && (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => navigation.navigate('AdminTournamentDetail', { tournamentId: tournament.id })}>
                      {tournament.bannerURL ? (
                        <Image source={{ uri: tournament.bannerURL }} style={styles.cardBanner} />
                      ) : (
                        <TournamentBanner presetId={tournament.bannerPresetId} compact style={styles.cardBanner} />
                      )}
                    </TouchableOpacity>
                  )}
                  <View style={styles.cardBody}>
                    <TouchableOpacity
                      style={styles.cardMain}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('AdminTournamentDetail', { tournamentId: tournament.id })}>
                      <View style={styles.cardTopRow}>
                        <Text style={styles.clubTag} numberOfLines={1}>
                          {club?.name || 'Organisation'}
                        </Text>
                        {active && (
                          <View style={styles.activePill}>
                            <Text style={styles.activePillText}>ACTIVE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.name} numberOfLines={2}>
                        {tournament.name}
                      </Text>
                      <View style={styles.metaRow}>
                        {!!tournament.category && (
                          <View style={styles.metaChip}>
                            <Text style={styles.metaChipText}>{tournament.category}</Text>
                          </View>
                        )}
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>{tournament.format}</Text>
                        </View>
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>{tournament.overs} ov</Text>
                        </View>
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>
                            {teamCount} {teamCount === 1 ? 'team' : 'teams'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.manageHint}>Manage teams, fixtures & table</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleSwitch(tournament)}
                      style={[styles.switchBtn, active && styles.switchBtnActive]}
                      hitSlop={6}>
                      <Text style={[styles.switchText, active && styles.switchTextActive]}>
                        {active ? 'Selected' : 'Switch'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {mine.length === 0 && (
              <View style={styles.emptyWrap}>
                <Icon name="trophy-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No tournaments yet</Text>
                <Text style={styles.empty}>Create your first competition to get started.</Text>
              </View>
            )}
            {mine.length > 0 && filtered.length === 0 && (
              <View style={styles.emptyWrap}>
                <Icon name="search-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.empty}>Nothing found for “{query.trim()}”.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: 52,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.base,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  searchIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: '800',
    color: Colors.onPrimary,
    letterSpacing: 0.2,
  },
  sub: {
    fontSize: Typography.sm,
    color: Colors.onPrimary,
    opacity: 0.9,
    marginTop: 4,
    fontWeight: '600',
  },
  searchBar: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: '600',
    paddingVertical: Platform.OS === 'ios' ? 0 : 8,
  },
  scroll: { padding: Spacing.base, paddingBottom: 96 },
  addBtnWrap: { marginBottom: Spacing.sm },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: Radius.full,
  },
  addBtnText: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.md },
  browseLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.base,
    paddingVertical: 4,
  },
  browseLinkText: { color: Colors.accent, fontWeight: '700', fontSize: Typography.sm },
  card: {
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardActive: {
    borderColor: Colors.primary + '55',
    backgroundColor: '#FFF8F9',
  },
  cardBanner: { width: '100%', height: 112 },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  cardMain: { flex: 1, minWidth: 0 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  clubTag: {
    flex: 1,
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  activePill: {
    backgroundColor: Colors.primary + '18',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  activePillText: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  name: {
    fontSize: Typography.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  metaChip: {
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  manageHint: {
    fontSize: Typography.xs,
    color: Colors.accent,
    marginTop: 10,
    fontWeight: '600',
  },
  switchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchBtnActive: {
    backgroundColor: Colors.primary + '14',
    borderColor: Colors.primary + '40',
  },
  switchText: { fontSize: Typography.xs, fontWeight: '800', color: Colors.textMuted },
  switchTextActive: { color: Colors.primary },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  emptyTitle: {
    fontSize: Typography.base,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  empty: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    fontWeight: '500',
    lineHeight: 20,
  },
});
