import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import ScreenScaffold from '../../components/ScreenScaffold';
import EmptyState from '../../components/EmptyState';
import PremiumIcon from '../../components/PremiumIcon';
import { showAlert } from '../../components/PremiumAlert';
import { useAuthStore } from '../../store';
import { updateUserProfile, uploadImage } from '../../firebase';
import { isLocalImageUri } from '../../services/cloudinary';

export default function AccountProfileScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const [name, setName] = useState(user?.name || '');
  const [photoUri, setPhotoUri] = useState(user?.photoURL || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setPhotoUri(user.photoURL || '');
  }, [user?.id]);

  if (!user) {
    return (
      <ScreenScaffold title="Profile" showScope={false} subtitle="Your AB Sports account">
        <EmptyState title="Sign in required" subtitle="Create a free account to keep teams and matches." actionLabel="Signup" onAction={() => navigation.navigate('Signup')} />
      </ScreenScaffold>
    );
  }

  const account = user;
  const dirty = name.trim() !== (account.name || '') || photoUri !== (account.photoURL || '');

  function applyPickedAsset(uri?: string) {
    if (uri) setPhotoUri(uri);
  }

  function handlePickPhoto() {
    showAlert('Profile picture', 'Update the photo on your AB Sports account.', [
      {
        text: 'Take photo',
        onPress: () => {
          launchCamera({ mediaType: 'photo', quality: 0.8, cameraType: 'front' }, response => {
            if (response.didCancel) return;
            if (response.errorMessage) {
              showAlert('Camera', response.errorMessage);
              return;
            }
            applyPickedAsset(response.assets?.[0]?.uri);
          });
        },
      },
      {
        text: 'Choose from gallery',
        onPress: () => {
          launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, response => {
            if (response.didCancel) return;
            if (response.errorMessage) {
              showAlert('Gallery', response.errorMessage);
              return;
            }
            applyPickedAsset(response.assets?.[0]?.uri);
          });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function saveProfile() {
    if (!name.trim()) {
      showAlert('Name required', 'Enter a display name.');
      return;
    }
    if (!photoUri) {
      showAlert('Profile picture required', 'Please add a profile picture.');
      return;
    }

    setSaving(true);
    try {
      const patch: { name: string; photoURL?: string } = { name: name.trim() };
      if (isLocalImageUri(photoUri)) {
        patch.photoURL = await uploadImage(photoUri, `users/${Date.now()}.jpg`);
      } else if (photoUri !== account.photoURL) {
        patch.photoURL = photoUri;
      }

      await updateUserProfile(account.id, patch);
      setUser({ ...account, ...patch });
      if (patch.photoURL) setPhotoUri(patch.photoURL);
      showAlert('Saved', 'Your profile has been updated.');
    } catch (e: any) {
      showAlert('Save failed', e?.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScaffold title="Profile" showScope={false} subtitle={user.email}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={Colors.gradCard} style={styles.hero}>
          <TouchableOpacity style={styles.avatarWrap} onPress={handlePickPhoto} disabled={saving} activeOpacity={0.85}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.initial}>{(name || account.name || '?').slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <PremiumIcon name="camera" size={14} color={Colors.onPrimary} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickPhoto} disabled={saving}>
            <Text style={styles.changePhoto}>{photoUri ? 'Change photo' : 'Add photo'}</Text>
          </TouchableOpacity>
          <Text style={styles.name}>{name.trim() || account.name}</Text>
          <Text style={styles.meta}>{account.email}</Text>
          <Text style={styles.role}>{account.role === 'public' ? 'Player / fan' : account.role}</Text>
        </LinearGradient>

        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={Colors.textMuted}
          editable={!saving}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving || !dirty}>
          <LinearGradient colors={Colors.gradPrimary} style={[styles.saveGrad, (!dirty || saving) && styles.saveGradDisabled]}>
            {saving ? (
              <View style={styles.savingRow}>
                <ActivityIndicator color={Colors.onPrimary} />
                <Text style={styles.saveText}>Saving…</Text>
              </View>
            ) : (
              <Text style={styles.saveText}>Save profile</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('MyMatches')}>
          <Text style={styles.rowText}>My Matches</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('MyTournaments')}>
          <Text style={styles.rowText}>My Tournaments</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('MyTeams')}>
          <Text style={styles.rowText}>My Teams</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.base, paddingBottom: 40 },
  hero: { alignItems: 'center', padding: Spacing.lg, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg },
  avatarWrap: { width: 96, height: 96 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.primary + '22', borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgCard,
  },
  initial: { color: Colors.primary, fontWeight: '900', fontSize: 32 },
  changePhoto: { color: Colors.primary, fontWeight: '800', fontSize: Typography.xs, marginTop: Spacing.sm },
  name: { color: Colors.textPrimary, fontWeight: '900', fontSize: Typography.xl, marginTop: Spacing.sm },
  meta: { color: Colors.textSecondary, marginTop: 2 },
  role: { color: Colors.primary, fontWeight: '800', marginTop: 6, textTransform: 'capitalize' },
  label: { color: Colors.textMuted, fontWeight: '800', fontSize: 11, marginBottom: 6 },
  input: { backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, color: Colors.textPrimary, padding: Spacing.md },
  saveBtn: { marginTop: Spacing.md, marginBottom: Spacing.lg, height: 48, borderRadius: Radius.md, overflow: 'hidden' },
  saveGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  saveGradDisabled: { opacity: 0.45 },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  saveText: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.base },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowText: { color: Colors.textPrimary, fontWeight: '700' },
});
