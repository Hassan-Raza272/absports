import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { useAuthStore } from '../../store';
import { signUp, createUserProfile, uploadImage } from '../../firebase';
import { isLocalImageUri } from '../../services/cloudinary';
import { User, UserRole } from '../../types';
import PremiumIcon from '../../components/PremiumIcon';
import { showAlert } from '../../components/PremiumAlert';

export default function SignupScreen({ navigation }: any) {
  const setUser = useAuthStore(state => state.setUser);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('public');
  const [photoUri, setPhotoUri] = useState('');
  const [loading, setLoading] = useState(false);

  function applyPickedAsset(uri?: string) {
    if (uri) setPhotoUri(uri);
  }

  function handlePickPhoto() {
    showAlert('Profile picture', 'Choose a photo to use on your AB Sports account.', [
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

  async function handleSignup() {
    if (!name || !email || !password) {
      showAlert('Error', 'Please fill in all fields.');
      return;
    }
    if (!photoUri) {
      showAlert('Profile picture required', 'Please add a profile picture to create your account.');
      return;
    }

    setLoading(true);
    try {
      const photoURL = isLocalImageUri(photoUri)
        ? await uploadImage(photoUri, `users/${Date.now()}.jpg`)
        : photoUri;

      const userCredential = await signUp(email.trim(), password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        const profileData = {
          name,
          email: email.trim(),
          role,
          photoURL,
        };

        try {
          await createUserProfile(firebaseUser.uid, profileData);
        } catch (dbError) {
          console.log('Failed to save profile to Realtime Database, proceeding with local context:', dbError);
        }

        const userObj: User = {
          id: firebaseUser.uid,
          name,
          email: firebaseUser.email || email,
          role,
          photoURL,
        };

        setUser(userObj);
        showAlert('Welcome to AB Sports', 'Your account is ready. Create a tournament or discover live matches.');
        navigation.replace('Main');
      }
    } catch (error: any) {
      console.log('Firebase signup failed:', error);
      showAlert('Signup Failed', error.message || 'Make sure details are valid.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={Colors.gradDark} style={styles.gradient}>
          <View style={styles.logoSection}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Create your AB Sports account</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Register</Text>

            <View style={styles.photoSection}>
              <Text style={styles.label}>Profile picture *</Text>
              <TouchableOpacity
                style={styles.photoPicker}
                onPress={handlePickPhoto}
                disabled={loading}
                activeOpacity={0.85}
              >
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <PremiumIcon name="person" size={28} color={Colors.primary} />
                    <Text style={styles.photoHint}>Add photo</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickPhoto} disabled={loading}>
                <Text style={styles.photoChange}>
                  {photoUri ? 'Change photo' : 'Tap to take or choose a photo'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>I am joining as</Text>
              <View style={styles.roleContainer}>
                <TouchableOpacity
                  style={[styles.roleChip, role === 'public' && styles.roleChipActive]}
                  onPress={() => setRole('public')}
                >
                  <Text style={[styles.roleText, role === 'public' && styles.roleTextActive]}>Player / fan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleChip, role === 'admin' && styles.roleChipActive]}
                  onPress={() => setRole('admin')}
                >
                  <Text style={[styles.roleText, role === 'admin' && styles.roleTextActive]}>Organiser</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.signupBtn} onPress={handleSignup} disabled={loading}>
              <LinearGradient colors={Colors.gradPrimary} style={styles.btnGradient}>
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={Colors.onPrimary} />
                    <Text style={styles.signupBtnText}>Creating account…</Text>
                  </View>
                ) : (
                  <Text style={styles.signupBtnText}>Sign Up</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: Spacing.md }}>
              <Text style={styles.backText}>Already have an account? <Text style={{ color: Colors.accent, fontWeight: '700' }}>Login</Text></Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1 },
  gradient: { flex: 1, justifyContent: 'center', padding: Spacing.base, paddingVertical: Spacing.xl },
  logoSection: { alignItems: 'center', marginBottom: Spacing.lg },
  logoImage: { width: 148, height: 148, marginBottom: Spacing.sm },
  title: { fontSize: Typography.xl, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 4 },
  formCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1, borderColor: Colors.border },
  formTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.base },
  photoSection: { alignItems: 'center', marginBottom: Spacing.base },
  photoPicker: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.bgElevated,
    marginTop: 4,
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoHint: { color: Colors.primary, fontSize: Typography.xs, fontWeight: '700' },
  photoChange: { color: Colors.primary, fontSize: Typography.xs, fontWeight: '700', marginTop: Spacing.sm },
  inputContainer: { marginBottom: Spacing.md },
  label: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, padding: Spacing.md, color: Colors.textPrimary, fontSize: Typography.sm, borderWidth: 1, borderColor: Colors.border },
  roleContainer: { flexDirection: 'row', gap: Spacing.sm },
  roleChip: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgElevated, alignItems: 'center' },
  roleChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '11' },
  roleText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '600' },
  roleTextActive: { color: Colors.primary, fontWeight: '700' },
  signupBtn: { marginTop: Spacing.md, height: 50, borderRadius: Radius.md, overflow: 'hidden' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  btnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  signupBtnText: { fontSize: Typography.base, fontWeight: '800', color: Colors.onPrimary },
  backText: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
});
