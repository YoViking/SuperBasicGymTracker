import React, { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Lock, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import { updatePassword } from '../src/services/auth';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Ogiltigt lösenord', 'Lösenordet måste vara minst 6 tecken långt.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Lösenorden matchar inte', 'Kontrollera att båda fälten innehåller samma lösenord.');
      return;
    }

    setLoading(true);
    const res = await updatePassword(newPassword);
    setLoading(false);

    if (res.success) {
      setSuccess(true);
    } else {
      Alert.alert('Fel', res.error || 'Kunde inte uppdatera lösenordet.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {success ? (
            <View style={styles.successContainer}>
              <View style={styles.successIconWrapper}>
                <CheckCircle2 size={48} color="#A3E635" />
              </View>
              <Text style={styles.title}>Lösenord uppdaterat!</Text>
              <Text style={styles.subtitle}>
                Ditt nya lösenord har sparats och du kan nu använda appen som vanligt.
              </Text>

              <TouchableOpacity
                style={[styles.button, styles.primaryButton, { marginTop: 20 }]}
                onPress={() => router.replace('/(tabs)/user')}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Gå till appen</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.iconHeader}>
                <Lock size={36} color="#A3E635" />
              </View>

              <Text style={styles.title}>Välj nytt lösenord</Text>
              <Text style={styles.subtitle}>
                Ange ditt nya lösenord nedan. Lösenordet måste bestå av minst 6 tecken.
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
                  onPress={handleSavePassword}
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
                  onPress={() => router.replace('/(tabs)/user')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryButtonText}>Hoppa över / Fortsätt</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
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
    marginTop: 8,
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
    borderColor: '#3F3F46',
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '700',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  successIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.25)',
  },
});
