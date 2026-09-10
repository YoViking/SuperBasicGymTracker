import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle2, Award } from 'lucide-react-native';
import { onboardingService, OnboardingProfile } from '../services/onboardingService';
import { useAuth } from '../context/AuthContext';
import { EXPERIENCE_LEVELS, GOAL_OPTIONS, INJURY_LABELS } from './ai-wizard';
import ProfileEditModal from './ProfileEditModal';

interface UserProfileCardProps {
  onProfileUpdated?: (profile: OnboardingProfile) => void;
}

export default function UserProfileCard({ onProfileUpdated }: UserProfileCardProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  const loadProfile = async () => {
    if (!user?.id) return;
    const p = await onboardingService.getOnboardingProfile(user.id);
    setProfile(p);
  };

  useEffect(() => {
    loadProfile();
  }, [user?.id]);

  const handleSaved = (updated: OnboardingProfile) => {
    setProfile(updated);
    if (onProfileUpdated) {
      onProfileUpdated(updated);
    }
  };

  const levelObj = EXPERIENCE_LEVELS.find((l) => l.id === profile?.experienceLevel);
  const goalObj = GOAL_OPTIONS.find((g) => g.id === profile?.fitnessGoal);
  const injuries = profile?.injuries || [];

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={() => setIsEditModalVisible(true)}
        activeOpacity={0.8}
      >
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <View style={styles.iconWrapper}>
              <Award size={20} color="#A3E635" />
            </View>
            <View>
              <Text style={styles.title}>Min Träningsprofil</Text>
              <Text style={styles.subtitle}>Styr framtida träningspass & AI-program</Text>
            </View>
          </View>
        </View>

        {/* Content Details */}
        <View style={styles.detailsContainer}>
          {/* Level Row */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Nivå</Text>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>
                {levelObj?.label || (profile?.experienceLevel ? profile.experienceLevel : 'Ej vald')}
              </Text>
            </View>
          </View>

          {/* Goal Row */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Huvudmål</Text>
            <Text style={styles.detailValue}>
              {goalObj?.label || (profile?.fitnessGoal ? profile.fitnessGoal : 'Allmän Hälsa')}
            </Text>
          </View>

          {/* Injuries Row */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Skador & Skydd</Text>
            {injuries.length > 0 ? (
              <View style={styles.injuriesRow}>
                {injuries.map((inj) => (
                  <View key={inj} style={styles.injuryBadge}>
                    <Text style={styles.injuryBadgeText}>{INJURY_LABELS[inj] || inj}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noInjuryRow}>
                <CheckCircle2 size={14} color="#A3E635" />
                <Text style={styles.noInjuryText}>Inga begränsningar</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      <ProfileEditModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        profile={profile}
        onSaved={handleSaved}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 16,
    marginHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  detailsContainer: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  levelBadge: {
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.3)',
  },
  levelBadgeText: {
    color: '#A3E635',
    fontSize: 12,
    fontWeight: '700',
  },
  injuriesRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: '65%',
  },
  injuryBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  injuryBadgeText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '600',
  },
  noInjuryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noInjuryText: {
    color: '#A3E635',
    fontSize: 12,
    fontWeight: '600',
  },
});
