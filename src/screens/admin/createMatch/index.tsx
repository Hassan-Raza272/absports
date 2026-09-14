import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import BackButton from '../../../components/BackButton';
import { showAlert } from '../../../components/PremiumAlert';
import { EaseEnter, EasePress } from '../../../motion';
import { BALL_TYPES, MATCH_KINDS, PITCH_TYPES } from '../../../constants/tournamentSetup';
import { DEFAULT_CLUB_ID } from '../../../constants/scope';
import {
  useAuthStore,
  useMatchesStore,
  usePlayersStore,
  usePublicFeedStore,
  useScopeStore,
  useTeamsStore,
} from '../../../store';
import {
  addPlayer as addRemotePlayer,
  addTeam as addRemoteTeam,
  createMatch as createRemoteMatch,
  deleteTeam as deleteRemoteTeam,
  deletePlayer as deleteRemotePlayer,
  updateTeam as updateRemoteTeam,
  uploadImage,
} from '../../../firebase';
import { isLocalImageUri } from '../../../services/cloudinary';
import { randomPremiumTeamLogo } from '../../../utils/defaultLogo';
import TeamLogoAvatar from '../../../components/TeamLogoAvatar';
import { DEFAULT_MATCH_SETTINGS } from '../../../utils/matchSettings';
import { BallType, MatchSettings, PitchType, Team, TournamentMatchKind } from '../../../types';

type Step = 'pickTeams' | 'browse' | 'setup' | 'squad';
type BrowseTab = 'yours' | 'opponents' | 'add';
type Side = 'A' | 'B';

type PickedTeam = {
  id: string;
  name: string;
  shortName: string;
  logoURL?: string;
  primaryColor: string;
  city?: string;
  captain?: string;
};

function defaultKickoff() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30, 0, 0);
  return d;
}

function startOfDay(d: Date) {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function toPicked(team: Team): PickedTeam {
  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    logoURL: team.logoURL,
    primaryColor: team.primaryColor || Colors.accentBlue,
    city: team.homeGround,
    captain: team.captain,
  };
}

