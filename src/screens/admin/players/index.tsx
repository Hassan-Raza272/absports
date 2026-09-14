import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, StatusBar, Image } from 'react-native';
import BackButton from '../../../components/BackButton';
import { showAlert } from '../../../components/PremiumAlert';
import { SkeletonEntityList } from '../../../components/Skeleton';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import { usePlayersStore, useTeamsStore, useAuthStore, useScopeStore } from '../../../store';
import { Player, PlayerRole, BattingStyle, BowlingStyle } from '../../../types';
import { addPlayer as addRemotePlayer, deletePlayer as deleteRemotePlayer, updatePlayer as updateRemotePlayer, uploadImage } from '../../../firebase';
import { isLocalImageUri } from '../../../services/cloudinary';

export default function AdminPlayersScreen({ navigation }: any) {
  const players = usePlayersStore(state => state.players);
  const playersReady = usePlayersStore(state => state.ready);
  const updatePlayer = usePlayersStore(state => state.updatePlayer);
  const deletePlayer = usePlayersStore(state => state.deletePlayer);
  const teams = useTeamsStore(state => state.teams);
  const selectedClubId = useScopeStore(state => state.selectedClubId);

  const user = useAuthStore(state => state.user);
  useEffect(() => {
    if (!user) {
      showAlert('Sign in', 'Sign in to manage players.');
      navigation.replace('Main');
    }
  }, [user, navigation]);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    teamId: '',
    jerseyNumber: '',
    role: 'Batter' as PlayerRole,
    battingStyle: 'Right-hand Bat' as BattingStyle,
    bowlingStyle: 'N/A' as BowlingStyle,
    nationality: '',
    photoURL: '',
  });

  function handlePickPhoto() {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        showAlert('Error', response.errorMessage);
        return;
      }
      const asset = response.assets?.[0];
      if (asset?.uri) {
        setForm(prev => ({ ...prev, photoURL: asset.uri || '' }));
      }
    });
  }

  async function handleSubmit() {
    if (!form.name || !form.jerseyNumber) {
      showAlert('Error', 'Player name and jersey number are required.');
      return;
    }

    const selectedTeamId = form.teamId || teams[0]?.id;
    if (!selectedTeamId) {
      showAlert('Error', 'Please register at least one team in this club before adding players.');
      return;
    }
    if (!selectedClubId) {
      showAlert('Not ready', 'Wait for data to finish loading, then try again.');
      return;
    }

    const team = teams.find(t => t.id === selectedTeamId);
    const teamName = team ? team.name : 'Unassigned';

    let photoURL = form.photoURL || undefined;
    if (isLocalImageUri(photoURL)) {
      try {
        setUploading(true);
        photoURL = await uploadImage(photoURL!, `players/${Date.now()}.jpg`);
      } catch (error: any) {
        showAlert('Photo upload failed', error?.message || 'Could not upload image to Cloudinary.');
        return;
      } finally {
        setUploading(false);
      }
    }

    const playerPayload = {
      clubId: selectedClubId,
      name: form.name,
      teamId: selectedTeamId,
      teamName,
      jerseyNumber: parseInt(form.jerseyNumber, 10) || 0,
      role: form.role,
      battingStyle: form.battingStyle,
      bowlingStyle: form.bowlingStyle,
      nationality: form.nationality,
      photoURL,
      dateOfBirth: '2000-01-01',
      battingStats: {
        matches: 0, innings: 0, runs: 0, balls: 0, notOuts: 0,
        highScore: 0, average: 0, strikeRate: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0
      },
      bowlingStats: {
        innings: 0, overs: 0, maidens: 0, runs: 0, wickets: 0, economy: 0, average: 0, bestFigures: '-', fourWickets: 0, fiveWickets: 0
      },
      fieldingStats: { catches: 0, stumpings: 0, runOuts: 0 }
    };

    if (editingId) {
      updatePlayer(editingId, playerPayload);
      try {
        await updateRemotePlayer(editingId, playerPayload);
      } catch {
        showAlert('Sync Failed', 'The player could not be saved to Firebase.');
        return;
      }
      showAlert('Success', 'Player profile updated!');
      setEditingId(null);
    } else {
      try {
        await addRemotePlayer(playerPayload);
        // The Realtime Database listener adds the document to the store;
        // adding it again would create duplicate React keys.
      } catch {
        showAlert('Save Failed', 'The player could not be saved to Firebase.');
        return;
      }
      showAlert('Success', 'Player registered to this club!');
      setAdding(false);
    }

    // Reset Form
    setForm({
      name: '',
      teamId: '',
      jerseyNumber: '',
      role: 'Batter',
      battingStyle: 'Right-hand Bat',
      bowlingStyle: 'N/A',
      nationality: '',
      photoURL: '',
    });
  }

  function handleEdit(player: Player) {
    setEditingId(player.id);
    setForm({
      name: player.name,
      teamId: player.teamId,
      jerseyNumber: String(player.jerseyNumber),
      role: player.role,
      battingStyle: player.battingStyle,
      bowlingStyle: player.bowlingStyle,
      nationality: player.nationality,
      photoURL: player.photoURL || '',
    });
    setAdding(true);
  }

  function handleDelete(id: string) {
    showAlert('Delete Player', 'Are you sure you want to release and delete this player profile?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        deletePlayer(id);
        try { await deleteRemotePlayer(id); } catch { showAlert('Sync Failed', 'The player could not be deleted from Firebase.'); }
      } }
    ]);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} label="Dashboard" style={{ marginBottom: 4 }} />
        <Text style={styles.headerTitle}>{editingId ? 'Edit player' : 'Manage players'}</Text>
        <TouchableOpacity onPress={() => { setAdding(a => !a); setEditingId(null); }}>
          <LinearGradient colors={Colors.gradPrimary} style={styles.addBtn}>
            <Text style={styles.addBtnText}>{adding ? '✕ Cancel' : '+ Add Player'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      {!playersReady ? (
        <SkeletonEntityList count={7} />
      ) : (
      <ScrollView contentContainerStyle={{ padding: Spacing.base, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {adding && (
          <LinearGradient colors={Colors.gradCard} style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? 'Edit player' : 'Add player'}</Text>

            {/* Photo Selector */}
            <View style={styles.photoField}>
              <TouchableOpacity style={styles.photoBox} onPress={handlePickPhoto}>
                {form.photoURL ? (
                  <Image source={{ uri: form.photoURL }} style={styles.photoPreview} />
                ) : (
                  <Text style={{ fontSize: 24 }}>👤</Text>
                )}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoTitle}>Player Photograph</Text>
                <TouchableOpacity onPress={handlePickPhoto}>
                  <Text style={styles.photoBtnText}>Select Device Photo ›</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Player Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Player name"
                placeholderTextColor={Colors.textMuted}
                value={form.name}
                onChangeText={v => setForm(prev => ({ ...prev, name: v }))}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Jersey Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 10"
                keyboardType="number-pad"
                placeholderTextColor={Colors.textMuted}
                value={form.jerseyNumber}
                onChangeText={v => setForm(prev => ({ ...prev, jerseyNumber: v }))}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Select Team</Text>
              {teams.length === 0 ? (
                <Text style={{ color: Colors.loss, fontSize: Typography.xs, fontWeight: '700' }}>⚠️ Please create a team first!</Text>
              ) : (
                <View style={styles.selectorRow}>
                  {teams.map(t => {
                    const isSelected = form.teamId === t.id || (!form.teamId && teams[0]?.id === t.id);
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setForm(prev => ({ ...prev, teamId: t.id }))}
                        style={[styles.selectorChip, isSelected && { borderColor: t.primaryColor, backgroundColor: t.primaryColor + '22' }]}
                      >
                        <Text style={[styles.selectorText, isSelected && { color: t.primaryColor, fontWeight: '700' }]}>{t.shortName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Playing Role</Text>
              <View style={styles.selectorRow}>
                {(['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'] as PlayerRole[]).map(role => (
                  <TouchableOpacity
                    key={role}
                    onPress={() => setForm(prev => ({ ...prev, role }))}
                    style={[styles.selectorChip, form.role === role && styles.selectorChipActive]}
                  >
                    <Text style={[styles.selectorText, form.role === role && styles.selectorTextActive]}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Batting Hand</Text>
              <View style={styles.selectorRow}>
                {(['Right-hand Bat', 'Left-hand Bat'] as BattingStyle[]).map(style => (
                  <TouchableOpacity
                    key={style}
                    onPress={() => setForm(prev => ({ ...prev, battingStyle: style }))}
                    style={[styles.selectorChip, form.battingStyle === style && styles.selectorChipActive]}
                  >
                    <Text style={[styles.selectorText, form.battingStyle === style && styles.selectorTextActive]}>{style.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Bowling Action</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
                {([
                  'N/A', 'Right-arm Fast', 'Right-arm Medium', 'Right-arm Off-spin',
                  'Right-arm Leg-spin', 'Left-arm Fast', 'Left-arm Spin'
                ] as BowlingStyle[]).map(style => (
                  <TouchableOpacity
                    key={style}
                    onPress={() => setForm(prev => ({ ...prev, bowlingStyle: style }))}
                    style={[styles.selectorChip, form.bowlingStyle === style && styles.selectorChipActive]}
                  >
                    <Text style={[styles.selectorText, form.bowlingStyle === style && styles.selectorTextActive]}>{style}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity onPress={handleSubmit} disabled={uploading}>
              <LinearGradient colors={Colors.gradPrimary} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>
                  {uploading ? 'Uploading photo…' : editingId ? 'Save Changes' : 'Register Player'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {players.length === 0 ? (
          <View style={styles.emptyView}>
            <Text style={styles.emptyText}>No players registered yet.</Text>
            <Text style={styles.emptySub}>Tap "+ Add Player" to register your squad members!</Text>
          </View>
        ) : (
          players.map(player => (
            <LinearGradient key={player.id} colors={Colors.gradCard} style={styles.playerCard}>
              {player.photoURL ? (
                <Image source={{ uri: player.photoURL }} style={styles.playerPhoto} />
              ) : (
                <View style={styles.fallbackPhoto}>
                  <Text style={{ fontSize: 18 }}>👤</Text>
                </View>
              )}
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name} <Text style={{ color: Colors.accent }}>#{player.jerseyNumber}</Text></Text>
                <Text style={styles.playerMeta}>{player.teamName} • {player.role}</Text>
                <Text style={styles.playerStyle}>{player.battingStyle} • {player.bowlingStyle}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(player)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(player.id)}>
                  <Text style={styles.deleteBtnText}>✕</Text>
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
  photoField: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.base },
  photoBox: { width: 60, height: 60, borderRadius: Radius.md, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  photoPreview: { width: '100%', height: '100%', borderRadius: Radius.md },
  photoTitle: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
  photoBtnText: { fontSize: Typography.xs, color: Colors.primary, marginTop: 4, fontWeight: '600' },
  field: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 6, fontWeight: '700' },
  input: { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, padding: Spacing.md, color: Colors.textPrimary, fontSize: Typography.sm, borderWidth: 1, borderColor: Colors.border },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  selectorChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgElevated },
  selectorChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  selectorText: { fontSize: Typography.xs, color: Colors.textSecondary },
  selectorTextActive: { color: Colors.primary, fontWeight: '700' },
  submitBtn: { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  submitBtnText: { fontSize: Typography.base, fontWeight: '800', color: Colors.onPrimary },
  playerCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  playerPhoto: { width: 44, height: 44, borderRadius: 22 },
  fallbackPhoto: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  playerInfo: { flex: 1 },
  playerName: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },
  playerMeta: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  playerStyle: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  editBtn: { backgroundColor: Colors.primary + '22', paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.sm },
  editBtnText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: '700' },
  deleteBtn: { backgroundColor: Colors.loss + '22', paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.sm },
  deleteBtnText: { fontSize: Typography.xs, color: Colors.loss, fontWeight: '700' },
  emptyView: { padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.xl },
  emptyText: { color: Colors.textPrimary, fontSize: Typography.base, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: Colors.textSecondary, fontSize: Typography.xs, textAlign: 'center', marginTop: 4 },
});
