import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import ScreenScaffold from '../../components/ScreenScaffold';
import MatchScoreCard from '../../components/MatchScoreCard';
import FilterChips from '../../components/FilterChips';
import EmptyState from '../../components/EmptyState';
import { SkeletonEntityList, SkeletonMatchList } from '../../components/Skeleton';
import {
  usePublicFeedStore,
  useScopeStore,
} from '../../store';
import {
  listenPublicTeams,
  listenPublicTournaments,
} from '../../firebase';
import { Match, Team, Tournament } from '../../types';

type Filter = 'all' | 'live' | 'upcoming' | 'results' | 'tournaments' | 'teams';

function rankStatus(status: string) {
  if (status === 'LIVE') return 0;
  if (status === 'UPCOMING') return 1;
  if (status === 'COMPLETED') return 2;
  return 3;
}

export default function DiscoverScreen({ navigation, route }: any) {
  const live = usePublicFeedStore(s => s.liveMatches);
  const upcoming = usePublicFeedStore(s => s.upcomingMatches);
  const completed = usePublicFeedStore(s => s.completedMatches);
  const feedReady = usePublicFeedStore(s => s.ready);
  const selectClub = useScopeStore(s => s.selectClub);
  const initial = (route?.params?.initialFilter as Filter | undefined) || 'all';
  const [filter, setFilter] = useState<Filter>(initial);
  const [query, setQuery] = useState('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);

  useEffect(() => {
    const next = route?.params?.initialFilter as Filter | undefined;
    if (next) setFilter(next);
  }, [route?.params?.initialFilter]);

  useEffect(() => {
    let liveLeft = 2;
    const mark = () => {
      if (liveLeft <= 0) return;
      liveLeft -= 1;
      if (liveLeft === 0) setCatalogReady(true);
    };
    const unsubs = [
      listenPublicTournaments(rows => {
        setTournaments(rows);
        mark();
      }),
      listenPublicTeams(rows => {
        setTeams(rows);
        mark();
      }),
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, []);

  function openTournament(tournament: Tournament) {
    selectClub(tournament.clubId, tournament.id);
    navigation.navigate('Main', { screen: 'Tabs', params: { screen: 'Matches' } });
  }

  function openTeam(team: Team) {
    if (team.clubId) selectClub(team.clubId, null);
    navigation.navigate('TeamProfile', { teamId: team.id });
  }

  const q = query.trim().toLowerCase();

  function matchQuery(m: Match) {
    if (!q) return true;
    return `${m.teamAName} ${m.teamBName} ${m.venue}`.toLowerCase().includes(q);
  }

  const tournamentList = useMemo(() => {
    const rows = !q
      ? tournaments
      : tournaments.filter(t => `${t.name} ${t.season} ${t.format}`.toLowerCase().includes(q));
    return rows.slice(0, 80);
  }, [tournaments, q]);

  const teamList = useMemo(() => {
    const rows = !q
      ? teams
      : teams.filter(t => `${t.name} ${t.shortName}`.toLowerCase().includes(q));
    return rows.slice(0, 80);
  }, [teams, q]);

  const liveList = live.filter(matchQuery);
  const upcomingList = upcoming.filter(matchQuery);
  const resultsList = completed.filter(matchQuery);

  const allMatches = useMemo(() => {
    const byId = new Map<string, Match>();
    [...live, ...upcoming, ...completed].forEach(m => byId.set(m.id, m));
    return Array.from(byId.values())
      .filter(matchQuery)
      .sort((a, b) => {
        const byStatus = rankStatus(a.status) - rankStatus(b.status);
        if (byStatus !== 0) return byStatus;
        return String(b.dateTime || '').localeCompare(String(a.dateTime || ''));
      });
  }, [live, upcoming, completed, q]);

  const tournamentMatches = useMemo(() => {
    if (filter !== 'tournaments' || !q) return [] as Match[];
    const ids = new Set(
      tournaments
        .filter(t => `${t.name} ${t.season}`.toLowerCase().includes(q))
        .map(t => t.id),
    );
    return [...live, ...upcoming, ...completed].filter(m => m.tournamentId && ids.has(m.tournamentId));
  }, [filter, q, tournaments, live, upcoming, completed]);

  const teamMatches = useMemo(() => {
    if (filter !== 'teams' || !q) return [] as Match[];
    const names = teams
      .filter(t => `${t.name} ${t.shortName}`.toLowerCase().includes(q))
      .flatMap(t => [t.name.toLowerCase(), t.shortName.toLowerCase()]);
    if (!names.length) return [];
    return [...live, ...upcoming, ...completed].filter(m =>
      names.some(n => m.teamAName.toLowerCase().includes(n) || m.teamBName.toLowerCase().includes(n)),
    );
  }, [filter, q, teams, live, upcoming, completed]);

  function renderMatchList(rows: Match[], emptyTitle: string, emptySub: string) {
    return (
      <>
        {rows.map(match => (
          <MatchScoreCard
            key={match.id}
            match={match}
            onPress={() => navigation.navigate('MatchCenter', { matchId: match.id })}
          />
        ))}
        {rows.length === 0 && (
          <EmptyState title={emptyTitle} subtitle={emptySub} />
        )}
      </>
    );
  }

  const loading = !feedReady || ((filter === 'tournaments' || filter === 'teams') && !catalogReady);

  return (
    <ScreenScaffold title="Discover" subtitle="Search tournaments, teams & matches" showScope={false}>
      {loading ? (
        filter === 'teams' || filter === 'tournaments' ? <SkeletonEntityList count={7} /> : <SkeletonMatchList count={5} />
      ) : (
      <>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search tournaments, teams, matches"
        placeholderTextColor={Colors.textMuted}
        style={styles.search}
      />
      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'all', label: `All (${allMatches.length})` },
          { key: 'live', label: `Live (${live.length})`, accent: Colors.live },
          { key: 'upcoming', label: 'Upcoming', accent: Colors.accent },
          { key: 'results', label: `Results (${completed.length})`, accent: Colors.primary },
          { key: 'tournaments', label: `Tournaments (${tournaments.length})` },
          { key: 'teams', label: `Teams (${teams.length})` },
        ]}
      />
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filter === 'all' && renderMatchList(allMatches, 'No matches yet', 'Live, upcoming, and results appear here.')}
        {filter === 'live' && renderMatchList(liveList, 'Quiet across AB Sports', 'Browse tournaments or teams to find a competition.')}
        {filter === 'upcoming' && renderMatchList(upcomingList, 'No upcoming public games', 'Check back soon or browse tournaments.')}
        {filter === 'results' && renderMatchList(resultsList, 'No results yet', 'Completed matches show up here.')}

        {filter === 'tournaments' && (
          <>
            {tournamentMatches.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Matches</Text>
                {tournamentMatches.map(match => (
                  <MatchScoreCard
                    key={`tm-${match.id}`}
                    match={match}
                    compact
                    onPress={() => navigation.navigate('MatchCenter', { matchId: match.id })}
                  />
                ))}
              </>
            )}
            <Text style={styles.sectionLabel}>Tournaments</Text>
            {tournamentList.map(tournament => {
              const relatedLive = [...live, ...upcoming].filter(m => m.tournamentId === tournament.id).length;
              return (
                <TouchableOpacity key={tournament.id} activeOpacity={0.88} onPress={() => openTournament(tournament)}>
                  <LinearGradient colors={Colors.gradCard} style={styles.card}>
                    <Text style={styles.kicker}>{tournament.city || tournament.season || 'Tournament'}</Text>
                    <Text style={styles.cardTitle}>{tournament.name}</Text>
                    <Text style={styles.meta}>
                      {tournament.format} · {tournament.type} · {tournament.season} · {(tournament.teamIds || []).length || tournament.totalTeams || 0} teams
                    </Text>
                    <Text style={styles.cta}>
                      {relatedLive > 0 ? `${relatedLive} live/upcoming · ` : ''}View matches →
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
            {tournamentList.length === 0 && (
              <EmptyState title="No tournaments match" subtitle="Try another name or season." />
            )}
          </>
        )}

        {filter === 'teams' && (
          <>
            {teamMatches.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Matches</Text>
                {teamMatches.map(match => (
                  <MatchScoreCard
                    key={`team-m-${match.id}`}
                    match={match}
                    compact
                    onPress={() => navigation.navigate('MatchCenter', { matchId: match.id })}
                  />
                ))}
              </>
            )}
            <Text style={styles.sectionLabel}>Teams</Text>
            {teamList.map(team => (
              <TouchableOpacity key={team.id} activeOpacity={0.88} onPress={() => openTeam(team)}>
                <LinearGradient colors={Colors.gradCard} style={styles.card}>
                  <Text style={styles.cardTitle}>{team.name}</Text>
                  <Text style={styles.meta}>{team.shortName}{team.homeGround ? ` · ${team.homeGround}` : ''}</Text>
                  <Text style={styles.cta}>Open squad & matches →</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
            {teamList.length === 0 && (
              <EmptyState title="No teams match" subtitle="Search by squad name or short code." />
            )}
          </>
        )}
      </ScrollView>
      </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  search: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: Typography.sm,
  },
  list: { padding: Spacing.base, paddingBottom: 40 },
  sectionLabel: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  kicker: { color: Colors.primary, fontSize: 11, fontWeight: '900' },
  cardTitle: { color: Colors.textPrimary, fontWeight: '900', fontSize: Typography.base, marginTop: 4 },
  cta: { color: Colors.primary, fontWeight: '700', marginTop: Spacing.sm, fontSize: Typography.sm },
  meta: { color: Colors.textSecondary, fontSize: Typography.xs, marginTop: 2, textTransform: 'capitalize' },
});
