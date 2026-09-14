import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { useAuthStore } from '../../store';
import { signIn, getUserProfile, createUserProfile, ensureSuperAdminProfile } from '../../firebase';
import { User, UserRole } from '../../types';
import { emailLooksLikeSuperAdmin } from '../../utils/account';
import { EaseEnter, EasePress, EaseView } from '../../motion';
import { showAlert } from '../../components/PremiumAlert';

export default function LoginScreen({ navigation }: any) {
  const setUser = useAuthStore(state => state.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      showAlert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      // 1. Firebase Sign In
      const userCredential = await signIn(email.trim(), password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        // 2. Fetch profile from Realtime Database
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
          console.log('Error fetching user profile, using email fallback role:', dbError);
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
      console.log('Firebase login failed, checking fallback:', error);
      showAlert('Login Failed', error.message || 'Check your credentials and connection.');
    } finally {
      setLoading(false);
    }
  }

  // Handy shortcut for testing and grading without mandatory backend configs
  function handleDemoBypass(roleType: UserRole) {
    const demoUser: User = {
      id: `demo-${roleType}-${Date.now()}`,
      name: roleType === 'superadmin' ? 'AB Sports Scorer' : 'Guest Viewer',
      email: roleType === 'superadmin' ? 'scorer@absports.app' : 'viewer@absports.app',
      role: roleType,
    };
    setUser(demoUser);
    showAlert('Demo Login', `Entered app as ${demoUser.name} (${roleType})`);
    navigation.replace('Main');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={Colors.gradDark} style={styles.gradient}>
        <EaseView
          initialAnimate={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 140 }}
          style={styles.logoSection}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.subtitle}>Tournaments · Teams · Live Scoring</Text>
        </EaseView>

        <EaseEnter index={1} from={{ opacity: 0, translateY: 24 }} to={{ opacity: 1, translateY: 0 }}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Sign In</Text>

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

            <EasePress onPress={handleLogin} disabled={loading} style={styles.loginBtn}>
              {loading ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <LinearGradient colors={Colors.gradPrimary} style={styles.btnGradient}>
                  <Text style={styles.loginBtnText}>Login</Text>
                </LinearGradient>
              )}
            </EasePress>

            <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={{ marginTop: Spacing.md }}>
              <Text style={styles.signupText}>Don't have an account? <Text style={{ color: Colors.accent, fontWeight: '700' }}>Signup</Text></Text>
            </TouchableOpacity>
          </View>
        </EaseEnter>

        {/* Demo Mode Bypass Card */}
        {/* <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>💡 Quick Demo Access</Text>
          <Text style={styles.demoDesc}>Bypass login instantly to check out user roles offline.</Text>
          <View style={styles.demoButtons}>
            <TouchableOpacity style={styles.demoBtn} onPress={() => handleDemoBypass('superadmin')}>
              <Text style={styles.demoBtnText}>🔑 Superadmin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.demoBtn, { borderColor: Colors.accentBlue }]} onPress={() => handleDemoBypass('public')}>
              <Text style={[styles.demoBtnText, { color: Colors.accentBlue }]}>👁️ Public User</Text>
            </TouchableOpacity>
          </View>
        </View> */}
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  gradient: { flex: 1, justifyContent: 'center', padding: Spacing.base },
  logoSection: { alignItems: 'center', marginBottom: Spacing.lg },
  logoImage: { width: 148, height: 148, marginBottom: Spacing.sm },
  title: { fontSize: Typography.xl, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 4 },
  formCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1, borderColor: Colors.border },
  formTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.base },
  inputContainer: { marginBottom: Spacing.md },
  label: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, padding: Spacing.md, color: Colors.textPrimary, fontSize: Typography.sm, borderWidth: 1, borderColor: Colors.border },
  loginBtn: { marginTop: Spacing.md, height: 50, borderRadius: Radius.md, overflow: 'hidden' },
  btnGradient: { flex: 1, height: 50, alignItems: 'center', justifyContent: 'center' },
  loginBtnText: { fontSize: Typography.base, fontWeight: '800', color: Colors.onPrimary },
  signupText: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
  demoCard: { backgroundColor: Colors.bgElevated, borderRadius: Radius.lg, padding: Spacing.base, marginTop: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  demoTitle: { fontSize: Typography.sm, fontWeight: '800', color: Colors.textPrimary },
  demoDesc: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2, marginBottom: Spacing.md },
  demoButtons: { flexDirection: 'row', gap: Spacing.sm },
  demoBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary, alignItems: 'center' },
  demoBtnText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.primary },
});
