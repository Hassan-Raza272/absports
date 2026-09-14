import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, StatusBar, Platform } from 'react-native';
import BackButton from '../../../components/BackButton';
import { showAlert } from '../../../components/PremiumAlert';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import { useAuthStore, useMatchesStore, useScopeStore, useTeamsStore } from '../../../store';
import { createMatch as createRemoteMatch } from '../../../firebase';
import MatchSettingsForm from '../../../components/MatchSettingsForm';
import { DEFAULT_MATCH_SETTINGS } from '../../../utils/matchSettings';
import { MatchSettings } from '../../../types';

function startOfDay(d: Date) {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function defaultKickoff() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30, 0, 0);
  return d;
}

export default function AdminQuickMatchScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user);
  const teams = useTeamsStore(s => s.teams);
  const addMatch = useMatchesStore(s => s.addMatch);
  const selectedClubId = useScopeStore(s => s.selectedClubId);

  useEffect(() => {
    if (!user) {
      showAlert('Sign in', 'Sign in to start a match.');
      navigation.replace('Signup');
    }
  }, [user, navigation]);

  const [teamAId, setTeamAId] = useState(teams[0]?.id || '');
  const [teamBId, setTeamBId] = useState(teams[1]?.id || '');
  const [customA, setCustomA] = useState('');
  const [customB, setCustomB] = useState('');
  const [venue, setVenue] = useState('Local Ground');
  const [overs, setOvers] = useState('20');
  const [settings, setSettings] = useState<MatchSettings>(DEFAULT_MATCH_SETTINGS);
  const [scheduledAt, setScheduledAt] = useState(defaultKickoff);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const isToday = startOfDay(scheduledAt).getTime() === todayStart.getTime();

  const dateLabel = scheduledAt.toLocaleDateString('en-PK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeLabel = scheduledAt.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  function onDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    const next = new Date(scheduledAt);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    if (startOfDay(next).getTime() < todayStart.getTime()) {
      showAlert('Invalid date', 'Match date cannot be in the past.');
      return;
    }
    // If switching to today and time is already past, bump time ahead of now.
    if (startOfDay(next).getTime() === todayStart.getTime() && next.getTime() <= Date.now()) {
      const bump = defaultKickoff();
      next.setHours(bump.getHours(), bump.getMinutes(), 0, 0);
    }
    setScheduledAt(next);
  }

  function onTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (event.type === 'dismissed' || !selected) return;
    const next = new Date(scheduledAt);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    if (startOfDay(next).getTime() === todayStart.getTime() && next.getTime() <= Date.now()) {
      showAlert('Invalid time', 'Match time must be later than the current time.');
      return;
    }
    setScheduledAt(next);
  }

  async function handleStart() {
    if (!selectedClubId) {
      showAlert('Not ready', 'Wait for data to finish loading, then try again.');
      return;
    }
    const teamA = teams.find(t => t.id === teamAId);
    const teamB = teams.find(t => t.id === teamBId);
    const teamAName = customA.trim() || teamA?.name || '';
    const teamBName = customB.trim() || teamB?.name || '';
    if (!teamAName || !teamBName || teamAName === teamBName) {
      showAlert('Teams required', 'Pick two squads or type two custom team names.');
      return;
    }
    if (startOfDay(scheduledAt).getTime() < todayStart.getTime()) {
      showAlert('Invalid date', 'Match date cannot be in the past.');
      return;
    }
    if (scheduledAt.getTime() <= Date.now()) {
      showAlert('Invalid time', 'Match time must be later than the current time.');
      return;
    }
    try {
      const payload = {
        clubId: selectedClubId,
        matchNumber: Date.now() % 10000,
        teamA: teamAId || `custom-a-${Date.now()}`,
        teamB: teamBId || `custom-b-${Date.now()}`,
        teamAName,
        teamBName,
        teamALogo: teamA?.logoURL,
        teamBLogo: teamB?.logoURL,
        venue,
        dateTime: scheduledAt.toISOString(),
        overs: parseInt(overs, 10) || 20,
        settings,
        status: 'UPCOMING' as const,
        innings: {},
        createdBy: user?.id,
      };
      const ref = await createRemoteMatch(payload);
      addMatch({ ...payload, id: String(ref.id) });
      navigation.replace('AdminLiveScoring', { matchId: String(ref.id) });
    } catch (error: any) {
      showAlert('Could not start match', error?.message || 'Check Realtime Database rules and try again.');
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} style={{ marginBottom: 4 }} />
        <Text style={styles.title}>Start Match</Text>
        <Text style={styles.sub}>Friendly game — not added to the points table. Works with club squads or custom names.</Text>
      </LinearGradient>
      <ScrollView contentContainerStyle={{ padding: Spacing.base, paddingBottom: 80 }}>
        <Text style={styles.label}>Team A</Text>
        <View style={styles.chips}>
          {teams.map(t => (
            <TouchableOpacity key={`a-${t.id}`} onPress={() => setTeamAId(t.id)} style={[styles.chip, teamAId === t.id && styles.chipOn]}>
              <Text style={[styles.chipText, teamAId === t.id && styles.chipTextOn]}>{t.shortName}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Team B</Text>
        <View style={styles.chips}>
          {teams.map(t => (
            <TouchableOpacity key={`b-${t.id}`} onPress={() => setTeamBId(t.id)} style={[styles.chip, teamBId === t.id && styles.chipOn]}>
              <Text style={[styles.chipText, teamBId === t.id && styles.chipTextOn]}>{t.shortName}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Or type custom names</Text>
        <TextInput style={styles.input} value={customA} onChangeText={setCustomA} placeholder="Team A name" placeholderTextColor={Colors.textMuted} />
        <TextInput style={styles.input} value={customB} onChangeText={setCustomB} placeholder="Team B name" placeholderTextColor={Colors.textMuted} />
        <TextInput style={styles.input} value={venue} onChangeText={setVenue} placeholder="Venue" placeholderTextColor={Colors.textMuted} />
        <TextInput style={styles.input} value={overs} onChangeText={setOvers} keyboardType="number-pad" placeholder="Overs" placeholderTextColor={Colors.textMuted} />

        <Text style={styles.label}>Match date</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.pickerBtnIcon}>📅</Text>
          <Text style={styles.pickerBtnText}>{dateLabel}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={scheduledAt}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={todayStart}
            onChange={onDateChange}
            themeVariant="dark"
          />
        )}
        {Platform.OS === 'ios' && showDatePicker && (
          <TouchableOpacity style={styles.pickerDone} onPress={() => setShowDatePicker(false)}>
            <Text style={styles.pickerDoneText}>Done</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Match time</Text>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
          <Text style={styles.pickerBtnIcon}>🕐</Text>
          <Text style={styles.pickerBtnText}>{timeLabel}</Text>
        </TouchableOpacity>
        {showTimePicker && (
          <DateTimePicker
            value={scheduledAt}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={isToday ? new Date() : undefined}
            onChange={onTimeChange}
            themeVariant="dark"
          />
        )}
        {Platform.OS === 'ios' && showTimePicker && (
          <TouchableOpacity style={styles.pickerDone} onPress={() => setShowTimePicker(false)}>
            <Text style={styles.pickerDoneText}>Done</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.helper}>Must be today or later, and time must be after now.</Text>

        <MatchSettingsForm value={settings} onChange={setSettings} />
        <TouchableOpacity onPress={handleStart} style={{ marginTop: Spacing.lg }}>
          <LinearGradient colors={Colors.gradLive || Colors.gradPrimary} style={styles.startBtn}>
            <Text style={styles.startText}>Start scoring now</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingTop: 50, paddingBottom: Spacing.base, paddingHorizontal: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { color: Colors.onPrimary, fontSize: Typography.xxl, fontWeight: '800' },
  sub: { color: Colors.onPrimary, opacity: 0.92, marginTop: 4, fontWeight: '600' },
  label: { color: Colors.textSecondary, fontWeight: '700', marginTop: Spacing.md, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  chipText: { color: Colors.textSecondary, fontWeight: '700' },
  chipTextOn: { color: Colors.primary },
  input: { marginTop: Spacing.sm, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, color: Colors.textPrimary, padding: Spacing.md },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 10,
  },
  pickerBtnIcon: { fontSize: 18 },
  pickerBtnText: { color: Colors.textPrimary, fontWeight: '700', fontSize: Typography.base },
  pickerDone: { alignSelf: 'flex-end', marginTop: Spacing.xs, paddingVertical: 6, paddingHorizontal: 12 },
  pickerDoneText: { color: Colors.primary, fontWeight: '700' },
  helper: { color: Colors.textMuted, fontSize: Typography.sm, marginTop: 6 },
  startBtn: { paddingVertical: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  startText: { color: '#fff', fontWeight: '800' },
});
