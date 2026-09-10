import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  ToastAndroid,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';
import { onboardingService, OnboardingProfile } from '../services/onboardingService';
import { useAuth } from '../context/AuthContext';
import {
  StepLevel,
  StepGoals,
  StepInjuries,
} from './ai-wizard';

interface ProfileEditModalProps {
  visible: boolean;
  onClose: () => void;
  profile: OnboardingProfile | null;
  onSaved: (updated: OnboardingProfile) => void;
}

export default function ProfileEditModal({
  visible,
  onClose,
  profile,
  onSaved,
}: ProfileEditModalProps) {
  const { user } = useAuth();

  const [fitnessGoal, setFitnessGoal] = useState('Muscle Growth (Hypertrophy)');
  const [experienceLevel, setExperienceLevel] = useState('intermediate');
  const [selectedInjuries, setSelectedInjuries] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState('');
  const [activeTab, setActiveTab] = useState<'level' | 'goal' | 'injuries'>('level');

  useEffect(() => {
    if (visible && profile) {
      if (profile.fitnessGoal) setFitnessGoal(profile.fitnessGoal);
      if (profile.experienceLevel) setExperienceLevel(profile.experienceLevel);
      if (profile.injuries) setSelectedInjuries(profile.injuries);
      if (profile.exclusions) setExclusions(profile.exclusions);
    }
  }, [visible, profile]);

  const handleToggleInjury = (injury: string) => {
    if (selectedInjuries.includes(injury)) {
      setSelectedInjuries(selectedInjuries.filter((i) => i !== injury));
    } else {
      setSelectedInjuries([...selectedInjuries, injury]);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    const updated: OnboardingProfile = {
      ...profile,
      fitnessGoal,
      experienceLevel,
      injuries: selectedInjuries,
      exclusions,
    };

    try {
      await onboardingService.saveOnboardingProfile(user.id, updated);
      onSaved(updated);

      if (Platform.OS === 'android') {
        ToastAndroid.show('Träningsprofilen uppdaterades!', ToastAndroid.SHORT);
      } else {
        Alert.alert('Sparat', 'Din träningsprofil har uppdaterats.');
      }
      onClose();
    } catch (e: any) {
      console.error('Error updating profile:', e);
      Alert.alert('Fel', 'Kunde inte spara profilen: ' + (e.message || 'Okänt fel'));
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Min Träningsprofil</Text>
            <Text style={styles.headerSubtitle}>Uppdatera din nivå, dina mål eller skador</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={22} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'level' && styles.tabBtnActive]}
            onPress={() => setActiveTab('level')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'level' && styles.tabTextActive]}>
              Nivå
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'goal' && styles.tabBtnActive]}
            onPress={() => setActiveTab('goal')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'goal' && styles.tabTextActive]}>
              Huvudmål
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'injuries' && styles.tabBtnActive]}
            onPress={() => setActiveTab('injuries')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'injuries' && styles.tabTextActive]}>
              Skador ({selectedInjuries.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {activeTab === 'level' && (
            <StepLevel experienceLevel={experienceLevel} onSelectLevel={setExperienceLevel} />
          )}

          {activeTab === 'goal' && (
            <StepGoals fitnessGoal={fitnessGoal} onSelectGoal={setFitnessGoal} />
          )}

          {activeTab === 'injuries' && (
            <StepInjuries
              selectedInjuries={selectedInjuries}
              onToggleInjury={handleToggleInjury}
              exclusions={exclusions}
              onChangeExclusions={setExclusions}
            />
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
            <Check size={18} color="#0A0A0A" strokeWidth={3} />
            <Text style={styles.saveButtonText}>Spara ändringar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#18181B',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#18181B',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#18181B',
    padding: 4,
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 12,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#27272A',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#A3E635',
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#18181B',
    backgroundColor: '#0A0A0A',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A3E635',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '800',
  },
});