export default function CreateMatchScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user);
  const teams = useTeamsStore(s => s.teams);
  const addTeamLocal = useTeamsStore(s => s.addTeam);
  const updateTeamLocal = useTeamsStore(s => s.updateTeam);
  const deleteTeamLocal = useTeamsStore(s => s.deleteTeam);
  const players = usePlayersStore(s => s.players);
  const deletePlayerLocal = usePlayersStore(s => s.deletePlayer);
  const addMatch = useMatchesStore(s => s.addMatch);
  const localMatches = useMatchesStore(s => s.matches);
  const publicUpcoming = usePublicFeedStore(s => s.upcomingMatches);
  const selectedClubId = useScopeStore(s => s.selectedClubId);
  const clubId = selectedClubId || DEFAULT_CLUB_ID;
  const submittingRef = useRef(false);

  const [step, setStep] = useState<Step>('pickTeams');
  const [pickingSide, setPickingSide] = useState<Side>('A');
  const [browseTab, setBrowseTab] = useState<BrowseTab>('yours');
  const [teamA, setTeamA] = useState<PickedTeam | null>(null);
  const [teamB, setTeamB] = useState<PickedTeam | null>(null);
  const [squadA, setSquadA] = useState<string[]>([]);
  const [squadB, setSquadB] = useState<string[]>([]);
  const [squadSide, setSquadSide] = useState<Side>('A');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const [matchKind, setMatchKind] = useState<TournamentMatchKind>('limited');
  const [overs, setOvers] = useState('20');
  const [oversPerBowler, setOversPerBowler] = useState('4');
  const [city, setCity] = useState('');
  const [ground, setGround] = useState('');
  const [ballType, setBallType] = useState<BallType>('tennis');
  const [pitchType, setPitchType] = useState<PitchType | ''>('');
  const [wagonWheel, setWagonWheel] = useState(true);
  const [scheduledAt, setScheduledAt] = useState(defaultKickoff);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [settings] = useState<MatchSettings>(DEFAULT_MATCH_SETTINGS);

  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCity, setNewTeamCity] = useState('');
  const [newTeamCaptain, setNewTeamCaptain] = useState('');
  const [newTeamPhone, setNewTeamPhone] = useState('');
  const [newTeamLogoUri, setNewTeamLogoUri] = useState('');
  const [addSelf, setAddSelf] = useState(true);
  const [creatingTeam, setCreatingTeam] = useState(false);

  const [newPlayerName, setNewPlayerName] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);

  const alreadyOnTeam = useMemo(() => {
    if (!user?.name) return null;
    const me = user.name.trim().toLowerCase();
    const existing = players.find(p => p.name.trim().toLowerCase() === me);
    if (!existing) return null;
    const team = teams.find(t => t.id === existing.teamId);
    return { player: existing, team };
  }, [user?.name, players, teams]);

  const canAddSelf = !alreadyOnTeam;
  const addSelfEffective = addSelf && canAddSelf;

  useEffect(() => {
    if (!user) {
      showAlert('Sign in', 'Sign in to create a match.');
      navigation.replace('Login');
    }
  }, [user, navigation]);

  useEffect(() => {
    if (alreadyOnTeam && addSelf) setAddSelf(false);
  }, [alreadyOnTeam, addSelf]);

  const todayStart = useMemo(() => startOfDay(new Date()), []);

  const yourTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter(t => {
      if (!q) return true;
      return `${t.name} ${t.shortName} ${t.captain} ${t.homeGround}`.toLowerCase().includes(q);
    });
  }, [teams, query]);

  const activeTeam = squadSide === 'A' ? teamA : teamB;
  const squadPlayers = useMemo(() => {
    if (!activeTeam) return [];
    const q = query.trim().toLowerCase();
    return players
      .filter(p => p.teamId === activeTeam.id)
      .filter(p => !q || p.name.toLowerCase().includes(q));
  }, [players, activeTeam, query]);

  const selectedSquad = squadSide === 'A' ? squadA : squadB;
  const setSelectedSquad = squadSide === 'A' ? setSquadA : setSquadB;

  const dateLabel = scheduledAt.toLocaleString('en-PK', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  function openBrowse(side: Side) {
    setPickingSide(side);
    setBrowseTab('yours');
    setQuery('');
    setStep('browse');
  }

  function selectTeam(team: Team, initialSquad?: string[]) {
    const picked = toPicked(team);
    if (pickingSide === 'A') {
      if (teamB?.id === picked.id) {
        showAlert('Same team', 'Team A and Team B must be different.');
        return;
      }
      setTeamA(picked);
      if (team.homeGround && !city) setCity(team.homeGround);
      if (initialSquad) {
        setSquadA(initialSquad);
      } else {
        setSquadA(prev => {
          if (prev.length) return prev;
          return players.filter(p => p.teamId === team.id).map(p => p.name);
        });
      }
    } else {
      if (teamA?.id === picked.id) {
        showAlert('Same team', 'Team A and Team B must be different.');
        return;
      }
      setTeamB(picked);
      if (initialSquad) {
        setSquadB(initialSquad);
      } else {
        setSquadB(prev => {
          if (prev.length) return prev;
          return players.filter(p => p.teamId === team.id).map(p => p.name);
        });
      }
    }
    const nextA = pickingSide === 'A' ? picked : teamA;
    const nextB = pickingSide === 'B' ? picked : teamB;
    setStep(nextA && nextB ? 'setup' : 'pickTeams');
  }

  function handleDeleteTeam(team: Team) {
    showAlert(
      'Delete team',
      `Remove ${team.name} and its squad from AB Sports? Past match history is kept, but this squad can no longer be selected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const squad = players.filter(p => p.teamId === team.id);
            if (teamA?.id === team.id) {
              setTeamA(null);
              setSquadA([]);
            }
            if (teamB?.id === team.id) {
              setTeamB(null);
              setSquadB([]);
            }
            deleteTeamLocal(team.id);
            squad.forEach(p => deletePlayerLocal(p.id));
            try {
              await deleteRemoteTeam(team.id);
              await Promise.all(squad.map(p => deleteRemotePlayer(p.id).catch(() => undefined)));
            } catch {
              showAlert('Sync failed', 'Team removed on this device, but Firebase could not delete it.');
            }
          },
        },
      ],
    );
  }

  function handlePickTeamLogo() {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, response => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        showAlert('Gallery', response.errorMessage);
        return;
      }
      const uri = response.assets?.[0]?.uri;
      if (uri) setNewTeamLogoUri(uri);
    });
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim()) {
      showAlert('Team name required', 'Enter a team name.');
      return;
    }
    if (newTeamPhone.trim() && newTeamPhone.trim().length !== 11) {
      showAlert('Invalid number', 'Captain/coordinator number must be 11 digits.');
      return;
    }
    if (!clubId) {
      showAlert('Not ready', 'Wait for data to finish loading, then try again.');
      return;
    }
    if (addSelf && !canAddSelf && alreadyOnTeam?.team) {
      showAlert(
        'Already on a team',
        `You are already in ${alreadyOnTeam.team.name}. You can only be in one team.`,
      );
      return;
    }

    setCreatingTeam(true);
    try {
      const shortName = newTeamName
        .trim()
        .split(/\s+/)
        .map(w => w[0] || '')
        .join('')
        .slice(0, 3)
        .toUpperCase() || 'TM';

      let logoURL = newTeamLogoUri.trim();
      if (logoURL && isLocalImageUri(logoURL)) {
        try {
          logoURL = await uploadImage(logoURL, `teams/${Date.now()}.jpg`);
        } catch (error: any) {
          showAlert('Logo upload failed', error?.message || 'Could not upload image. A cricket crest will be used instead.');
          logoURL = '';
        }
      }
      if (!logoURL) {
        logoURL = randomPremiumTeamLogo(`${shortName} ${newTeamName.trim()}`);
      }

      const captainName = (newTeamCaptain.trim() || (addSelfEffective ? user?.name : '') || 'TBD').trim();

      const payload: Omit<Team, 'id'> = {
        clubId,
        name: newTeamName.trim(),
        shortName,
        captain: captainName,
        viceCaptain: 'TBD',
        coach: 'TBD',
        owner: user?.name || 'TBD',
        homeGround: newTeamCity.trim() || 'TBD',
        logoURL,
        primaryColor: Colors.accentBlue,
        secondaryColor: Colors.primaryDark,
        playerIds: [],
        stats: { played: 0, won: 0, lost: 0, nr: 0, nrr: 0, points: 0 },
      };
      const ref = await addRemoteTeam(payload);
      const created: Team = { ...payload, id: String(ref.id) };
      addTeamLocal(created);

      const emptyBat = {
        matches: 0, innings: 0, runs: 0, balls: 0, notOuts: 0,
        highScore: 0, average: 0, strikeRate: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0,
      };
      const emptyBowl = {
        innings: 0, overs: 0, maidens: 0, runs: 0, wickets: 0,
        economy: 0, average: 0, bestFigures: '-', fourWickets: 0, fiveWickets: 0,
      };
      const emptyField = { catches: 0, stumpings: 0, runOuts: 0 };

      async function createSquadPlayer(name: string, jerseyNumber: number) {
        const playerRef = await addRemotePlayer({
          clubId,
          name,
          teamId: created.id,
          teamName: created.name,
          jerseyNumber,
          role: 'All-rounder',
          battingStyle: 'Right-hand Bat',
          bowlingStyle: 'N/A',
          nationality: '',
          dateOfBirth: '2000-01-01',
          battingStats: emptyBat,
          bowlingStats: emptyBowl,
          fieldingStats: emptyField,
        });
        return String(playerRef.id);
      }

      const playerIds: string[] = [];
      const squadNames: string[] = [];
      const namesToAdd: string[] = [];

      // Captain always joins the squad when named
      if (captainName && captainName !== 'TBD') {
        namesToAdd.push(captainName);
      }
      // Current user only if checkbox on and not already on another team
      if (addSelfEffective && user?.name) {
        const me = user.name.trim();
        if (!namesToAdd.some(n => n.toLowerCase() === me.toLowerCase())) {
          namesToAdd.push(me);
        }
      }

      for (let i = 0; i < namesToAdd.length; i++) {
        try {
          const id = await createSquadPlayer(namesToAdd[i], i + 1);
          playerIds.push(id);
          squadNames.push(namesToAdd[i]);
        } catch {
          // Keep creating remaining players
        }
      }

      if (playerIds.length) {
        updateTeamLocal(created.id, { playerIds });
        await updateRemoteTeam(created.id, { playerIds });
      }

      setNewTeamName('');
      setNewTeamCity('');
      setNewTeamCaptain('');
      setNewTeamPhone('');
      setNewTeamLogoUri('');
      selectTeam(created, squadNames);
    } catch (e: any) {
      showAlert('Could not create team', e?.message || 'Try again.');
    } finally {
      setCreatingTeam(false);
    }
  }

  function onDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    const next = new Date(scheduledAt);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    if (startOfDay(next).getTime() < todayStart.getTime()) {
      showAlert('Invalid date', 'Match date cannot be in the past.');
      return;
    }
    setScheduledAt(next);
  }

  function onTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    const next = new Date(scheduledAt);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setScheduledAt(next);
  }

  function openSquad(side: Side) {
    setSquadSide(side);
    setQuery('');
    setNewPlayerName('');
    setStep('squad');
  }

  function toggleSquadPlayer(name: string) {
    setSelectedSquad(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]));
  }

  function selectAllSquad() {
    setSelectedSquad(squadPlayers.map(p => p.name));
  }

  async function handleAddPlayer() {
    if (!activeTeam || !newPlayerName.trim()) {
      showAlert('Name required', 'Enter a player name.');
      return;
    }
    setAddingPlayer(true);
    try {
      const ref = await addRemotePlayer({
        clubId,
        name: newPlayerName.trim(),
        teamId: activeTeam.id,
        teamName: activeTeam.name,
        jerseyNumber: 0,
        role: 'Batter',
        battingStyle: 'Right-hand Bat',
        bowlingStyle: 'N/A',
        nationality: '',
        dateOfBirth: '2000-01-01',
        battingStats: {
          matches: 0, innings: 0, runs: 0, balls: 0, notOuts: 0,
          highScore: 0, average: 0, strikeRate: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0,
        },
        bowlingStats: {
          innings: 0, overs: 0, maidens: 0, runs: 0, wickets: 0,
          economy: 0, average: 0, bestFigures: '-', fourWickets: 0, fiveWickets: 0,
        },
        fieldingStats: { catches: 0, stumpings: 0, runOuts: 0 },
      });
      const name = newPlayerName.trim();
      setSelectedSquad(prev => (prev.includes(name) ? prev : [...prev, name]));
      setNewPlayerName('');
      // Listener adds player to store; ensure team playerIds updated
      const existing = teams.find(t => t.id === activeTeam.id)?.playerIds || [];
      const nextIds = Array.from(new Set([...existing, String(ref.id)]));
      updateTeamLocal(activeTeam.id, { playerIds: nextIds });
      await updateRemoteTeam(activeTeam.id, { playerIds: nextIds });
    } catch (e: any) {
      showAlert('Could not add player', e?.message || 'Try again.');
    } finally {
      setAddingPlayer(false);
    }
  }

  async function submitMatch(mode: 'schedule' | 'toss') {
    if (submittingRef.current || saving) return;

    if (!teamA || !teamB) {
      showAlert('Teams required', 'Select both playing teams.');
      return;
    }
    if (squadA.length < 2) {
      showAlert(
        'Squad too small',
        `${teamA.shortName || teamA.name} needs at least 2 players. Add or select players, then try again.`,
        [{ text: 'Select squad', onPress: () => openSquad('A') }, { text: 'Cancel', style: 'cancel' }],
      );
      return;
    }
    if (squadB.length < 2) {
      showAlert(
        'Squad too small',
        `${teamB.shortName || teamB.name} needs at least 2 players. Add or select players, then try again.`,
        [{ text: 'Select squad', onPress: () => openSquad('B') }, { text: 'Cancel', style: 'cancel' }],
      );
      return;
    }
    if (!ground.trim()) {
      showAlert('Ground required', 'Enter the ground name.');
      return;
    }
    if (!city.trim()) {
      showAlert('City required', 'Enter the city or town.');
      return;
    }
    if (startOfDay(scheduledAt).getTime() < todayStart.getTime()) {
      showAlert('Invalid date', 'Match date cannot be in the past.');
      return;
    }

    const venue = `${ground.trim()}, ${city.trim()}`;
    const kickoff = scheduledAt.getTime();
    // Block near-duplicates (double-tap / re-schedule) for the same fixture within ~36h.
    const DUPE_WINDOW_MS = 36 * 60 * 60 * 1000;
    const existing = [...localMatches, ...publicUpcoming].find(m => {
      if (m.status !== 'UPCOMING' && m.status !== 'LIVE') return false;
      const sameTeams =
        (m.teamA === teamA.id && m.teamB === teamB.id) ||
        (m.teamA === teamB.id && m.teamB === teamA.id);
      if (!sameTeams) return false;
      const sameVenue = (m.venue || '').trim().toLowerCase() === venue.toLowerCase();
      if (!sameVenue) return false;
      const when = new Date(m.dateTime).getTime();
      return Number.isFinite(when) && Math.abs(when - kickoff) < DUPE_WINDOW_MS;
    });
    if (existing) {
      showAlert(
        'Match already scheduled',
        'This fixture is already on the board. Open it instead of creating another copy.',
        [
          { text: 'Open match', onPress: () => navigation.replace('MatchCenter', { matchId: existing.id }) },
          { text: 'OK', style: 'cancel' },
        ],
      );
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    const dateTimeIso = new Date(kickoff).toISOString();
    try {
      const payload = {
        clubId,
        matchNumber: Date.now() % 10000,
        teamA: teamA.id,
        teamB: teamB.id,
        teamAName: teamA.name,
        teamBName: teamB.name,
        teamALogo: teamA.logoURL,
        teamBLogo: teamB.logoURL,
        venue,
        dateTime: dateTimeIso,
        overs: parseInt(overs, 10) || 20,
        settings: {
          ...settings,
          ballsPerOver: matchKind === 'hundred' ? 5 : settings.ballsPerOver,
        },
        status: 'UPCOMING' as const,
        innings: {},
        createdBy: user?.id,
        playingXI: {
          teamA: squadA,
          teamB: squadB,
        },
      };
      const ref = await createRemoteMatch(payload);
      const id = String(ref.id);
      addMatch({ ...payload, id });
      if (mode === 'toss') {
        navigation.replace('AdminLiveScoring', { matchId: id });
      } else {
        navigation.replace('MyMatches');
        showAlert('Match scheduled', `${teamA.shortName} vs ${teamB.shortName} is on your fixtures.`);
      }
    } catch (e: any) {
      submittingRef.current = false;
      setSaving(false);
      showAlert('Could not create match', e?.message || 'Check connection and try again.');
    }
  }

  function confirmSquad() {
    if (selectedSquad.length < 2) {
      showAlert(
        'Need 2 players',
        `Select or add at least 2 players for ${activeTeam?.shortName || activeTeam?.name || 'this team'} before continuing.`,
      );
      return;
    }
    setStep('setup');
  }

  function headerTitle() {
    if (step === 'browse') return pickingSide === 'A' ? 'Select team A' : 'Select team B';
    if (step === 'setup') return 'Start a match';
    if (step === 'squad') return activeTeam?.shortName || activeTeam?.name || 'Select squad';
    return 'Select playing teams';
  }

  function onBack() {
    if (step === 'browse') {
      setStep(teamA && teamB ? 'setup' : 'pickTeams');
      return;
    }
    if (step === 'squad') {
      setStep('setup');
      return;
    }
    if (step === 'setup') {
      setStep('pickTeams');
      return;
    }
    navigation.goBack();
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <BackButton onPress={onBack} iconOnly size={22} style={styles.headerIconBtn} hitSlop={8} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerKicker}>AB SPORTS</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle()}</Text>
        </View>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => showAlert('Create match', 'Pick two teams, set overs and venue, then schedule or go to toss.')}
          hitSlop={8}>
          <Icon name="help-circle-outline" size={22} color={Colors.onPrimary} />
        </TouchableOpacity>
      </LinearGradient>

      {step === 'pickTeams' && (
        <LinearGradient colors={['#FFF7F8', '#F3F4F6', '#EEF8F6']} style={styles.pickBody}>
          <EaseEnter index={0}>
            <View style={styles.heroBanner}>
              <View style={styles.heroDot} />
              <Text style={styles.heroBannerText}>Free live scoring · pick your sides</Text>
            </View>
          </EaseEnter>

          <View style={styles.pickCenter}>
            <EaseEnter index={1}>
              <TeamSlot team={teamA} sideLabel="TEAM A" label="Select team A" onPress={() => openBrowse('A')} />
            </EaseEnter>

            <EaseEnter index={2}>
              <View style={styles.vsWrap}>
                <View style={styles.vsLine} />
                <LinearGradient colors={Colors.gradPrimary} style={styles.vsBadge}>
                  <Text style={styles.vsBadgeText}>VS</Text>
                </LinearGradient>
                <View style={styles.vsLine} />
              </View>
            </EaseEnter>

            <EaseEnter index={3}>
              <TeamSlot team={teamB} sideLabel="TEAM B" label="Select team B" onPress={() => openBrowse('B')} />
            </EaseEnter>
          </View>

          {!!teamA && !!teamB && (
            <EaseEnter index={4}>
              <EasePress onPress={() => setStep('setup')} style={styles.continueBtnWrap}>
                <LinearGradient colors={Colors.gradGold} style={styles.continueBtn}>
                  <Text style={styles.continueBtnText}>Continue to match setup</Text>
                  <Icon name="arrow-forward" size={18} color={Colors.onPrimary} />
                </LinearGradient>
              </EasePress>
            </EaseEnter>
          )}
        </LinearGradient>
      )}

      {step === 'browse' && (
        <View style={styles.flex}>
          <View style={styles.tabs}>
            {([
              { key: 'yours' as const, label: 'Your teams' },
              { key: 'opponents' as const, label: 'Opponents' },
              { key: 'add' as const, label: 'Add' },
            ]).map(tab => (
              <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => setBrowseTab(tab.key)}>
                <Text style={[styles.tabText, browseTab === tab.key && styles.tabTextOn]}>{tab.label}</Text>
                {browseTab === tab.key && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>

          {browseTab !== 'add' && (
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Icon name="search-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Quick search"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <TouchableOpacity style={styles.addTeamChip} onPress={() => setBrowseTab('add')}>
                <Text style={styles.addTeamChipText}>+ Add team</Text>
              </TouchableOpacity>
            </View>
          )}

          {browseTab === 'yours' && (
            <ScrollView contentContainerStyle={styles.listPad} showsVerticalScrollIndicator={false}>
              {yourTeams.map(team => (
                <View key={team.id} style={styles.teamCard}>
                  <TouchableOpacity style={styles.teamCardMain} onPress={() => selectTeam(team)} activeOpacity={0.85}>
                    <TeamLogoAvatar name={team.name} shortName={team.shortName} logoURL={team.logoURL} size={48} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.teamCardName} numberOfLines={1}>{team.name}</Text>
                      <View style={styles.teamMetaRow}>
                        <Icon name="location-outline" size={12} color={Colors.textMuted} />
                        <Text style={styles.teamMeta}>{team.homeGround || '—'}</Text>
                        {!!team.captain && team.captain !== 'TBD' && (
                          <>
                            <View style={styles.captainBadge}><Text style={styles.captainBadgeText}>C</Text></View>
                            <Text style={styles.teamMeta}>{team.captain}</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.teamDeleteBtn}
                    onPress={() => handleDeleteTeam(team)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.teamDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {yourTeams.length === 0 && (
                <EmptyTeams
                  message="You haven't added a team yet. Create one to start scoring."
                  onCreate={() => setBrowseTab('add')}
                />
              )}
            </ScrollView>
          )}

          {browseTab === 'opponents' && (
            <ScrollView contentContainerStyle={styles.listPad} showsVerticalScrollIndicator={false}>
              {yourTeams.length === 0 ? (
                <EmptyTeams
                  message="You haven't played a match yet. Start one now and your opponent teams will appear here automatically."
                  onCreate={() => setBrowseTab('add')}
                />
              ) : (
                yourTeams.map(team => (
                  <View key={team.id} style={styles.teamCard}>
                    <TouchableOpacity style={styles.teamCardMain} onPress={() => selectTeam(team)} activeOpacity={0.85}>
                      <TeamLogoAvatar name={team.name} shortName={team.shortName} logoURL={team.logoURL} size={48} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.teamCardName}>{team.name}</Text>
                        <Text style={styles.teamMeta}>{team.homeGround || 'Opponent'}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.teamDeleteBtn}
                      onPress={() => handleDeleteTeam(team)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.teamDeleteText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {browseTab === 'add' && (
            <ScrollView contentContainerStyle={styles.formPad} keyboardShouldPersistTaps="handled">
              <View style={styles.formCard}>
                <TouchableOpacity style={styles.logoPlaceholder} onPress={handlePickTeamLogo} activeOpacity={0.85}>
                  {newTeamLogoUri ? (
                    <Image source={{ uri: newTeamLogoUri }} style={styles.logoPreview} />
                  ) : (
                    <TeamLogoAvatar
                      name={newTeamName.trim() || 'New Team'}
                      shortName={newTeamName.trim() ? undefined : 'AB'}
                      size={96}
                    />
                  )}
                  <View style={styles.logoAdd}><Text style={styles.logoAddText}>{newTeamLogoUri ? 'Change' : 'Add'}</Text></View>
                </TouchableOpacity>
                <Text style={styles.logoLabel}>Team logo</Text>
                <Text style={styles.logoHint}>
                  {newTeamLogoUri
                    ? 'Custom logo selected'
                    : 'Skip this — a cricket crest logo is assigned automatically'}
                </Text>

                <UnderlineField label="Team name*" value={newTeamName} onChangeText={setNewTeamName} placeholder="e.g. City XI" />
                <UnderlineField label="City / town*" value={newTeamCity} onChangeText={setNewTeamCity} placeholder="City" />
                <UnderlineField
                  label="Team captain/coordinator number (optional)"
                  value={newTeamPhone}
                  onChangeText={text => setNewTeamPhone(text.replace(/\D/g, '').slice(0, 11))}
                  placeholder="11-digit phone"
                  keyboardType="phone-pad"
                  maxLength={11}
                  accent
                />
                <UnderlineField
                  label="Team captain name (optional)"
                  value={newTeamCaptain}
                  onChangeText={setNewTeamCaptain}
                  placeholder="Captain"
                />

                <TouchableOpacity
                  style={[styles.checkRow, !canAddSelf && styles.checkRowDisabled]}
                  onPress={() => {
                    if (!canAddSelf) {
                      showAlert(
                        'Already on a team',
                        alreadyOnTeam?.team
                          ? `You are already in ${alreadyOnTeam.team.name}. You can only be added to one team.`
                          : 'You are already on a team. You can only be added to one team.',
                      );
                      return;
                    }
                    setAddSelf(v => !v);
                  }}>
                  <View style={[styles.checkbox, addSelfEffective && styles.checkboxOn, !canAddSelf && styles.checkboxDisabled]}>
                    {addSelfEffective && <Icon name="checkmark" size={14} color={Colors.onPrimary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.checkLabel, !canAddSelf && styles.checkLabelDisabled]}>Add yourself in the team</Text>
                    {!canAddSelf && alreadyOnTeam?.team ? (
                      <Text style={styles.checkHint}>Already in {alreadyOnTeam.team.name}</Text>
                    ) : (
                      <Text style={styles.checkHint}>Captain is always added to the squad</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.footerPrimary} onPress={handleCreateTeam} disabled={creatingTeam}>
                {creatingTeam ? <ActivityIndicator color={Colors.onPrimary} /> : <Text style={styles.footerPrimaryText}>Add team</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      )}

      {step === 'setup' && teamA && teamB && (
        <View style={styles.flex}>
          <ScrollView contentContainerStyle={styles.setupPad} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.setupTeams}>
              <SetupTeam
                team={teamA}
                squadCount={squadA.length}
                onChange={() => openBrowse('A')}
                onSquad={() => openSquad('A')}
              />
              <View style={styles.vsWrapSetup}>
                <LinearGradient colors={Colors.gradPrimary} style={styles.vsBadgeSm}>
                  <Text style={styles.vsBadgeText}>VS</Text>
                </LinearGradient>
              </View>
              <SetupTeam
                team={teamB}
                squadCount={squadB.length}
                onChange={() => openBrowse('B')}
                onSquad={() => openSquad('B')}
              />
            </View>

            <Text style={styles.sectionLabel}>Match type*</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {MATCH_KINDS.map(kind => (
                <TouchableOpacity
                  key={kind.key}
                  style={[styles.kindChip, matchKind === kind.key && styles.kindChipOn]}
                  onPress={() => {
                    setMatchKind(kind.key);
                    if (kind.key === 'hundred') setOvers('100');
                    else if (kind.key === 'limited' && overs === '100') setOvers('20');
                  }}>
                  <Text style={[styles.kindChipText, matchKind === kind.key && styles.kindChipTextOn]}>{kind.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.oversRow}>
              <View style={{ flex: 1 }}>
                <UnderlineField label="No. of overs*" value={overs} onChangeText={setOvers} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <UnderlineField label="Overs per bowler" value={oversPerBowler} onChangeText={setOversPerBowler} keyboardType="number-pad" />
              </View>
            </View>

            <UnderlineField label="City / town*" value={city} onChangeText={setCity} placeholder="City" />
            <UnderlineField label="Ground*" value={ground} onChangeText={setGround} placeholder="Ground name" />

            <Text style={styles.fieldLabel}>Date & time</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateBtnText}>{dateLabel}</Text>
              <Icon name="calendar-outline" size={18} color={Colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dateBtn, { marginTop: 8 }]} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.dateBtnText}>Change time</Text>
              <Icon name="time-outline" size={18} color={Colors.accent} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={scheduledAt}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={todayStart}
                onChange={onDateChange}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={scheduledAt}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onTimeChange}
              />
            )}

            <Text style={styles.sectionLabel}>Ball type</Text>
            <View style={styles.ballRow}>
              {BALL_TYPES.map(b => (
                <TouchableOpacity key={b.key} style={styles.ballItem} onPress={() => setBallType(b.key)}>
                  <View style={[styles.ballCircle, { backgroundColor: b.fill }, ballType === b.key && styles.ballOn]}>
                    <Icon name="baseball-outline" size={22} color={Colors.onPrimary} />
                  </View>
                  <Text style={[styles.ballLabel, ballType === b.key && { color: Colors.textPrimary, fontWeight: '800' }]}>{b.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Show Wagon Wheel for 1s, 2s, & 3s</Text>
              <Switch
                value={wagonWheel}
                onValueChange={setWagonWheel}
                trackColor={{ false: Colors.border, true: Colors.accent + '88' }}
                thumbColor={wagonWheel ? Colors.accent : Colors.bgElevated}
              />
            </View>

            <Text style={styles.sectionLabel}>Pitch type</Text>
            <View style={styles.chipsWrap}>
              {PITCH_TYPES.map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.pitchChip, pitchType === p.key && styles.kindChipOn]}
                  onPress={() => setPitchType(p.key)}>
                  <Text style={[styles.kindChipText, pitchType === p.key && styles.kindChipTextOn]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footerPair}>
            <TouchableOpacity
              style={[styles.footerSecondary, saving && { opacity: 0.55 }]}
              onPress={() => submitMatch('schedule')}
              disabled={saving}>
              <Text style={styles.footerSecondaryText}>{saving ? 'Saving…' : 'Schedule match'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerPrimaryHalf, saving && { opacity: 0.55 }]}
              onPress={() => submitMatch('toss')}
              disabled={saving}>
              {saving ? <ActivityIndicator color={Colors.onPrimary} /> : <Text style={styles.footerPrimaryText}>Next (toss)</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'squad' && activeTeam && (
        <View style={styles.flex}>
          <View style={styles.squadHeader}>
            <Text style={styles.squadTitle}>Select squad (min 2)</Text>
            <TouchableOpacity onPress={selectAllSquad}>
              <Text style={styles.selectAll}>Select all</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.squadHint}>{selectedSquad.length}/2 selected · at least 2 players required</Text>
          <View style={styles.searchRow}>
            <View style={[styles.searchBox, { flex: 1 }]}>
              <Icon name="search-outline" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Quick search"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
          <View style={styles.addPlayerRow}>
            <TextInput
              style={styles.addPlayerInput}
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              placeholder="New player name"
              placeholderTextColor={Colors.textMuted}
            />
            <TouchableOpacity style={styles.addPlayerBtn} onPress={handleAddPlayer} disabled={addingPlayer}>
              {addingPlayer ? <ActivityIndicator color={Colors.onPrimary} /> : (
                <>
                  <Icon name="add-circle-outline" size={18} color={Colors.onPrimary} />
                  <Text style={styles.addPlayerBtnText}>Add player</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.listPad}>
            {squadPlayers.map(p => {
              const on = selectedSquad.includes(p.name);
              return (
                <TouchableOpacity key={p.id} style={[styles.playerCard, on && styles.playerCardOn]} onPress={() => toggleSquadPlayer(p.name)}>
                  {p.photoURL ? (
                    <Image source={{ uri: p.photoURL }} style={styles.playerAvatar} />
                  ) : (
                    <View style={[styles.playerAvatar, styles.playerAvatarFallback]}>
                      <Text style={styles.playerInitials}>{initials(p.name)}</Text>
                    </View>
                  )}
                  <Text style={styles.playerName}>{p.name}</Text>
                  {on && <Icon name="checkmark-circle" size={22} color={Colors.accent} />}
                </TouchableOpacity>
              );
            })}
            {squadPlayers.length === 0 && (
              <Text style={styles.emptySoft}>No players yet — add one above.</Text>
            )}
          </ScrollView>
          <TouchableOpacity style={styles.footerPrimary} onPress={confirmSquad}>
            <Text style={styles.footerPrimaryText}>Next</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function TeamSlot({
  team,
  sideLabel,
  label,
  onPress,
}: {
  team: PickedTeam | null;
  sideLabel: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <View style={[styles.slotCard, team ? styles.slotCardFilled : null]}>
      <Text style={styles.sideLabel}>{sideLabel}</Text>
      <EasePress onPress={onPress} style={styles.slotPress}>
        <View style={[styles.avatarRing, team ? styles.avatarRingOn : null]}>
          {team ? (
            <TeamLogoAvatar name={team.name} shortName={team.shortName} logoURL={team.logoURL} size={92} />
          ) : (
            <LinearGradient colors={['#3A3A3C', '#1C1C1E']} style={styles.addCircle}>
              <View style={styles.addInner}>
                <Icon name="add" size={32} color={Colors.onPrimary} />
              </View>
            </LinearGradient>
          )}
        </View>
      </EasePress>
      {team ? (
        <>
          <Text style={styles.slotName} numberOfLines={1}>{team.shortName || team.name}</Text>
          <Text style={styles.slotSub} numberOfLines={1}>{team.name}</Text>
        </>
      ) : (
        <Text style={styles.slotEmptyHint}>Tap to choose a side</Text>
      )}
      <EasePress onPress={onPress}>
        <LinearGradient
          colors={team ? [Colors.primaryLight, Colors.primary] : Colors.gradGold}
          style={styles.selectBtn}>
          <Text style={styles.selectBtnText} numberOfLines={1}>
            {team ? 'Change team' : label}
          </Text>
        </LinearGradient>
      </EasePress>
    </View>
  );
}

function SetupTeam({
  team,
  squadCount,
  onChange,
  onSquad,
}: {
  team: PickedTeam;
  squadCount: number;
  onChange: () => void;
  onSquad: () => void;
}) {
  return (
    <View style={styles.setupTeam}>
      <TouchableOpacity onPress={onChange} style={styles.setupAvatarWrap}>
        <View style={styles.avatarRingSm}>
          <TeamLogoAvatar name={team.name} shortName={team.shortName} logoURL={team.logoURL} size={68} />
        </View>
      </TouchableOpacity>
      <Text style={styles.setupTeamName} numberOfLines={1}>{team.shortName || team.name}</Text>
      <TouchableOpacity onPress={onSquad}>
        <LinearGradient colors={Colors.gradGold} style={styles.squadBtn}>
          <Text style={styles.squadBtnText}>
            {squadCount >= 2 ? `Squad (${squadCount})` : squadCount ? `Squad (${squadCount}/2)` : 'Select squad'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function EmptyTeams({ message, onCreate }: { message: string; onCreate: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <Icon name="people-outline" size={64} color={Colors.textMuted} />
      <Text style={styles.emptyMsg}>{message}</Text>
      <View style={styles.emptyActions}>
        <TouchableOpacity style={styles.helpOutline} onPress={() => showAlert('Help', 'Create your team, then pick an opponent to start scoring.')}>
          <Text style={styles.helpOutlineText}>Need help?</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.createFilled} onPress={onCreate}>
          <Text style={styles.createFilledText}>Create your team</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function UnderlineField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  accent,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  accent?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={styles.underlineWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.underlineInput, accent && { borderBottomColor: Colors.accent }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  headerCenter: { flex: 1, alignItems: 'center', minWidth: 0 },
  headerKicker: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 2,
  },
  headerTitle: {
    color: Colors.onPrimary,
    fontWeight: '900',
    fontSize: Typography.lg,
  },
  pickBody: { flex: 1 },
  heroBanner: {
    marginTop: Spacing.md,
    marginHorizontal: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.full,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '22',
    alignSelf: 'center',
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  heroBannerText: {
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: Typography.xs,
  },
  pickCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingBottom: 24,
  },
  slotCard: {
    width: '86%',
    maxWidth: 320,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xxl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#1C1C1E',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    gap: 8,
  },
  slotCardFilled: {
    borderColor: Colors.primary + '44',
    shadowColor: Colors.primary,
    shadowOpacity: 0.14,
  },
  sideLabel: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  slotPress: { marginVertical: 4 },
  avatarRing: {
    padding: 4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  avatarRingOn: {
    borderStyle: 'solid',
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  avatarRingSm: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Colors.primary + '55',
  },
  addCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  slotName: { color: Colors.textPrimary, fontWeight: '900', fontSize: Typography.lg },
  slotSub: { color: Colors.textSecondary, fontSize: Typography.xs, fontWeight: '600', marginTop: -2 },
  slotEmptyHint: { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: '600' },
  selectBtn: {
    marginTop: 6,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    minWidth: 180,
    alignItems: 'center',
  },
  selectBtnText: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.sm },
  vsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    width: '70%',
    marginVertical: 2,
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  vsBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  vsBadgeText: {
    color: Colors.onPrimary,
    fontWeight: '900',
    fontSize: Typography.sm,
    letterSpacing: 1,
  },
  continueBtnWrap: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  continueBtn: {
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  continueBtnText: { color: Colors.onPrimary, fontWeight: '900', fontSize: Typography.base },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  tabText: { color: Colors.textMuted, fontWeight: '600', fontSize: Typography.sm },
  tabTextOn: { color: Colors.textPrimary, fontWeight: '800' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '18%',
    right: '18%',
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 42,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: Typography.sm, paddingVertical: 0 },
  addTeamChip: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTeamChipText: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.sm },
  listPad: { padding: Spacing.base, paddingBottom: 40, gap: Spacing.sm },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#1C1C1E',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  teamCardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minWidth: 0,
  },
  teamDeleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.loss + '18',
  },
  teamDeleteText: { color: Colors.loss, fontWeight: '800', fontSize: Typography.xs },
  teamCardName: { color: Colors.textPrimary, fontWeight: '800', fontSize: Typography.base },
  teamMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  teamMeta: { color: Colors.textSecondary, fontSize: Typography.xs },
  captainBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  captainBadgeText: { fontSize: 8, fontWeight: '800', color: Colors.textMuted },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: Spacing.lg },
  emptyMsg: { textAlign: 'center', color: Colors.textPrimary, marginTop: Spacing.lg, lineHeight: 22, fontWeight: '600' },
  emptyActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
  helpOutline: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
    borderRadius: Radius.sm,
  },
  helpOutlineText: { color: Colors.accent, fontWeight: '800' },
  createFilled: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
    borderRadius: Radius.sm,
  },
  createFilledText: { color: Colors.onPrimary, fontWeight: '800' },
  formPad: { padding: Spacing.base, paddingBottom: 100 },
  formCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  logoPlaceholder: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoPreview: { width: '100%', height: '100%' },
  logoAdd: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  logoAddText: { color: Colors.onPrimary, fontWeight: '700', fontSize: 11 },
  logoLabel: { textAlign: 'center', color: Colors.textSecondary, marginTop: 8 },
  logoHint: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  underlineWrap: { marginBottom: Spacing.md },
  fieldLabel: { color: Colors.textSecondary, fontSize: Typography.xs, fontWeight: '600', marginBottom: 4 },
  underlineInput: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: Typography.base,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  checkRowDisabled: { opacity: 0.85 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkboxDisabled: { backgroundColor: Colors.bgElevated, borderColor: Colors.border },
  checkLabel: { color: Colors.textSecondary, fontWeight: '600' },
  checkLabelDisabled: { color: Colors.textMuted },
  checkHint: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  footerPrimary: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.accent,
    height: 50,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerPrimaryText: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.base, letterSpacing: 0.3 },
  footerPrimaryHalf: {
    flex: 1,
    backgroundColor: Colors.accent,
    height: 50,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSecondary: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    height: 50,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSecondaryText: { color: Colors.textSecondary, fontWeight: '800' },
  footerPair: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  setupPad: { padding: Spacing.base, paddingBottom: 24 },
  setupTeams: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', marginBottom: Spacing.lg },
  setupTeam: { alignItems: 'center', width: '38%', gap: 8 },
  setupAvatarWrap: { alignItems: 'center' },
  setupTeamName: { color: Colors.textPrimary, fontWeight: '800' },
  vsWrapSetup: { marginTop: 28, alignItems: 'center', justifyContent: 'center' },
  vsBadgeSm: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  squadBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.lg,
  },
  squadBtnText: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.xs },
  sectionLabel: { color: Colors.textPrimary, fontWeight: '800', marginTop: Spacing.md, marginBottom: Spacing.sm },
  chipsRow: { gap: 8, paddingBottom: 4 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
  },
  kindChipOn: { backgroundColor: Colors.accent },
  kindChipText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 12 },
  kindChipTextOn: { color: Colors.onPrimary },
  pitchChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgElevated,
  },
  oversRow: { flexDirection: 'row', gap: Spacing.md },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 12,
  },
  dateBtnText: { color: Colors.textPrimary, fontWeight: '700' },
  ballRow: { flexDirection: 'row', gap: Spacing.xl, marginBottom: Spacing.sm },
  ballItem: { alignItems: 'center', width: 72 },
  ballCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballOn: { borderWidth: 3, borderColor: Colors.textPrimary },
  ballLabel: { color: Colors.textSecondary, fontSize: Typography.xs, fontWeight: '700', marginTop: 6 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  switchLabel: { flex: 1, color: Colors.textPrimary, fontWeight: '600' },
  squadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
  },
  squadTitle: { color: Colors.textPrimary, fontWeight: '800', fontSize: Typography.base },
  squadHint: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    fontWeight: '600',
    paddingHorizontal: Spacing.base,
    marginTop: 4,
  },
  selectAll: { color: Colors.accent, fontWeight: '800' },
  addPlayerRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  addPlayerInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 42,
    color: Colors.textPrimary,
  },
  addPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    height: 42,
  },
  addPlayerBtnText: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.sm },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerCardOn: { borderColor: Colors.accent, backgroundColor: Colors.accent + '10' },
  playerAvatar: { width: 44, height: 44, borderRadius: 22 },
  playerAvatarFallback: { backgroundColor: Colors.accentBlue, alignItems: 'center', justifyContent: 'center' },
  playerInitials: { color: Colors.onPrimary, fontWeight: '800' },
  playerName: { flex: 1, color: Colors.textPrimary, fontWeight: '700', fontSize: Typography.base },
  emptySoft: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing.xl },
});
