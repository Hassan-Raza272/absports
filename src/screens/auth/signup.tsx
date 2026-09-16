import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Platform,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { useAuthStore } from '../../store';
import { signUp, createUserProfile, uploadImage } from '../../firebase';
import { isLocalImageUri } from '../../services/cloudinary';
import { User, UserRole } from '../../types';
import PremiumIcon from '../../components/PremiumIcon';
import { showAlert } from '../../components/PremiumAlert';

const { height: SCREEN_H } = Dimensions.get('window');

export default function SignupScreen({ navigation }: any) {
  const setUser = useAuthStore(state => state.setUser);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('public');
  const [photoUri, setPhotoUri] = useState('');
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  function scrollToBottom() {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }

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
        const profileData = { name, email: email.trim(), role, photoURL };
        try {
          await createUserProfile(firebaseUser.uid, profileData);
        } catch (dbError) {
          console.log('Failed to save profile:', dbError);
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <LinearGradient colors={['#FFFFFF', '#F6F8FA', '#EEF2F6']} style={styles.gradient}>

          {/* ── Header strip ── */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
              <Icon name="chevron-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View>
              <Text style={styles.screenTitle}>Create Account</Text>
              <Text style={styles.screenSubtitle}>Join AB Sports today</Text>
            </View>
          </View>

          {/* ── Form Card ── */}
          <View style={styles.formCard}>

            {/* Profile Photo */}
            <View style={styles.photoRow}>
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
                    <LinearGradient
                      colors={['rgba(196,26,59,0.1)', 'rgba(196,26,59,0.04)']}
                      style={styles.photoGradientBg}
                    >
                      <PremiumIcon name="person" size={32} color={Colors.primary} />
                    </LinearGradient>
                  </View>
                )}
                {/* Camera badge */}
                <View style={styles.cameraBadge}>
                  <Icon name="camera" size={12} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <View style={styles.photoTextColumn}>
                <Text style={styles.photoTitle}>Profile Photo</Text>
                <Text style={styles.photoHint}>Add a photo so others can recognise you</Text>
                <TouchableOpacity onPress={handlePickPhoto} disabled={loading} activeOpacity={0.7}>
                  <Text style={styles.photoAction}>{photoUri ? 'Change photo' : 'Upload photo'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Full Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Icon name="person-outline" size={19} color={Colors.primary} style={styles.leftIcon} />
                <TextInput
                  ref={nameRef}
                  style={styles.inputFlex}
                  placeholder="Your full name"
                  placeholderTextColor={Colors.textMuted}
                  returnKeyType="next"
                  value={name}
                  onChangeText={setName}
                  onSubmitEditing={() => emailRef.current?.focus()}
                  onFocus={scrollToBottom}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Icon name="mail-outline" size={19} color={Colors.primary} style={styles.leftIcon} />
                <TextInput
                  ref={emailRef}
                  style={styles.inputFlex}
                  placeholder="you@email.com"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  onFocus={scrollToBottom}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Icon name="lock-closed-outline" size={19} color={Colors.primary} style={styles.leftIcon} />
                <TextInput
                  ref={passwordRef}
                  style={styles.inputFlex}
                  placeholder="Create a password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={handleSignup}
                  onFocus={scrollToBottom}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Icon
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={showPassword ? Colors.primary : Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Role chips */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>I am joining as</Text>
              <View style={styles.roleContainer}>
                <TouchableOpacity
                  style={[styles.roleChip, role === 'public' && styles.roleChipActive]}
                  onPress={() => setRole('public')}
                  activeOpacity={0.8}
                >
                  <Icon
                    name="people-outline"
                    size={16}
                    color={role === 'public' ? Colors.primary : Colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.roleText, role === 'public' && styles.roleTextActive]}>Player / Fan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleChip, role === 'admin' && styles.roleChipActive]}
                  onPress={() => setRole('admin')}
                  activeOpacity={0.8}
                >
                  <Icon
                    name="shield-outline"
                    size={16}
                    color={role === 'admin' ? Colors.primary : Colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.roleText, role === 'admin' && styles.roleTextActive]}>Organiser</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[styles.signupBtn, loading && styles.signupBtnDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={loading ? [Colors.primaryDark, Colors.primaryDark] : Colors.gradPrimary}
                style={styles.btnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={Colors.onPrimary} size="small" />
                    <Text style={styles.signupBtnText}>Creating account…</Text>
                  </View>
                ) : (
                  <Text style={styles.signupBtnText}>Create Account</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Login Link */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.loginLink}
              activeOpacity={0.8}
            >
              <Text style={styles.loginLinkText}>
                Already have an account? <Text style={styles.loginLinkHighlight}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1 },
  gradient: {
    minHeight: SCREEN_H,
    padding: Spacing.base,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    // Large bottom padding so the Sign Up button is never hidden behind keyboard
    paddingBottom: 320,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  screenTitle: {
    fontSize: Typography.xxl,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  screenSubtitle: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },

  /* Card */
  formCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.lg,
  },

  /* Photo Row */
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    marginBottom: Spacing.base,
  },
  photoPicker: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.bgElevated,
    position: 'relative',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoGradientBg: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  photoTextColumn: { flex: 1, gap: 3 },
  photoTitle: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
  photoHint: { fontSize: Typography.xs, color: Colors.textSecondary, lineHeight: 16 },
  photoAction: { fontSize: Typography.xs, fontWeight: '800', color: Colors.primary, marginTop: 4 },

  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.md,
  },

  /* Inputs */
  inputContainer: { marginBottom: Spacing.md },
  label: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 6, fontWeight: '700' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 52,
  },
  leftIcon: { marginRight: Spacing.sm },
  inputFlex: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.sm,
    fontWeight: '500',
    paddingVertical: 0,
  },
  eyeBtn: { paddingLeft: Spacing.xs, justifyContent: 'center', alignItems: 'center' },

  /* Role chips */
  roleContainer: { flexDirection: 'row', gap: Spacing.sm },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  roleChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '11' },
  roleText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '600' },
  roleTextActive: { color: Colors.primary, fontWeight: '800' },

  /* Button */
  signupBtn: {
    height: 52,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.md,
    marginTop: Spacing.sm,
  },
  signupBtnDisabled: { opacity: 0.85 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  btnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  signupBtnText: { fontSize: Typography.base, fontWeight: '800', color: Colors.onPrimary, letterSpacing: 0.5 },

  loginLink: { marginTop: Spacing.lg, paddingVertical: 4 },
  loginLinkText: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },
  loginLinkHighlight: { color: Colors.primary, fontWeight: '800' },
});
