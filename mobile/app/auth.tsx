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
} from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../src/lib/supabase';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { signInWithGoogle, handleAuthUrl } from '../src/services/auth';

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

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if app was opened via deep link
    Linking.getInitialURL().then(url => {
      if (url) {
        handleAuthUrl(url).then(success => {
          if (success) {
            router.replace('/(tabs)/user');
          }
        });
      }
    });

    const subscription = Linking.addEventListener('url', async (event) => {
      if (event.url) {
        const success = await handleAuthUrl(event.url);
        if (success) {
          router.replace('/(tabs)/user');
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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

  const isAnyLoading = loading || loadingGoogle;

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
          <Text style={styles.title}>SuperBasic</Text>
          <Text style={styles.subtitle}>Logga in eller skapa ett konto</Text>

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
        </ScrollView>
      </KeyboardAvoidingView>
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
  title: {
    fontFamily: 'Bangers_400Regular',
    fontSize: 46,
    color: '#A3E635',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 1,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
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
  buttonContainer: {
    marginTop: 12,
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
});
