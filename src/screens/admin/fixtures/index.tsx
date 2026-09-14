import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, StatusBar, Platform } from 'react-native';
import BackButton from '../../../components/BackButton';
import { showAlert } from '../../../components/PremiumAlert';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import { useMatchesStore, useTeamsStore, useAuthStore, useScopeStore, useScopeLabels } from '../../../store';
import { Match, MatchSettings, MatchStatus } from '../../../types';
import { createMatch as createRemoteMatch, deleteMatch as deleteRemoteMatch, updateMatch as updateRemoteMatch } from '../../../firebase';
import MatchSettingsForm from '../../../components/MatchSettingsForm';
import { DEFAULT_MATCH_SETTINGS } from '../../../utils/matchSettings';

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AdminFixturesScreen({ navigation }: any) {
  const matches = useMatchesStore(state => state.matches);
  const updateMatch = useMatchesStore(state => state.updateMatch);
  const deleteMatch = useMatchesStore(state => state.deleteMatch);
  const teams = useTeamsStore(state => state.teams);
  const selectedClubId = useScopeStore(state => state.selectedClubId);
  const selectedTournamentId = useScopeStore(state => state.selectedTournamentId);
  const { tournamentName } = useScopeLabels();

  const user = useAuthStore(state => state.user);
  useEffect(() => {
    if (!user) {
      showAlert('Sign in', 'Sign in to schedule a match.');
      navigation.replace('Main');
    }
  }, [user, navigation]);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [form, setForm] = useState({
    teamAId: '',
    teamBId: '',
    teamAName: '',
    teamBName: '',
    venue: '',
    overs: '20',
    status: 'UPCOMING' as MatchStatus,
    umpires: '',
    friendly: false,
  });
  const [settings, setSettings] = useState<MatchSettings>(DEFAULT_MATCH_SETTINGS);

  function onDateChange(_event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (!selected) return;
    const next = new Date(scheduledAt);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    setScheduledAt(next);
  }

  function onTimeChange(_event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (!selected) return;
    const next = new Date(scheduledAt);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setScheduledAt(next);
  }

  function pickTeam(side: 'A' | 'B', teamId: string) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    if (side === 'A') {
      setForm(prev => ({ ...prev, teamAId: teamId, teamAName: team.name }));
    } else {
      setForm(prev => ({ ...prev, teamBId: teamId, teamBName: team.name }));
    }
  }

  async function handleSubmit() {
    const teamAObj = form.teamAId ? teams.find(t => t.id === form.teamAId) : undefined;
    const teamBObj = form.teamBId ? teams.find(t => t.id === form.teamBId) : undefined;
    const teamAName = form.teamAName.trim() || teamAObj?.name || '';
    const teamBName = form.teamBName.trim() || teamBObj?.name || '';

    if (!teamAName || !teamBName) {
      showAlert('Teams required', 'Enter a name for both teams.');
      return;
    }
    if (teamAName.toLowerCase() === teamBName.toLowerCase()) {
      showAlert('Error', 'Team A and Team B cannot be the same.');
      return;
    }
    if (!selectedClubId) {
      showAlert('Not ready', 'Wait for data to finish loading, then try again.');
      return;
    }

    const selectedTeamA = form.teamAId || `custom-a-${Date.now()}`;
    const selectedTeamB = form.teamBId || `custom-b-${Date.now()}`;

    const matchPayload = {
      clubId: selectedClubId,
      tournamentId: form.friendly ? undefined : (selectedTournamentId || undefined),
      settings,
      matchNumber: matches.length + 1,
      teamA: selectedTeamA,
      teamB: selectedTeamB,
      teamAName,
      teamBName,
      teamALogo: teamAObj?.logoURL,
      teamBLogo: teamBObj?.logoURL,
      venue: form.venue.trim() || 'TBD',
      dateTime: scheduledAt.toISOString(),
      overs: parseInt(form.overs, 10) || 20,
      status: form.status,
      innings: {},
      umpires: form.umpires.split(',').map(s => s.trim()).filter(Boolean),
    };

    if (editingId) {
      updateMatch(editingId, matchPayload);
      try {
        await updateRemoteMatch(editingId, matchPayload);
      } catch {
        showAlert('Sync Failed', 'The fixture was changed on this device but could not be saved to Firebase.');
      }
      showAlert('Success', 'Match updated successfully!');
      setEditingId(null);
    } else {
      try {
        await createRemoteMatch({ ...matchPayload, createdBy: user?.id });
        showAlert('Success', form.friendly ? 'Friendly match scheduled (not in points table).' : `Match scheduled in ${tournamentName} and saved to Firebase!`);
        setAdding(false);
      } catch {
        showAlert('Save Failed', 'Could not save the fixture. Check your connection and Realtime Database rules.');
        return;
      }
    }

    setScheduledAt(new Date());
    setForm({
      teamAId: '',
      teamBId: '',
      teamAName: '',
      teamBName: '',
      venue: '',
      overs: '20',
      status: 'UPCOMING',
      umpires: '',
      friendly: false,
    });
    setSettings(DEFAULT_MATCH_SETTINGS);
  }

  function handleEdit(match: Match) {
    setEditingId(match.id);
    setScheduledAt(new Date(match.dateTime));
    setForm({
      teamAId: match.teamA,
      teamBId: match.teamB,
      teamAName: match.teamAName,
      teamBName: match.teamBName,
      venue: match.venue,
      overs: String(match.overs),
      status: match.status,
      umpires: match.umpires ? match.umpires.join(', ') : '',
      friendly: !match.tournamentId,
    });
    setSettings(match.settings || DEFAULT_MATCH_SETTINGS);
    setAdding(true);
  }

  function handleDelete(id: string) {
    showAlert('Delete Match', 'Are you sure you want to cancel and delete this fixture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          deleteMatch(id);
          try {
            await deleteRemoteMatch(id);
          } catch {
            showAlert('Sync Failed', 'The fixture could not be deleted from Firebase.');
          }
        },
      },
    ]);
  }

  const dateLabel = scheduledAt.toLocaleDateString('en-PK', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
  const timeLabel = scheduledAt.toLocaleTimeString('en-PK', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} label="Dashboard" style={{ marginBottom: 4 }} />
        <Text style={styles.headerTitle}>{editingId ? 'Edit match' : 'Schedule match'}</Text>
        <TouchableOpacity onPress={() => { setAdding(a => !a); setEditingId(null); setScheduledAt(new Date()); }}>
          <LinearGradient colors={Colors.gradPrimary} style={styles.addBtn}>
            <Text style={styles.addBtnText}>{adding ? '✕ Cancel' : '+ Schedule'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: Spacing.base, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {adding && (
          <LinearGradient colors={Colors.gradCard} style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'Edit Fixture' : 'Schedule Match'}</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Team A (Home)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter team name"
                placeholderTextColor={Colors.textMuted}
                value={form.teamAName}
                onChangeText={v => setForm(prev => ({ ...prev, teamAName: v, teamAId: '' }))}
              />
              {teams.length > 0 && (
                <View style={[styles.selectorRow, { marginTop: Spacing.xs }]}>
                  {teams.map(t => {
                    const isSelected = form.teamAId === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => pickTeam('A', t.id)}
                        style={[styles.selectorChip, isSelected && { borderColor: t.primaryColor, backgroundColor: t.primaryColor + '22' }]}
                      >
                        <Text style={[styles.selectorText, isSelected && { color: t.primaryColor, fontWeight: '700' }]}>{t.shortName || t.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Team B (Away)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter team name"
                placeholderTextColor={Colors.textMuted}
                value={form.teamBName}
                onChangeText={v => setForm(prev => ({ ...prev, teamBName: v, teamBId: '' }))}
              />
              {teams.length > 0 && (
                <View style={[styles.selectorRow, { marginTop: Spacing.xs }]}>
                  {teams.map(t => {
                    const isSelected = form.teamBId === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => pickTeam('B', t.id)}
                        style={[styles.selectorChip, isSelected && { borderColor: t.primaryColor, backgroundColor: t.primaryColor + '22' }]}
                      >
                        <Text style={[styles.selectorText, isSelected && { color: t.primaryColor, fontWeight: '700' }]}>{t.shortName || t.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Ground / venue</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Community Ground"
                placeholderTextColor={Colors.textMuted}
                value={form.venue}
                onChangeText={v => setForm(prev => ({ ...prev, venue: v }))}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Match Date</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.pickerBtnIcon}>📅</Text>
                <Text style={styles.pickerBtnText}>{dateLabel}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={scheduledAt}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                  themeVariant="dark"
                />
              )}
              {Platform.OS === 'ios' && showDatePicker && (
                <TouchableOpacity style={styles.pickerDone} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Match Time</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.pickerBtnIcon}>🕐</Text>
                <Text style={styles.pickerBtnText}>{timeLabel}</Text>
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={scheduledAt}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onTimeChange}
                  themeVariant="dark"
                />
              )}
              {Platform.OS === 'ios' && showTimePicker && (
                <TouchableOpacity style={styles.pickerDone} onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.helperText}>Selected: {toLocalInput(scheduledAt).replace('T', ' ')}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Overs</Text>
              <TextInput
                style={styles.input}
                placeholder="20"
                keyboardType="number-pad"
                placeholderTextColor={Colors.textMuted}
                value={form.overs}
                onChangeText={v => setForm(prev => ({ ...prev, overs: v }))}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.selectorRow}>
                {(['UPCOMING', 'LIVE', 'COMPLETED'] as MatchStatus[]).map(st => (
                  <TouchableOpacity
                    key={st}
                    onPress={() => setForm(prev => ({ ...prev, status: st }))}
                    style={[styles.selectorChip, form.status === st && styles.selectorChipActive]}
                  >
                    <Text style={[styles.selectorText, form.status === st && styles.selectorTextActive]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Umpires (comma separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Umpire 1, Umpire 2"
                placeholderTextColor={Colors.textMuted}
                value={form.umpires}
                onChangeText={v => setForm(prev => ({ ...prev, umpires: v }))}
              />
            </View>

            <TouchableOpacity
              onPress={() => setForm(prev => ({ ...prev, friendly: !prev.friendly }))}
              style={[styles.selectorChip, form.friendly && styles.selectorChipActive, { alignSelf: 'flex-start', marginBottom: Spacing.sm }]}>
              <Text style={[styles.selectorText, form.friendly && styles.selectorTextActive]}>
                {form.friendly ? 'Friendly (no points)' : 'Tournament match'}
              </Text>
            </TouchableOpacity>
            <MatchSettingsForm value={settings} onChange={setSettings} />

            <TouchableOpacity onPress={handleSubmit}>
              <LinearGradient colors={Colors.gradPrimary} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>{editingId ? 'Save Changes' : 'Schedule Match'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {matches.length === 0 ? (
          <View style={styles.emptyView}>
            <Text style={styles.emptyText}>No matches scheduled yet.</Text>
            <Text style={styles.emptySub}>Tap “+ Schedule” and enter both team names to create a fixture.</Text>
          </View>
        ) : (
          matches.map(match => {
            const date = new Date(match.dateTime);
            return (
              <LinearGradient key={`fx-${match.id}`} colors={Colors.gradCard} style={styles.matchCard}>
                <View style={styles.matchInfo}>
                  <Text style={styles.matchTeams}>{match.teamAName} vs {match.teamBName}</Text>
                  <Text style={styles.matchMeta}>Match {match.matchNumber} • {match.status}</Text>
                  <Text style={styles.matchDetails}>
                    📍 {match.venue.split(',')[0]} • 📅 {date.toLocaleDateString()} • 🕐 {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(match)}>
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(match.id)}>
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: Spacing.base, paddingHorizontal: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: Typography.base, fontWeight: '800', color: Colors.onPrimary },
  addBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full },
  addBtnText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.onPrimary },
  formCard: { borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.base, borderWidth: 1, borderColor: Colors.border },
  formTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md },
  field: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 6, fontWeight: '700' },
  input: { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, padding: Spacing.md, color: Colors.textPrimary, fontSize: Typography.sm, borderWidth: 1, borderColor: Colors.border },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerBtnIcon: { fontSize: 16 },
  pickerBtnText: { color: Colors.textPrimary, fontSize: Typography.sm, fontWeight: '700' },
  pickerDone: { alignSelf: 'flex-end', marginTop: Spacing.xs, paddingVertical: 6, paddingHorizontal: Spacing.md },
  pickerDoneText: { color: Colors.primary, fontWeight: '800' },
  helperText: { marginTop: 6, fontSize: Typography.xs, color: Colors.textMuted },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  selectorChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgElevated },
  selectorChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  selectorText: { fontSize: Typography.xs, color: Colors.textSecondary },
  selectorTextActive: { color: Colors.primary, fontWeight: '700' },
  submitBtn: { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  submitBtnText: { fontSize: Typography.base, fontWeight: '800', color: Colors.onPrimary },
  matchCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  matchInfo: { flex: 1 },
  matchTeams: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },
  matchMeta: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  matchDetails: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  editBtn: { backgroundColor: Colors.primary + '22', paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.sm },
  editBtnText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: '700' },
  deleteBtn: { backgroundColor: Colors.loss + '22', paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.sm },
  deleteBtnText: { fontSize: Typography.xs, color: Colors.loss, fontWeight: '700' },
  emptyView: { padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.xl },
  emptyText: { color: Colors.textPrimary, fontSize: Typography.base, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: Colors.textSecondary, fontSize: Typography.xs, textAlign: 'center', marginTop: 4 },
});
