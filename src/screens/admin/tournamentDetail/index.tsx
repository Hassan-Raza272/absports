import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, StatusBar, Platform, Image } from 'react-native';
import BackButton from '../../../components/BackButton';
import { showAlert } from '../../../components/PremiumAlert';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import {
  useAuthStore, useMatchesStore, useScopeStore, useTeamsStore, useTournamentsStore,
} from '../../../store';
import {
  createMatch as createRemoteMatch,
  deleteMatch as deleteRemoteMatch,
  updateMatch as updateRemoteMatch,
  updateTournament as updateRemoteTournament,
  addTeam as addRemoteTeam,
} from '../../../firebase';
import { Match, MatchStatus, Team, Tournament } from '../../../types';
import { DEFAULT_MATCH_SETTINGS } from '../../../utils/matchSettings';
import { buildRoundRobinPairings, nextKickoff } from '../../../utils/roundRobin';
import { buildPointsTable } from '../../../utils/scoring';
import { pointsTableShareMessage, shareText } from '../../../utils/share';
import { randomPremiumTeamLogo } from '../../../utils/defaultLogo';
import TournamentBanner from '../../../components/TournamentBanner';
import PremiumPointsTable from '../../../components/PremiumPointsTable';

type Tab = 'overview' | 'teams' | 'fixtures' | 'table';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'teams', label: 'Teams' },
  { key: 'fixtures', label: 'Fixtures' },
  { key: 'table', label: 'Table' },
];

function defaultKickoff() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30, 0, 0);
  return d;
}

