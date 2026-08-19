import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Modal, Pressable, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, ChevronRight, Check, LogOut } from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import {
  REST_TIMER_OPTIONS,
  RestTimerOption,
  getRestTimerInterval,
  setRestTimerInterval,
  getKeepAwakeSetting,
  setKeepAwakeSetting,
  formatTimerIntervalDisplay,
} from '../src/utils/settings';

export default function SettingsScreen() {
  const router = useRouter();
  const [restTimerInterval, setRestTimerIntervalState] = useState<number>(30);
  const [keepAwake, setKeepAwake] = useState<boolean>(true);
  const [isTimerModalVisible, setIsTimerModalVisible] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    loadSettings();
    fetchUser();
  }, []);

  const loadSettings = async () => {
    const savedInterval = await getRestTimerInterval();
    setRestTimerIntervalState(savedInterval);

    const savedKeepAwake = await getKeepAwakeSetting();
    setKeepAwake(savedKeepAwake);
  };

  const fetchUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    } catch (error) {
      console.error('Error fetching user for settings:', error);
    }
  };

  const handleSelectInterval = async (option: RestTimerOption) => {
    setRestTimerIntervalState(option.value);
    await setRestTimerInterval(option.value);
    setIsTimerModalVisible(false);
  };

  const handleToggleKeepAwake = async (value: boolean) => {
    setKeepAwake(value);
    await setKeepAwakeSetting(value);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inställningar</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Vilotimer Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vilotimer</Text>
          <TouchableOpacity
            style={styles.settingCard}
            onPress={() => setIsTimerModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Tidintervall per tryck</Text>
              <Text style={styles.settingSubtitle}>
                {formatTimerIntervalDisplay(restTimerInterval)}
              </Text>
            </View>
            <ChevronRight size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Skärm Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skärm</Text>
          <View style={styles.settingCard}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Vaken</Text>
              <Text style={styles.settingSubtitle}>
                Förhindrar att skärmen sover under träning
              </Text>
            </View>
            <Switch
              value={keepAwake}
              onValueChange={handleToggleKeepAwake}
              trackColor={{ false: '#334155', true: '#A3E635' }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              ios_backgroundColor="#334155"
            />
          </View>
        </View>

        {/* Konto / Logga ut Section */}
        {userEmail ? (
          <View style={[styles.section, { marginTop: 32 }]}>
            <Text style={styles.sectionTitle}>Konto</Text>
            <View style={styles.accountCard}>
              <Text style={styles.accountEmail} numberOfLines={1}>{userEmail}</Text>
              <TouchableOpacity
                style={styles.signOutButton}
                onPress={handleSignOut}
                activeOpacity={0.8}
              >
                <LogOut size={18} color="#EF4444" />
                <Text style={styles.signOutText}>Logga ut</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.settingCard, { marginTop: 12 }]}
              onPress={() => router.push('/reset-password')}
              activeOpacity={0.7}
            >
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Byt lösenord</Text>
                <Text style={styles.settingSubtitle}>
                  Uppdatera ditt kontolösenord
                </Text>
              </View>
              <ChevronRight size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        ) : null}

          {/* Om & Juridiskt Section */}
        <View style={[styles.section, { marginTop: 32 }]}>
          <Text style={styles.sectionTitle}>Om & Juridiskt</Text>

          <TouchableOpacity
            style={styles.settingCard}
            onPress={() => router.push('/terms')}
            activeOpacity={0.7}
          >
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Användarvillkor & Integritet</Text>
              <Text style={styles.settingSubtitle}>
                Regler, friskrivningar och GDPR
              </Text>
            </View>
            <ChevronRight size={20} color="#94A3B8" />
          </TouchableOpacity>

          <View style={[styles.settingCard, { marginTop: 12 }]}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Upphovsrätt & Copyright</Text>
              <Text style={styles.settingSubtitle}>
                © 2026 Workout Player / Joakim Viking. Alla rättigheter förbehållna.
              </Text>
            </View>
          </View>

          <View style={[styles.settingCard, { marginTop: 12 }]}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Lokal data & Utveckling</Text>
              <Text style={styles.settingSubtitle}>
                Appen använder säker lokal enhetslagring för offline-stöd och prestanda.
              </Text>
            </View>
          </View>
        </View>

        {/* App Version Footer */}
        <View style={styles.settingsFooter}>
          <Text style={styles.settingsFooterText}>Workout Player v1.0.0</Text>
          <Text style={styles.settingsFooterSubText}>Skapad med ❤️ av Joakim Viking</Text>
        </View>
      </ScrollView>

      {/* Rest Timer Interval Modal */}
      <Modal
        visible={isTimerModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsTimerModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsTimerModalVisible(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {REST_TIMER_OPTIONS.map((option, index) => {
              const isSelected = restTimerInterval === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.modalOptionRow,
                    index < REST_TIMER_OPTIONS.length - 1 && styles.modalOptionBorder,
                  ]}
                  onPress={() => handleSelectInterval(option)}
                  activeOpacity={0.7}
                >
                  {/* Radio button circle */}
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  settingCard: {
    backgroundColor: '#1E242C', // Dark slate background matching Figma
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 18,
  },
  accountCard: {
    backgroundColor: '#1E242C',
    borderRadius: 10,
    padding: 16,
    gap: 16,
  },
  accountEmail: {
    color: '#94A3B8',
    fontSize: 14,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingVertical: 12,
    borderRadius: 8,
  },
  signOutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#D9DDE2', // Light grey modal card matching Figma
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  modalOptionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#B0B8C4',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  radioCircleSelected: {
    borderColor: '#0F172A',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0F172A',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '500',
  },
  modalOptionTextSelected: {
    fontWeight: '700',
    color: '#000000',
  },
  settingsFooter: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 4,
  },
  settingsFooterText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  settingsFooterSubText: {
    color: '#475569',
    fontSize: 12,
  },
});
