import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { ALL_TOURNAMENTS_ID } from '../constants/scope';
import { useAuthStore, useScopeStore, useTournamentsStore } from '../store';

type Props = {
  visible: boolean;
  onClose: () => void;
  onManageTournaments?: () => void;
};

export default function ScopePicker({ visible, onClose, onManageTournaments }: Props) {
  const tournaments = useTournamentsStore(s => s.tournaments);
  const selectedTournamentId = useScopeStore(s => s.selectedTournamentId);
  const selectTournament = useScopeStore(s => s.selectTournament);
  const user = useAuthStore(s => s.user);
  const canManage = !!user;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Competition</Text>
          <Text style={styles.sub}>Pick a tournament to filter matches, teams, and points.</Text>
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.row} onPress={() => selectTournament(ALL_TOURNAMENTS_ID)}>
              <View style={[styles.mark, selectedTournamentId === ALL_TOURNAMENTS_ID && styles.markOn]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>All matches + friendlies</Text>
                <Text style={styles.meta}>Every game in this view</Text>
              </View>
            </TouchableOpacity>
            {tournaments.map(tournament => (
              <TouchableOpacity key={tournament.id} style={styles.row} onPress={() => selectTournament(tournament.id)}>
                <View style={[styles.mark, tournament.id === selectedTournamentId && styles.markOn]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{tournament.name}</Text>
                  <Text style={styles.meta}>{tournament.format} · {tournament.season}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {canManage && (
            <View style={styles.manage}>
              <TouchableOpacity onPress={onManageTournaments}><Text style={styles.link}>+ Tournament</Text></TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={onClose} style={styles.done}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.base,
    paddingBottom: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  title: { color: Colors.textPrimary, fontWeight: '900', fontSize: Typography.lg },
  sub: { color: Colors.textSecondary, fontSize: Typography.sm, marginBottom: Spacing.md, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  mark: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  markOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  name: { color: Colors.textPrimary, fontWeight: '800' },
  meta: { color: Colors.textSecondary, fontSize: Typography.xs, marginTop: 2 },
  manage: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.md },
  link: { color: Colors.primary, fontWeight: '800' },
  done: { marginTop: Spacing.md, alignItems: 'center', padding: Spacing.md },
  doneText: { color: Colors.textSecondary, fontWeight: '800' },
});