function TeamPicker({
  teams,
  enrolledIds,
  selectedId,
  onSelect,
  onCreateTeam,
}: {
  teams: Team[];
  enrolledIds: string[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreateTeam: () => void;
}) {
  if (teams.length === 0) {
    return (
      <TouchableOpacity onPress={onCreateTeam} style={{ marginBottom: Spacing.sm }}>
        <Text style={{ color: Colors.primary, fontWeight: '700' }}>No teams yet — create teams →</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={{ marginBottom: Spacing.xs }}>
      {teams.map(team => {
        const on = selectedId === team.id;
        return (
          <TouchableOpacity
            key={team.id}
            onPress={() => onSelect(team.id)}
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                padding: Spacing.md,
                borderRadius: Radius.md,
                borderWidth: 1,
                marginBottom: 6,
                backgroundColor: on ? Colors.primary + '14' : Colors.bgElevated,
                borderColor: on ? Colors.primary + '66' : Colors.border,
              },
            ]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.textPrimary, fontWeight: '800' }}>{team.name}</Text>
              <Text style={{ color: Colors.textSecondary, fontSize: Typography.xs, marginTop: 2 }}>
                {team.shortName}
                {enrolledIds.includes(team.id) ? ' · Enrolled' : ' · Club team'}
              </Text>
            </View>
            <Text style={{ color: on ? Colors.primary : Colors.textMuted, fontWeight: '800', fontSize: Typography.xs }}>
              {on ? 'SELECTED' : 'Select'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AdminTournamentDetailScreen({ route, navigation }: any) {
  const tournamentId: string = route.params?.tournamentId;
  const requestedTab: Tab | undefined = route.params?.tab;
  const user = useAuthStore(s => s.user);
  const tournaments = useTournamentsStore(s => s.tournaments);
  const updateTournamentLocal = useTournamentsStore(s => s.updateTournament);
  const selectTournament = useScopeStore(s => s.selectTournament);
  const selectedClubId = useScopeStore(s => s.selectedClubId);
  const allTeams = useTeamsStore(s => s.teams);
  const matches = useMatchesStore(s => s.matches);
  const addMatchLocal = useMatchesStore(s => s.addMatch);
  const updateMatchLocal = useMatchesStore(s => s.updateMatch);
  const deleteMatchLocal = useMatchesStore(s => s.deleteMatch);

  const tournament = tournaments.find(t => t.id === tournamentId);
  const clubTeams = allTeams.filter(t => t.clubId === (tournament?.clubId || selectedClubId));
  const enrolledIds = tournament?.teamIds || [];
  const enrolledTeams = clubTeams.filter(t => enrolledIds.includes(t.id));
  const fixtureTeamOptions = [
    ...enrolledTeams,
    ...clubTeams.filter(c => !enrolledIds.includes(c.id)),
  ];
  const tourneyMatches = matches
    .filter(m => m.tournamentId === tournamentId)
    .sort((a, b) => String(a.dateTime).localeCompare(String(b.dateTime)));

  const [tab, setTab] = useState<Tab>(
    requestedTab && TABS.some(t => t.key === requestedTab) ? requestedTab : 'overview',
  );
  const [saving, setSaving] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamShort, setNewTeamShort] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);

  const [addingFixture, setAddingFixture] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState(defaultKickoff);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [fixtureForm, setFixtureForm] = useState({
    teamAId: '',
    teamBId: '',
    venue: tournament?.venue || '',
    overs: String(tournament?.overs || 20),
    status: 'UPCOMING' as MatchStatus,
  });

  const [homeAndAway, setHomeAndAway] = useState(!!tournament?.homeAway);
  const [hoursApart, setHoursApart] = useState('24');

  const tableEntries = useMemo(() => {
    if (!tournament) return [];
    return buildPointsTable(clubTeams, tourneyMatches, {
      pointsConfig: tournament.pointsConfig,
      overrides: tournament.pointsOverrides,
      enrolledTeamIds: enrolledIds.length ? enrolledIds : undefined,
    });
  }, [tournament, clubTeams, tourneyMatches, enrolledIds]);

  useEffect(() => {
    if (requestedTab && TABS.some(t => t.key === requestedTab)) setTab(requestedTab);
  }, [requestedTab]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Sign in required.</Text>
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={Colors.gradHeader} style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} style={{ marginBottom: 4 }} />
          <Text style={styles.title}>Tournament</Text>
        </LinearGradient>
        <Text style={styles.empty}>Tournament not found.</Text>
      </View>
    );
  }

  const t: Tournament = tournament;
  const currentTab = tab;

  async function persistTournament(patch: Partial<Tournament>, message?: string) {
    setSaving(true);
    try {
      updateTournamentLocal(t.id, patch);
      await updateRemoteTournament(t.id, patch);
      if (message) showAlert('Saved', message);
    } catch (e: any) {
      showAlert('Save failed', e?.message || 'Could not update tournament.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnroll(teamId: string) {
    const next = enrolledIds.includes(teamId)
      ? enrolledIds.filter(id => id !== teamId)
      : [...enrolledIds, teamId];
    await persistTournament({ teamIds: next, totalTeams: next.length });
  }

  async function createAndEnrollTeam() {
    if (!newTeamName.trim() || !newTeamShort.trim()) {
      showAlert('Required', 'Team name and short name are required.');
      return;
    }
    setAddingTeam(true);
    try {
      const shortName = newTeamShort.trim().toUpperCase();
      const logoURL = randomPremiumTeamLogo(`${newTeamName.trim()}-${shortName}`);
      const payload: Omit<Team, 'id'> = {
        clubId: t.clubId,
        name: newTeamName.trim(),
        shortName,
        captain: 'TBD',
        viceCaptain: 'TBD',
        coach: 'TBD',
        owner: 'TBD',
        homeGround: t.venue || 'Club Ground',
        logoURL,
        primaryColor: Colors.primary,
        secondaryColor: Colors.primaryDark,
        playerIds: [],
        stats: { played: 0, won: 0, lost: 0, nr: 0, nrr: 0, points: 0 },
      };
      const ref = await addRemoteTeam(payload);
      const next = Array.from(new Set([...enrolledIds, String(ref.id)]));
      await persistTournament({ teamIds: next, totalTeams: next.length });
      setNewTeamName('');
      setNewTeamShort('');
      showAlert('Team added', `${payload.name} is enrolled in this tournament.`);
    } catch (e: any) {
      showAlert('Save failed', e?.message || 'Could not add team.');
    } finally {
      setAddingTeam(false);
    }
  }

  function onDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    const next = new Date(scheduledAt);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    setScheduledAt(next);
  }

  function onTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    const next = new Date(scheduledAt);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setScheduledAt(next);
  }

  async function submitFixture() {
    const teamA = clubTeams.find(x => x.id === fixtureForm.teamAId);
    const teamB = clubTeams.find(x => x.id === fixtureForm.teamBId);
    if (!teamA || !teamB) {
      showAlert(
        clubTeams.length < 2 ? 'Need teams' : 'Pick teams',
        clubTeams.length < 2
          ? 'Create at least two teams, then pick them here.'
          : 'Select Team A and Team B from your teams.',
      );
      return;
    }
    if (teamA.id === teamB.id) {
      showAlert('Invalid', 'Pick two different teams.');
      return;
    }
    if (scheduledAt.getTime() <= Date.now() && fixtureForm.status === 'UPCOMING') {
      showAlert('Invalid time', 'Upcoming match time must be later than now.');
      return;
    }
    const payload: Omit<Match, 'id'> = {
      clubId: t.clubId,
      tournamentId: t.id,
      matchNumber: tourneyMatches.length + 1,
      teamA: teamA.id,
      teamB: teamB.id,
      teamAName: teamA.name,
      teamBName: teamB.name,
      teamALogo: teamA.logoURL,
      teamBLogo: teamB.logoURL,
      venue: fixtureForm.venue.trim() || t.venue || 'TBD',
      dateTime: scheduledAt.toISOString(),
      overs: parseInt(fixtureForm.overs, 10) || t.overs,
      settings: DEFAULT_MATCH_SETTINGS,
      status: fixtureForm.status,
      stage: 'league',
      innings: {},
    };
    const nextTeamIds = Array.from(new Set([...enrolledIds, teamA.id, teamB.id]));
    const enrollPatch = nextTeamIds.length !== enrolledIds.length
      ? { teamIds: nextTeamIds, totalTeams: nextTeamIds.length }
      : {};
    try {
      if (editingId) {
        updateMatchLocal(editingId, payload);
        await updateRemoteMatch(editingId, payload);
        if (Object.keys(enrollPatch).length) await persistTournament(enrollPatch);
        showAlert('Updated', 'Fixture saved.');
      } else {
        const createPayload = { ...payload, createdBy: user?.id };
        const ref = await createRemoteMatch(createPayload);
        addMatchLocal({ ...createPayload, id: String(ref.id) });
        await persistTournament({ ...enrollPatch, totalMatches: tourneyMatches.length + 1 });
        showAlert('Scheduled', 'Match added to this tournament.');
      }
      setAddingFixture(false);
      setEditingId(null);
    } catch (e: any) {
      showAlert('Save failed', e?.message || 'Could not save fixture.');
    }
  }

  function editFixture(match: Match) {
    setEditingId(match.id);
    setScheduledAt(new Date(match.dateTime));
    setFixtureForm({
      teamAId: match.teamA,
      teamBId: match.teamB,
      venue: match.venue,
      overs: String(match.overs),
      status: match.status,
    });
    setAddingFixture(true);
  }

  function deleteFixture(id: string) {
    showAlert('Delete fixture', 'Remove this match from the tournament?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          deleteMatchLocal(id);
          try {
            await deleteRemoteMatch(id);
            await persistTournament({ totalMatches: Math.max(0, tourneyMatches.length - 1) });
          } catch {
            showAlert('Sync failed', 'Deleted locally but not on server.');
          }
        },
      },
    ]);
  }

  async function generateRoundRobin() {
    if (enrolledTeams.length < 2) {
      showAlert('Need teams', 'Enroll at least two teams first.');
      return;
    }
    const pairs = buildRoundRobinPairings(enrolledTeams, homeAndAway);
    if (!pairs.length) {
      showAlert('Nothing to generate', 'Could not build pairings.');
      return;
    }
    const gap = Math.max(1, parseInt(hoursApart, 10) || 24);
    const start = defaultKickoff();
    showAlert(
      'Generate schedule',
      `Create ${pairs.length} upcoming match${pairs.length === 1 ? '' : 'es'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            let created = 0;
            try {
              for (let i = 0; i < pairs.length; i++) {
                const p = pairs[i];
                const payload: Omit<Match, 'id'> = {
                  clubId: t.clubId,
                  tournamentId: t.id,
                  matchNumber: tourneyMatches.length + created + 1,
                  teamA: p.teamA.id,
                  teamB: p.teamB.id,
                  teamAName: p.teamA.name,
                  teamBName: p.teamB.name,
                  teamALogo: p.teamA.logoURL,
                  teamBLogo: p.teamB.logoURL,
                  venue: t.venue || 'TBD',
                  dateTime: nextKickoff(start, i, gap).toISOString(),
                  overs: t.overs,
                  settings: DEFAULT_MATCH_SETTINGS,
                  status: 'UPCOMING',
                  stage: 'league',
                  round: p.round,
                  innings: {},
                  createdBy: user?.id,
                };
                const ref = await createRemoteMatch(payload);
                addMatchLocal({ ...payload, id: String(ref.id) });
                created += 1;
              }
              await persistTournament({ totalMatches: tourneyMatches.length + created });
              showAlert('Done', `${created} fixtures created.`);
              setTab('fixtures');
            } catch (e: any) {
              showAlert('Partial failure', e?.message || `Created ${created} before an error.`);
            }
          },
        },
      ],
    );
  }

  const dateLabel = scheduledAt.toLocaleDateString('en-PK', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
  const timeLabel = scheduledAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} label="Tournaments" style={{ marginBottom: 4 }} />
        <Text style={styles.title} numberOfLines={1}>{t.name}</Text>
        <Text style={styles.sub}>
          {t.city ? `${t.city} · ` : ''}{t.format} · {enrolledIds.length} teams · {tourneyMatches.length} matches
        </Text>
        <TouchableOpacity
          style={styles.activeBtn}
          onPress={() => {
            selectTournament(t.id);
            showAlert('Active', `${t.name} is now the active competition.`);
          }}>
          <Text style={styles.activeBtnText}>Set as active</Text>
        </TouchableOpacity>
      </LinearGradient>
      {(t.bannerURL || t.bannerPresetId) ? (
        t.bannerURL ? (
          <Image source={{ uri: t.bannerURL }} style={styles.heroBanner} />
        ) : (
          <TournamentBanner presetId={t.bannerPresetId} compact style={styles.heroBanner} />
        )
      ) : null}

      <View style={styles.tabBarWrap}>
        <View style={styles.tabBarContent}>
          {TABS.map(item => {
            const on = currentTab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setTab(item.key)}
                style={styles.tab}
                activeOpacity={0.8}>
                <Text style={[styles.tabText, on && styles.tabTextOn]}>
                  {item.label}
                </Text>
                <View style={[styles.tabLine, on && styles.tabLineOn]} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {currentTab === 'overview' && (
          <View>
            <Text style={styles.hubTitle}>Organise this tournament</Text>
            <Text style={styles.hint}>Add teams, schedule matches, then follow the points table.</Text>
            {[
              {
                n: '1',
                title: 'Add teams',
                hint: enrolledIds.length ? `${enrolledIds.length} enrolled` : 'Register at least two squads',
                done: enrolledIds.length >= 2,
                tab: 'teams' as Tab,
              },
              {
                n: '2',
                title: 'Schedule matches',
                hint: tourneyMatches.length ? `${tourneyMatches.length} fixtures` : 'Auto-schedule or add one match',
                done: tourneyMatches.length > 0,
                tab: 'fixtures' as Tab,
              },
              {
                n: '3',
                title: 'Points table',
                hint: 'Live standings and NRR',
                done: tableEntries.some(e => e.played > 0),
                tab: 'table' as Tab,
              },
            ].map(step => (
              <TouchableOpacity key={step.n} style={styles.stepRow} onPress={() => setTab(step.tab)} activeOpacity={0.85}>
                <View style={[styles.stepNum, step.done && styles.stepNumOn]}>
                  <Text style={[styles.stepNumText, step.done && styles.stepNumTextOn]}>{step.done ? '✓' : step.n}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.meta}>{step.hint}</Text>
                </View>
                <Text style={styles.link}>Open</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.actionGrid}>
              <HubAction label="Add teams" hint="Enroll squads" onPress={() => setTab('teams')} />
              <HubAction label="Schedule" hint="Fixtures" onPress={() => setTab('fixtures')} />
              <HubAction label="Points table" hint="Standings" onPress={() => setTab('table')} />
            </View>
          </View>
        )}

        {currentTab === 'teams' && (
          <View style={styles.card}>
            <Text style={styles.section}>Add a team</Text>
            <Text style={styles.hint}>Create a squad and enroll it in this tournament.</Text>
            <TextInput style={styles.input} placeholder="Team name *" placeholderTextColor={Colors.textMuted} value={newTeamName} onChangeText={setNewTeamName} />
            <TextInput style={styles.input} placeholder="Short name * (e.g. LIO)" placeholderTextColor={Colors.textMuted} value={newTeamShort} onChangeText={setNewTeamShort} autoCapitalize="characters" />
            <TouchableOpacity disabled={addingTeam || saving} onPress={createAndEnrollTeam} style={{ marginBottom: Spacing.lg }}>
              <LinearGradient colors={Colors.gradGold} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>{addingTeam ? 'Adding…' : 'Add team to tournament'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.section}>Enrolled squads ({enrolledIds.length})</Text>
            <Text style={styles.hint}>Tap a club team to enroll or remove it.</Text>
            {clubTeams.length === 0 && (
              <Text style={styles.empty}>No teams yet — add one above.</Text>
            )}
            {clubTeams.map(team => {
              const on = enrolledIds.includes(team.id);
              return (
                <TouchableOpacity key={team.id} onPress={() => toggleEnroll(team.id)} style={[styles.teamRow, on && styles.teamRowOn]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamName}>{team.name}</Text>
                    <Text style={styles.meta}>{team.shortName}</Text>
                  </View>
                  <Text style={[styles.badge, on && styles.badgeOn]}>{on ? 'ENROLLED' : 'Add'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {currentTab === 'fixtures' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.section}>Auto schedule</Text>
              <Text style={styles.hint}>Build a full round-robin between enrolled teams.</Text>
              <TouchableOpacity onPress={() => setHomeAndAway(v => !v)} style={[styles.chip, homeAndAway && styles.chipOn, { alignSelf: 'flex-start', marginBottom: Spacing.sm }]}>
                <Text style={[styles.chipText, homeAndAway && styles.chipTextOn]}>Home & away (2 legs)</Text>
              </TouchableOpacity>
              <Text style={styles.label}>Hours between kickoffs</Text>
              <TextInput style={styles.input} keyboardType="number-pad" value={hoursApart} onChangeText={setHoursApart} />
              <TouchableOpacity onPress={generateRoundRobin} style={{ marginTop: Spacing.sm }}>
                <LinearGradient colors={Colors.gradPrimary} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Generate round-robin</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                setAddingFixture(v => !v);
                setEditingId(null);
                setFixtureForm(f => {
                  const defaultA = enrolledTeams[0]?.id || clubTeams[0]?.id || '';
                  const defaultB = enrolledTeams[1]?.id
                    || clubTeams.find(c => c.id !== defaultA)?.id
                    || '';
                  return {
                    ...f,
                    venue: t.venue,
                    overs: String(t.overs),
                    teamAId: defaultA,
                    teamBId: defaultB,
                  };
                });
              }}
              style={styles.addBtn}>
              <Text style={styles.addBtnText}>{addingFixture ? 'Cancel' : '+ Schedule match'}</Text>
            </TouchableOpacity>

            {addingFixture && (
              <View style={styles.card}>
                <Text style={styles.section}>{editingId ? 'Edit fixture' : 'New fixture'}</Text>
                <Text style={styles.label}>Team A</Text>
                <TeamPicker
                  teams={fixtureTeamOptions}
                  enrolledIds={enrolledIds}
                  selectedId={fixtureForm.teamAId}
                  onSelect={id => setFixtureForm(f => ({ ...f, teamAId: id }))}
                  onCreateTeam={() => setTab('teams')}
                />
                <Text style={styles.label}>Team B</Text>
                <TeamPicker
                  teams={fixtureTeamOptions}
                  enrolledIds={enrolledIds}
                  selectedId={fixtureForm.teamBId}
                  onSelect={id => setFixtureForm(f => ({ ...f, teamBId: id }))}
                  onCreateTeam={() => setTab('teams')}
                />
                <Text style={styles.label}>Date</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.pickerText}>{dateLabel}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker value={scheduledAt} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} minimumDate={new Date()} onChange={onDateChange} themeVariant="light" />
                )}
                <Text style={styles.label}>Time</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
                  <Text style={styles.pickerText}>{timeLabel}</Text>
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker value={scheduledAt} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onTimeChange} themeVariant="light" />
                )}
                <TextInput style={styles.input} value={fixtureForm.venue} onChangeText={venue => setFixtureForm(f => ({ ...f, venue }))} placeholder="Venue" placeholderTextColor={Colors.textMuted} />
                <TextInput style={styles.input} value={fixtureForm.overs} onChangeText={overs => setFixtureForm(f => ({ ...f, overs }))} keyboardType="number-pad" placeholder="Overs" placeholderTextColor={Colors.textMuted} />
                <TouchableOpacity onPress={submitFixture} style={{ marginTop: Spacing.md }}>
                  <LinearGradient colors={Colors.gradPrimary} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>{editingId ? 'Update fixture' : 'Save fixture'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {tourneyMatches.map(match => (
              <LinearGradient key={match.id} colors={Colors.gradCard} style={styles.matchCard}>
                <Text style={styles.matchTitle}>{match.teamAName} vs {match.teamBName}</Text>
                <Text style={styles.meta}>
                  {match.status} · {new Date(match.dateTime).toLocaleString()}
                </Text>
                <Text style={styles.meta}>{match.venue} · {match.overs} ov</Text>
                {match.result ? <Text style={styles.result}>{match.result}</Text> : null}
                <View style={styles.matchActions}>
                  {(match.status === 'UPCOMING' || match.status === 'LIVE') && (
                    <TouchableOpacity onPress={() => navigation.navigate('AdminLiveScoring', { matchId: match.id })}>
                      <Text style={styles.link}>Score</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => navigation.navigate('MatchCenter', { matchId: match.id })}>
                    <Text style={styles.link}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => editFixture(match)}><Text style={styles.link}>Edit</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteFixture(match.id)}><Text style={[styles.link, { color: Colors.loss }]}>Delete</Text></TouchableOpacity>
                </View>
              </LinearGradient>
            ))}
            {tourneyMatches.length === 0 && <Text style={styles.empty}>No fixtures yet. Auto-schedule or add a match.</Text>}
          </View>
        )}

        {currentTab === 'table' && (
          <PremiumPointsTable
            entries={tableEntries}
            title={tournament.name}
            subtitle={`${tournament.format} · ${enrolledIds.length || tableEntries.length} teams · Friendlies excluded`}
            emptyText="Enroll teams to see standings."
            onShare={() => shareText('Points table', pointsTableShareMessage(tournament, tableEntries))}
            onPressTeam={teamId => navigation.navigate('TeamProfile', { teamId })}
          />
        )}
      </ScrollView>
    </View>
  );
}

function HubAction({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.hubAction} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.hubActionLabel}>{label}</Text>
      <Text style={styles.hubActionHint}>{hint}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingTop: 50, paddingBottom: Spacing.base, paddingHorizontal: Spacing.base },
  title: { color: Colors.onPrimary, fontSize: Typography.xxl, fontWeight: '800' },
  sub: { color: Colors.onPrimary, opacity: 0.92, marginTop: 4, textTransform: 'capitalize', fontWeight: '600' },
  activeBtn: { alignSelf: 'flex-start', marginTop: Spacing.sm, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', backgroundColor: 'rgba(255,255,255,0.16)' },
  activeBtnText: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.xs },
  heroBanner: { width: '100%', height: 140 },
  tabBarWrap: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  tabBarContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: Spacing.base,
    paddingRight: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingTop: 14,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tabText: {
    color: Colors.textMuted,
    fontWeight: '700',
    fontSize: Typography.sm,
    marginBottom: 10,
  },
  tabTextOn: { color: Colors.primary, fontWeight: '800' },
  tabLine: {
    height: 2,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
    borderRadius: 1,
  },
  tabLineOn: { backgroundColor: Colors.primary },
  body: { padding: Spacing.base, paddingBottom: 100 },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.base, marginBottom: Spacing.base },
  section: { color: Colors.textPrimary, fontWeight: '800', fontSize: Typography.lg, marginBottom: Spacing.sm },
  label: { color: Colors.textSecondary, fontWeight: '700', marginTop: Spacing.sm, marginBottom: 4, fontSize: Typography.sm },
  input: { backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, color: Colors.textPrimary, padding: Spacing.md, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  chipText: { color: Colors.textSecondary, fontWeight: '700', fontSize: Typography.xs },
  chipTextOn: { color: Colors.primary },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  primaryBtn: { paddingVertical: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  hint: { color: Colors.textMuted, fontSize: Typography.sm, marginBottom: Spacing.sm },
  link: { color: Colors.primary, fontWeight: '700' },
  teamRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: 6, backgroundColor: Colors.bgElevated },
  teamRowOn: { borderColor: Colors.primary + '66', backgroundColor: Colors.primary + '14' },
  teamName: { color: Colors.textPrimary, fontWeight: '800' },
  meta: { color: Colors.textSecondary, fontSize: Typography.xs, marginTop: 2 },
  badge: { color: Colors.textMuted, fontWeight: '800', fontSize: Typography.xs },
  badgeOn: { color: Colors.primary },
  addBtn: { alignSelf: 'flex-start', marginBottom: Spacing.sm, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.primary + '22', borderWidth: 1, borderColor: Colors.primary + '55' },
  addBtnText: { color: Colors.primary, fontWeight: '800' },
  pickerBtn: { backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  pickerText: { color: Colors.textPrimary, fontWeight: '700' },
  matchCard: { padding: Spacing.base, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  matchTitle: { color: Colors.textPrimary, fontWeight: '800', fontSize: Typography.base },
  result: { color: Colors.win, marginTop: 4, fontWeight: '700' },
  matchActions: { flexDirection: 'row', gap: 16, marginTop: Spacing.sm },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rank: { width: 22, color: Colors.textMuted, fontWeight: '800' },
  pts: { color: Colors.textPrimary, fontWeight: '800', width: 52, textAlign: 'right' },
  nrr: { color: Colors.textSecondary, width: 56, textAlign: 'right', fontSize: Typography.xs },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.lg },
  hubTitle: { color: Colors.textPrimary, fontWeight: '900', fontSize: Typography.xl, marginBottom: 6 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  stepNumText: { color: Colors.textSecondary, fontWeight: '900' },
  stepNumTextOn: { color: Colors.onPrimary },
  stepTitle: { color: Colors.textPrimary, fontWeight: '800' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  hubAction: {
    width: '31%',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  hubActionLabel: { color: Colors.textPrimary, fontWeight: '800', fontSize: Typography.sm },
  hubActionHint: { color: Colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: '700' },
});
