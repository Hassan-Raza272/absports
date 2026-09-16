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
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { useAuthStore } from '../../store';
import { signIn, getUserProfile, createUserProfile, ensureSuperAdminProfile } from '../../firebase';
import { User, UserRole } from '../../types';
import { emailLooksLikeSuperAdmin } from '../../utils/account';
import { EasePress } from '../../motion';
import { showAlert } from '../../components/PremiumAlert';

const { height: SCREEN_H } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const setUser = useAuthStore(state => state.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  function scrollToBottom() {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }

  async function handleLogin() {
    if (!email || !password) {
      showAlert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signIn(email.trim(), password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        let role: UserRole = 'public';
        let name = firebaseUser.displayName || 'AB Sports User';
        let canGoLive = false;
        let goLiveAccess = undefined as User['goLiveAccess'];
        let photoURL = undefined as User['photoURL'];

        try {
          const data = await getUserProfile(firebaseUser.uid);
          if (data) {
            role = data.role || 'public';
            name = data.name || name;
            photoURL = data.photoURL;
            canGoLive = !!data.canGoLive;
            goLiveAccess = data.goLiveAccess;
          } else {
            try {
              await createUserProfile(firebaseUser.uid, {
                name,
                email: firebaseUser.email || email.trim(),
                role: emailLooksLikeSuperAdmin(email) ? 'superadmin' : role,
              });
            } catch (saveError) {
              console.log('Could not create missing user profile:', saveError);
            }
          }
          if (emailLooksLikeSuperAdmin(email)) {
            role = 'superadmin';
            await ensureSuperAdminProfile({
              id: firebaseUser.uid,
              email: firebaseUser.email || email.trim(),
              name,
              role,
            });
          }
        } catch (dbError) {
          console.log('Error fetching user profile:', dbError);
          if (emailLooksLikeSuperAdmin(email)) {
            role = 'superadmin';
          }
        }

        const userObj: User = {
          id: firebaseUser.uid,
          name,
          email: firebaseUser.email || email,
          role,
          photoURL,
          canGoLive,
          goLiveAccess,
        };

        setUser(userObj);
        showAlert('Welcome', `Logged in successfully as ${name} (${role})`);
        navigation.replace('Main');
      }
    } catch (error: any) {
      console.log('Firebase login failed:', error);
      showAlert('Login Failed', error.message || 'Check your credentials and connection.');
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
        <LinearGradient
          colors={['#FFFFFF', '#F6F8FA', '#EEF2F6']}
          style={styles.gradient}
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appTitle}>AB SPORTS</Text>
            <View style={styles.badgeTag}>
              <Icon name="sparkles" size={12} color={Colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.tagline}>Tournaments · Teams · Live Scoring</Text>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <View style={styles.formHeaderContainer}>
              <Text style={styles.formTitle}>Welcome Back</Text>
              <Text style={styles.formSubtitle}>Sign in to your account to continue</Text>
            </View>

            {/* Email */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Icon name="mail-outline" size={20} color={Colors.primary} style={styles.leftIcon} />
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
                <Icon name="lock-closed-outline" size={20} color={Colors.primary} style={styles.leftIcon} />
                <TextInput
                  ref={passwordRef}
                  style={styles.inputFlex}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={handleLogin}
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
                    size={21}
                    color={showPassword ? Colors.primary : Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <EasePress onPress={handleLogin} disabled={loading} style={styles.loginBtn}>
              <LinearGradient
                colors={loading ? [Colors.primaryDark, Colors.primaryDark] : Colors.gradPrimary}
                style={styles.btnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <View style={styles.loaderRow}>
                    <ActivityIndicator color={Colors.onPrimary} size="small" />
                    <Text style={styles.loginBtnText}>Signing in...</Text>
                  </View>
                ) : (
                  <Text style={styles.loginBtnText}>Login</Text>
                )}
              </LinearGradient>
            </EasePress>

            <TouchableOpacity
              onPress={() => navigation.navigate('Signup')}
              style={styles.signupTouchable}
              activeOpacity={0.8}
            >
              <Text style={styles.signupText}>
                Don't have an account?{' '}
                <Text style={styles.signupHighlight}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  gradient: {
    minHeight: SCREEN_H,
    padding: Spacing.base,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    // Extra bottom padding so button is never hidden behind keyboard
    paddingBottom: 300,
    justifyContent: 'center',
  },

  logoSection: { alignItems: 'center', marginBottom: Spacing.xl },
  logoWrapper: {
    padding: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.full,
    ...Shadow.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.sm,
  },
  logoImage: { width: 100, height: 100 },
  appTitle: {
    fontSize: Typography.xxl,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  badgeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(196, 26, 59, 0.07)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(196, 26, 59, 0.12)',
  },
  tagline: { fontSize: Typography.xs, fontWeight: '600', color: Colors.primary },

  formCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.lg,
  },
  formHeaderContainer: { marginBottom: Spacing.lg },
  formTitle: { fontSize: Typography.xl, fontWeight: '800', color: Colors.textPrimary },
  formSubtitle: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 3 },

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
  eyeBtn: {
    paddingLeft: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loginBtn: {
    marginTop: Spacing.md,
    height: 52,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.md,
  },
  btnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loginBtnText: {
    fontSize: Typography.base,
    fontWeight: '800',
    color: Colors.onPrimary,
    letterSpacing: 0.5,
  },

  signupTouchable: { marginTop: Spacing.lg, paddingVertical: 4 },
  signupText: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },
  signupHighlight: { color: Colors.primary, fontWeight: '800' },
});
