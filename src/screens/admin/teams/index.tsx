import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, StatusBar, Image } from 'react-native';
import BackButton from '../../../components/BackButton';
import { showAlert } from '../../../components/PremiumAlert';
import { SkeletonEntityList } from '../../../components/Skeleton';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import {
  useTeamsStore,
  usePointsTableStore,
  useAuthStore,
  useScopeStore,
  useScopeLabels,
  usePlayersStore,
  useClubsStore,
  useHubStore,
} from '../../../store';
import { Team, PointsTableEntry } from '../../../types';
import {
  addTeam as addRemoteTeam,
  deleteTeam as deleteRemoteTeam,
  deletePlayer as deleteRemotePlayer,
  updateTeam as updateRemoteTeam,
  uploadImage,
  listenUserTeams,
} from '../../../firebase';
import { isUsersOwnTeam } from '../../../utils/account';
import { isLocalImageUri } from '../../../services/cloudinary';
import { randomPremiumTeamLogo } from '../../../utils/defaultLogo';
import TeamLogoAvatar from '../../../components/TeamLogoAvatar';

const BRAND_COLORS = [
  { primary: '#00E5FF', secondary: '#00838F', name: 'Cyan' },
  { primary: '#FFD600', secondary: '#FF8F00', name: 'Gold' },
  { primary: '#FF1744', secondary: '#B71C1C', name: 'Crimson' },
  { primary: '#00C853', secondary: '#1B5E20', name: 'Green' },
  { primary: '#2979FF', secondary: '#0D47A1', name: 'Blue' },
  { primary: '#AA00FF', secondary: '#4A148C', name: 'Purple' },
];

