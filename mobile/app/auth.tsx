import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../src/lib/supabase';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, Lock, ShieldCheck } from 'lucide-react-native';
import TermsModal from '../src/components/TermsModal';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  signInWithGoogle,
  signInWithApple,
  isAppleAuthAvailable,
  handleAuthUrl,
  sendPasswordResetEmail,
  updatePassword,
  verifyRecoveryOtp,
  isRecoveryUrl,
} from '../src/services/auth';

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </Svg>
  );
}

type AuthMode = 'LOGIN' | 'FORGOT_PASSWORD' | 'UPDATE_PASSWORD';

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  
  // Password reset states
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const router = useRouter();

  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAuthAvailable);
  }, []);

  const processIncomingUrl = async (url: string) => {
    if (!url) return;
    const res = await handleAuthUrl(url);
    if (res.success) {
      if (res.isRecovery) {
        setMode('UPDATE_PASSWORD');
      } else {
        router.replace('/(tabs)/user');
      }
    } else if (res.errorCode === 'otp_expired') {
      Alert.alert(
        'Länken har gått ut',
        'Länken i mailet förbrukades av webbläsaren eller har gått ut. Ange den 6-siffriga koden från mailet direkt här i appen istället.'
      );
      setMode('FORGOT_PASSWORD');
      setResetSent(true);
    }
  };

  useEffect(() => {
    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) processIncomingUrl(url);
    });

    const subscription = Linking.addEventListener('url', async (event) => {
      if (event.url) processIncomingUrl(event.url);
    });

    // Supabase auth state listener for password recovery
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('UPDATE_PASSWORD');
      }
    });

    return () => {
      subscription.remove();
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleAppleSignIn() {
    try {
      setLoadingApple(true);
      const result = await signInWithApple();
      if (result.success) {
        router.replace('/(tabs)/user');
      } else if (result.error && result.error !== 'Inloggningen avbröts') {
        Alert.alert('Apple-inloggning', result.error);
      }
    } catch (err: any) {
      Alert.alert('Apple-inloggning', err?.message || 'Ett fel inträffade');
    } finally {
      setLoadingApple(false);
    }
  }

  async function handleGoogleSignIn() {
    try {
      setLoadingGoogle(true);
      const result = await signInWithGoogle();
      if (result.success) {
        router.replace('/(tabs)/user');
      } else if (result.error && result.error !== 'Inloggningen avbröts') {
        Alert.alert('Google-inloggning', result.error);
      }
    } catch (err: any) {
      Alert.alert('Google-inloggning', err?.message || 'Ett fel inträffade');
    } finally {
      setLoadingGoogle(false);
    }
  }

  async function signInWithEmail() {
    if (!email.trim() || !password) {
      Alert.alert('Fyll i uppgifter', 'Vänligen ange både e-post och lösenord.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (error) {
      Alert.alert('Inloggning misslyckades', error.message);
    } else {
      router.replace('/(tabs)/user');
    }
    setLoading(false);
  }

  async function signUpWithEmail() {
    if (!email.trim() || !password) {
      Alert.alert('Fyll i uppgifter', 'Vänligen ange både e-post och lösenord.');
      return;
    }

    setLoading(true);
    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
    });

    if (error) {
      Alert.alert('Registrering misslyckades', error.message);
    } else if (!session) {
      Alert.alert('Konto skapat!', 'Om du behöver verifiera e-post, kolla din inkorg.');
    } else {
      router.replace('/(tabs)/user');
    }
    setLoading(false);
  }

  async function handleSendResetEmail() {
    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      Alert.alert('Ange e-post', 'Vänligen ange din e-postadress för att få en återställningskod/länk.');
      return;
    }

    setLoading(true);
    const result = await sendPasswordResetEmail(targetEmail);
    setLoading(false);

    if (result.success) {
      setResetSent(true);
    } else {
      Alert.alert('Fel vid återställning', result.error || 'Kunde inte skicka återställningslänk.');
    }
  }

  async function handleResetWithOtpAndNewPassword() {
    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      Alert.alert('Ange e-post', 'Vänligen ange din e-postadress.');
      return;
    }

    if (!otpCode.trim()) {
      Alert.alert('Ange kod', 'Vänligen ange den 6-siffriga koden från ditt mail.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Ogiltigt lösenord', 'Lösenordet måste vara minst 6 tecken långt.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Lösenorden matchar inte', 'Kontrollera att båda lösenordsfälten är identiska.');
      return;
    }

    setLoading(true);
    // 1. Verify 6-digit OTP code to establish authenticated recovery session
    const otpResult = await verifyRecoveryOtp(targetEmail, otpCode);
    if (!otpResult.success) {
      setLoading(false);
      Alert.alert('Ogiltig kod', otpResult.error || 'Koden är ogiltig eller har gått ut. Kontrollera mailet och försök igen.');
      return;
    }

    // 2. Set new password
    const updateResult = await updatePassword(newPassword);
    setLoading(false);

    if (updateResult.success) {
      Alert.alert('Klart!', 'Ditt lösenord har uppdaterats. Du loggas nu in.', [
        {
          text: 'Fortsätt',
          onPress: () => router.replace('/(tabs)/user'),
        },
      ]);
    } else {
      Alert.alert('Fel', updateResult.error || 'Kunde inte uppdatera lösenordet.');
    }
  }

  async function handleSaveNewPassword() {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Ogiltigt lösenord', 'Lösenordet måste vara minst 6 tecken långt.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Lösenorden matchar inte', 'Kontrollera att båda fälten innehåller samma lösenord.');
      return;
    }

    setLoading(true);
    const result = await updatePassword(newPassword);
    setLoading(false);

    if (result.success) {
      Alert.alert('Klart!', 'Ditt lösenord har uppdaterats. Du loggas nu in.', [
        {
          text: 'Fortsätt',
          onPress: () => router.replace('/(tabs)/user'),
        },
      ]);
    } else {
      Alert.alert('Fel', result.error || 'Kunde inte uppdatera lösenordet.');
    }
  }

  const isAnyLoading = loading || loadingGoogle || loadingApple;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button when in sub-modes */}
          {mode !== 'LOGIN' && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setResetSent(false);
                setOtpCode('');
                setNewPassword('');
                setConfirmPassword('');
                setMode('LOGIN');
              }}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#94A3B8" />
              <Text style={styles.backButtonText}>Tillbaka till inloggning</Text>
            </TouchableOpacity>
          )}

          {/* Mode 1: STANDARD LOGIN */}
          {mode === 'LOGIN' && (
            <>
              <View style={styles.logoWrapper}>
                <Image
                  source={require('../assets/images/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.subtitle}>Logga in eller skapa ett konto</Text>

              {/* Social Login Buttons */}
              <View style={styles.socialButtonsContainer}>
                {appleAuthAvailable && (
                  <View style={styles.appleButtonContainer}>
                    {loadingApple ? (
                      <View style={styles.appleButtonLoading}>
                        <ActivityIndicator color="#0A0A0A" />
                      </View>
                    ) : (
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                        cornerRadius={12}
                        style={styles.appleButton}
                        onPress={handleAppleSignIn}
                      />
                    )}
                  </View>
                )}

                {/* Google Sign-In Button */}
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleSignIn}
                  disabled={isAnyLoading}
                  activeOpacity={0.85}
                >
                  {loadingGoogle ? (
                    <ActivityIndicator color="#0A0A0A" />
                  ) : (
                    <>
                      <GoogleIcon size={20} />
                      <Text style={styles.googleButtonText}>Fortsätt med Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>eller med e-post</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Email & Password Inputs */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  onChangeText={setEmail}
                  value={email}
                  placeholder="E-postadress"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!isAnyLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  onChangeText={setPassword}
                  value={password}
                  secureTextEntry={true}
                  placeholder="Lösenord"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  editable={!isAnyLoading}
                />
              </View>

              {/* Forgot Password Link */}
              <TouchableOpacity
                style={styles.forgotPasswordButton}
                onPress={() => {
                  setResetEmail(email);
                  setResetSent(false);
                  setMode('FORGOT_PASSWORD');
                }}
                disabled={isAnyLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPasswordText}>Glömt lösenord?</Text>
              </TouchableOpacity>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  disabled={isAnyLoading}
                  onPress={signInWithEmail}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#0A0A0A" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Logga In</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  disabled={isAnyLoading}
                  onPress={signUpWithEmail}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryButtonText}>Skapa Konto</Text>
                </TouchableOpacity>
              </View>

              {/* Terms and Privacy notice */}
              <View style={styles.termsContainer}>
                <Text style={styles.termsText}>
                  Genom att fortsätta godkänner du våra{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => setTermsModalVisible(true)}
                  >
                    Användarvillkor & Integritetspolicy
                  </Text>
                  .
                </Text>
              </View>

              {/* Copyright Footer */}
              <View style={styles.authFooter}>
                <Text style={styles.authCopyrightText}>
                  Copyright © 2026 Workout Player • Joakim Viking
                </Text>
              </View>
            </>
          )}

          {/* Mode 2: FORGOT PASSWORD */}
          {mode === 'FORGOT_PASSWORD' && (
            <>
              {resetSent ? (
                <View style={styles.formContainer}>
                  <View style={styles.successIconWrapper}>
                    <ShieldCheck size={44} color="#A3E635" />
                  </View>
                  <Text style={styles.modeTitle}>Kolla din inkorg</Text>
                  <Text style={styles.modeSubtitle}>
                    Vi har skickat ett mail till{' '}
                    <Text style={styles.highlightText}>{resetEmail || email}</Text>. Fyll i den 6-siffriga koden och ditt nya lösenord nedan.
                  </Text>

                  {/* OTP Code Input */}
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, styles.otpInput]}
                      onChangeText={setOtpCode}
                      value={otpCode}
                      placeholder="6-siffrig kod (t.ex. 123456)"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      maxLength={6}
                      editable={!loading}
                    />
                  </View>

                  {/* New Password Inputs */}
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      onChangeText={setNewPassword}
                      value={newPassword}
                      secureTextEntry={true}
                      placeholder="Nytt lösenord (minst 6 tecken)"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      onChangeText={setConfirmPassword}
                      value={confirmPassword}
                      secureTextEntry={true}
                      placeholder="Bekräfta nytt lösenord"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[styles.button, styles.primaryButton]}
                      disabled={loading}
                      onPress={handleResetWithOtpAndNewPassword}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#0A0A0A" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Spara nytt lösenord</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.secondaryButton]}
                      disabled={loading}
                      onPress={handleSendResetEmail}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.secondaryButtonText}>Skicka ny kod</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.iconHeader}>
                    <KeyRound size={36} color="#A3E635" />
                  </View>
                  <Text style={styles.modeTitle}>Återställ lösenord</Text>
                  <Text style={styles.modeSubtitle}>
                    Ange din e-postadress så skickar vi en kod/länk för att återställa ditt lösenord.
                  </Text>

                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      onChangeText={setResetEmail}
                      value={resetEmail || email}
                      placeholder="E-postadress"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[styles.button, styles.primaryButton]}
                      disabled={loading}
                      onPress={handleSendResetEmail}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#0A0A0A" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Skicka återställningskod</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}

          {/* Mode 3: UPDATE PASSWORD (opened from verified recovery link) */}
          {mode === 'UPDATE_PASSWORD' && (
            <>
              <View style={styles.iconHeader}>
                <Lock size={36} color="#A3E635" />
              </View>
              <Text style={styles.modeTitle}>Välj nytt lösenord</Text>
              <Text style={styles.modeSubtitle}>
                Ange ditt nya lösenord nedan. Lösenordet måste innehålla minst 6 tecken.
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  onChangeText={setNewPassword}
                  value={newPassword}
                  secureTextEntry={true}
                  placeholder="Nytt lösenord"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  onChangeText={setConfirmPassword}
                  value={confirmPassword}
                  secureTextEntry={true}
                  placeholder="Bekräfta nytt lösenord"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  disabled={loading}
                  onPress={handleSaveNewPassword}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#0A0A0A" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Spara nytt lösenord</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Terms and Privacy Policy Modal */}
      <TermsModal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  inner: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    gap: 8,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
  iconHeader: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 155,
    height: 155,
  },
  title: {
    fontFamily: 'Bangers_400Regular',
    fontSize: 44,
    color: '#A3E635',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 1,
  },
  modeTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  modeSubtitle: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  highlightText: {
    color: '#A3E635',
    fontWeight: '700',
  },
  socialButtonsContainer: {
    gap: 12,
    width: '100%',
  },
  appleButtonContainer: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
  },
  appleButton: {
    width: '100%',
    height: 50,
  },
  appleButtonLoading: {
    width: '100%',
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#27272A',
  },
  dividerText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  inputContainer: {
    marginBottom: 14,
  },
  input: {
    backgroundColor: '#18181B',
    color: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  otpInput: {
    letterSpacing: 3,
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '700',
    borderColor: '#3F3F46',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 6,
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#A3E635',
  },
  primaryButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#A3E635',
  },
  secondaryButtonText: {
    color: '#A3E635',
    fontSize: 16,
    fontWeight: '800',
  },
  formContainer: {
    width: '100%',
  },
  successIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.25)',
  },
  termsContainer: {
    marginTop: 20,
    paddingHorizontal: 8,
  },
  termsText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  termsLink: {
    color: '#A3E635',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  authFooter: {
    marginTop: 32,
    alignItems: 'center',
    paddingVertical: 12,
  },
  authCopyrightText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '500',
  },
});