function uniqueTeams(rows: Team[]): Team[] {
  const seen = new Set<string>();
  return rows.filter(t => {
    if (!t?.id || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

export default function AdminTeamsScreen({ navigation }: any) {
  const localTeams = useTeamsStore(state => state.teams);
  const localTeamsReady = useTeamsStore(state => state.ready);
  const hubTeams = useHubStore(state => state.teams);
  const hubReady = useHubStore(state => state.ready);
  const updateTeam = useTeamsStore(state => state.updateTeam);
  const deleteTeam = useTeamsStore(state => state.deleteTeam);

  const addPTEntry = usePointsTableStore(state => state.addEntry);
  const deletePTEntry = usePointsTableStore(state => state.deleteEntry);
  const selectedClubId = useScopeStore(state => state.selectedClubId);
  const selectedTournamentId = useScopeStore(state => state.selectedTournamentId);
  const { subtitle } = useScopeLabels();

  const user = useAuthStore(state => state.user);
  const clubs = useClubsStore(state => state.clubs);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [userTeamsReady, setUserTeamsReady] = useState(false);

  useEffect(() => {
    if (!user) {
      showAlert('Sign in', 'Sign in to manage teams.');
      navigation.replace('Main');
      return;
    }
    const unsub = listenUserTeams(user.id, teams => {
      setUserTeams(teams);
      setUserTeamsReady(true);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [user, navigation]);

  const myTeams = useMemo(() => {
    if (!user) return [];
    const merged = uniqueTeams([...userTeams, ...localTeams, ...hubTeams]);
    return merged.filter(team => isUsersOwnTeam(user, team, clubs));
  }, [user, userTeams, localTeams, hubTeams, clubs]);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    shortName: '',
    captain: '',
    coach: '',
    owner: '',
    logoURL: '',
    colorIndex: 0,
  });

  function handlePickLogo() {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        showAlert('Error', response.errorMessage);
        return;
      }
      const asset = response.assets?.[0];
      if (asset?.uri) {
        setForm(prev => ({ ...prev, logoURL: asset.uri || '' }));
      }
    });
  }

  async function handleAdd() {
    if (!selectedClubId) {
      showAlert('Not ready', 'Wait for data to finish loading, then try again.');
      return;
    }
    if (!form.name || !form.shortName) {
      showAlert('Error', 'Team name and short name are required.');
      return;
    }

    const selectedColor = BRAND_COLORS[form.colorIndex];

    let logoURL = form.logoURL || undefined;
    if (isLocalImageUri(logoURL)) {
      try {
        setUploading(true);
        logoURL = await uploadImage(logoURL!, `teams/${Date.now()}.jpg`);
      } catch (error: any) {
        showAlert('Logo upload failed', error?.message || 'Could not upload image to Cloudinary.');
        return;
      } finally {
        setUploading(false);
      }
    }
    if (!logoURL) {
      logoURL = randomPremiumTeamLogo(`${form.shortName} ${form.name}`);
    }

    if (editingId) {
      const existingTeam = myTeams.find(t => t.id === editingId);
      if (existingTeam && !isUsersOwnTeam(user, existingTeam, clubs)) {
        showAlert('Permission Denied', 'You can only edit teams that you created.');
        return;
      }
      // Update existing team
      updateTeam(editingId, {
        name: form.name,
        shortName: form.shortName.toUpperCase(),
        captain: form.captain || 'TBD',
        coach: form.coach || 'TBD',
        owner: form.owner || 'TBD',
        logoURL,
        primaryColor: selectedColor.primary,
        secondaryColor: selectedColor.secondary,
      });

      try {
        await updateRemoteTeam(editingId, {
          name: form.name, shortName: form.shortName.toUpperCase(), captain: form.captain || 'TBD',
          coach: form.coach || 'TBD', owner: form.owner || 'TBD', logoURL,
          primaryColor: selectedColor.primary, secondaryColor: selectedColor.secondary,
        });
      } catch {
        showAlert('Sync Failed', 'The team could not be saved to Firebase.');
        return;
      }

      showAlert('Success', `Team "${form.name}" updated!`);
      setEditingId(null);
    } else {
      // Create new team
      const teamPayload: Omit<Team, 'id'> = {
        clubId: selectedClubId,
        createdBy: user?.id,
        name: form.name,
        shortName: form.shortName.toUpperCase(),
        captain: form.captain || 'TBD',
        viceCaptain: 'TBD',
        coach: form.coach || 'TBD',
        owner: form.owner || user?.name || 'TBD',
        homeGround: 'Club Ground',
        logoURL,
        primaryColor: selectedColor.primary,
        secondaryColor: selectedColor.secondary,
        playerIds: [],
        stats: {
          played: 0,
          won: 0,
          lost: 0,
          nr: 0,
          nrr: 0,
          points: 0,
        },
      };
      let newTeamId: string;
      try {
        const reference = await addRemoteTeam(teamPayload);
        newTeamId = reference.id;
        // The Realtime Database listener updates the store. Do not append
        // here as that would render the same document twice.
      } catch {
        showAlert('Save Failed', 'The team could not be saved to Firebase.');
        return;
      }

      // Create matching Points Table entry
      const ptEntry: PointsTableEntry = {
        clubId: selectedClubId,
        tournamentId: selectedTournamentId || undefined,
        teamId: newTeamId,
        teamName: form.name,
        shortName: form.shortName.toUpperCase(),
        teamLogo: logoURL,
        played: 0,
        won: 0,
        lost: 0,
        nr: 0,
        nrr: 0,
        points: 0,
        lastFive: [],
      };
      addPTEntry(ptEntry);

      showAlert('Success', `Team "${form.name}" added!`);
    }

    setAdding(false);
    setForm({ name: '', shortName: '', captain: '', coach: '', owner: '', logoURL: '', colorIndex: 0 });
  }

  function handleEdit(team: Team) {
    if (!isUsersOwnTeam(user, team, clubs)) {
      showAlert('Permission Denied', 'You can only edit teams that you created.');
      return;
    }
    const cIndex = BRAND_COLORS.findIndex(c => c.primary === team.primaryColor);
    setForm({
      name: team.name,
      shortName: team.shortName,
      captain: team.captain,
      coach: team.coach,
      owner: team.owner,
      logoURL: team.logoURL || '',
      colorIndex: cIndex >= 0 ? cIndex : 0,
    });
    setEditingId(team.id);
    setAdding(true);
  }

  function handleDelete(team: Team) {
    if (!isUsersOwnTeam(user, team, clubs)) {
      showAlert('Permission Denied', 'You can only delete teams that you created.');
      return;
    }
    showAlert(
      'Delete Team',
      `Are you sure you want to delete ${team.name}? This will also remove their squad players.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const squad = usePlayersStore.getState().players.filter(p => p.teamId === team.id);
          deleteTeam(team.id);
          deletePTEntry(team.id);
          setUserTeams(prev => prev.filter(t => t.id !== team.id));
          squad.forEach(p => usePlayersStore.getState().deletePlayer(p.id));
          try {
            await deleteRemoteTeam(team.id);
            await Promise.all(squad.map(p => deleteRemotePlayer(p.id).catch(() => undefined)));
          } catch {
            showAlert('Sync Failed', 'The team could not be deleted from Firebase.');
          }
        }}
      ]
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} label="Dashboard" style={{ marginBottom: 4 }} />
        <Text style={styles.headerTitle}>{editingId ? 'Edit Team' : 'Manage Teams'}</Text>
        <TouchableOpacity onPress={() => { setAdding(a => !a); setEditingId(null); }}>
          <LinearGradient colors={Colors.gradPrimary} style={styles.addBtn}>
            <Text style={styles.addBtnText}>{adding ? '✕ Cancel' : '+ Add Team'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      {!localTeamsReady && !hubReady && !userTeamsReady ? (
        <SkeletonEntityList count={6} />
      ) : (
      <ScrollView contentContainerStyle={{ padding: Spacing.base, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {adding && (
          <LinearGradient colors={Colors.gradCard} style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'Edit team' : 'New team'}</Text>
            
            {/* Logo Selector */}
            <View style={styles.logoField}>
              <TouchableOpacity style={styles.logoBox} onPress={handlePickLogo}>
                {form.logoURL ? (
                  <Image source={{ uri: form.logoURL }} style={styles.logoPreview} />
                ) : (
                  <Text style={{ fontSize: 24 }}>🏏</Text>
                )}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.logoTitle}>Team logo</Text>
                <TouchableOpacity onPress={handlePickLogo}>
                  <Text style={styles.logoBtnText}>Choose Logo Image ›</Text>
                </TouchableOpacity>
                <Text style={styles.logoHint}>Optional — skip and a cricket crest logo is assigned automatically.</Text>
              </View>
            </View>

            {[
              { key: 'name', label: 'Team Name', placeholder: 'e.g. City Strikers' },
              { key: 'shortName', label: 'Short Name', placeholder: 'e.g. CST' },
              { key: 'captain', label: 'Captain', placeholder: 'Player name' },
              { key: 'coach', label: 'Coach', placeholder: 'Coach name' },
              { key: 'owner', label: 'Manager', placeholder: 'Manager name' },
            ].map(f => (
              <View key={f.key} style={styles.field}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={f.placeholder}
                  placeholderTextColor={Colors.textMuted}
                  value={form[f.key as keyof typeof form] as string}
                  onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                />
              </View>
            ))}

            {/* Brand Colors */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Theme Color Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
                {BRAND_COLORS.map((bc, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setForm(prev => ({ ...prev, colorIndex: idx }))}
                    style={[styles.colorChip, form.colorIndex === idx && { borderColor: '#fff', borderWidth: 2 }]}
                  >
                    <View style={[styles.colorChipDot, { backgroundColor: bc.primary }]} />
                    <Text style={styles.colorChipText}>{bc.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity onPress={handleAdd} disabled={uploading}>
              <LinearGradient colors={Colors.gradPrimary} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>
                  {uploading ? 'Uploading logo…' : editingId ? 'Save Changes' : 'Create team'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {myTeams.length === 0 ? (
          <View style={styles.emptyView}>
            <Text style={styles.emptyText}>No teams created yet.</Text>
            <Text style={styles.emptySub}>Tap “+ Add Team” to create and manage your own squads.</Text>
          </View>
        ) : (
          myTeams.map(team => (
            <LinearGradient key={team.id} colors={Colors.gradCard} style={styles.teamCard}>
              <TeamLogoAvatar
                name={team.name}
                shortName={team.shortName}
                logoURL={team.logoURL}
                size={44}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.teamName}>{team.name}</Text>
                <Text style={styles.teamMeta}>{team.shortName}{team.owner ? ` · ${team.owner}` : ''}</Text>
                <Text style={styles.teamCoach}>Coach: {team.coach} | Captain: {team.captain}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(team)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(team)}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          ))
        )}
      </ScrollView>
      )}
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
  logoField: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.base },
  logoBox: { width: 60, height: 60, borderRadius: Radius.md, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  logoPreview: { width: '100%', height: '100%', borderRadius: Radius.md },
  logoTitle: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
  logoBtnText: { fontSize: Typography.xs, color: Colors.primary, marginTop: 4, fontWeight: '600' },
  logoHint: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 4 },
  field: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, padding: Spacing.md, color: Colors.textPrimary, fontSize: Typography.sm, borderWidth: 1, borderColor: Colors.border },
  colorChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.bgElevated, gap: 6, borderWidth: 1, borderColor: Colors.border },
  colorChipDot: { width: 10, height: 10, borderRadius: 5 },
  colorChipText: { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: '600' },
  submitBtn: { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  submitBtnText: { fontSize: Typography.base, fontWeight: '800', color: Colors.onPrimary },
  teamCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  teamLogo: { width: 44, height: 44, borderRadius: 22 },
  fallbackLogo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fallbackLogoText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  teamName: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },
  teamMeta: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  teamCoach: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  editBtn: { backgroundColor: Colors.primary + '22', paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.sm },
  editBtnText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: '700' },
  deleteBtn: { backgroundColor: Colors.loss + '22', paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.sm },
  deleteBtnText: { fontSize: Typography.xs, color: Colors.loss, fontWeight: '700' },
  emptyView: { padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.xl },
  emptyText: { color: Colors.textPrimary, fontSize: Typography.base, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: Colors.textSecondary, fontSize: Typography.xs, textAlign: 'center', marginTop: 4 },
});
