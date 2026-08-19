import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
  Dimensions,
} from 'react-native';
import { Trophy, Share2, Sparkles, Flame, CheckCircle2, Clock, Dumbbell, Zap, Hash } from 'lucide-react-native';
import { ExerciseAchievement } from '../services/recordDetector';

const { width } = Dimensions.get('window');

export interface WorkoutSummaryData {
  workoutName: string;
  durationSeconds: number;
  totalReps: number;
  totalVolume: number;
  completedSetsCount: number;
  completedExercisesCount: number;
  achievements: ExerciseAchievement[];
}

interface WorkoutSummaryModalProps {
  visible: boolean;
  summary: WorkoutSummaryData | null;
  onClose: () => void;
}

export default function WorkoutSummaryModal({
  visible,
  summary,
  onClose,
}: WorkoutSummaryModalProps) {
  if (!summary) return null;

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins} min ${secs > 0 ? `${secs}s` : ''}`.trim();
    }
    return `${secs} s`;
  };

  const formatVolume = (volumeKg: number): string => {
    if (volumeKg >= 1000) {
      return `${volumeKg.toLocaleString('sv-SE')} kg`;
    }
    return `${Math.round(volumeKg)} kg`;
  };

  const handleShare = async () => {
    try {
      const recordsText = summary.achievements.length > 0
        ? `\n🏆 Nya Personbästa:\n` + summary.achievements.map(a => 
            `  • ${a.exerciseName}: ${a.currentValue} ${a.unit}${a.diff ? ` (+${a.diff} ${a.unit})` : ''}`
          ).join('\n')
        : '';

      const message = 
`💪 Jag körde precis klart ett träningspass med Workout Player!

📋 Pass: ${summary.workoutName}
⏱️ Tid: ${formatDuration(summary.durationSeconds)}
⚡ Total volym: ${formatVolume(summary.totalVolume)}
🔢 Totala reps: ${summary.totalReps} st
📊 Antal set: ${summary.completedSetsCount} st${recordsText}

#WorkoutPlayer #Träning #Workout`;

      await Share.share({
        message,
        title: `Träningssammanfattning - ${summary.workoutName}`,
      });
    } catch (error) {
      console.error('Error sharing workout summary:', error);
    }
  };

  const todayStr = new Date().toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.cardContainer}>
          {/* Top Banner with celebratory gradient / badge */}
          <View style={styles.headerBanner}>
            <View style={styles.trophyIconWrapper}>
              <Trophy size={32} color="#A3E635" />
            </View>
            <View style={styles.badgeRow}>
              <Sparkles size={14} color="#A3E635" style={{ marginRight: 4 }} />
              <Text style={styles.badgeText}>WORKOUT SLUTFÖRD</Text>
            </View>
            <Text style={styles.workoutTitle} numberOfLines={1}>
              {summary.workoutName}
            </Text>
            <Text style={styles.workoutDate}>{todayStr}</Text>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Stats Grid (2x2) */}
            <View style={styles.statsGrid}>
              {/* Tid */}
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Clock size={18} color="#A3E635" />
                </View>
                <Text style={styles.statLabel}>TID</Text>
                <Text style={styles.statValue}>
                  {formatDuration(summary.durationSeconds)}
                </Text>
              </View>

              {/* Total Volym */}
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Zap size={18} color="#A3E635" />
                </View>
                <Text style={styles.statLabel}>TOTAL VOLYM</Text>
                <Text style={styles.statValue} numberOfLines={1}>
                  {formatVolume(summary.totalVolume)}
                </Text>
              </View>

              {/* Totala Reps */}
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Hash size={18} color="#A3E635" />
                </View>
                <Text style={styles.statLabel}>TOTALA REPS</Text>
                <Text style={styles.statValue}>{summary.totalReps}</Text>
              </View>

              {/* Antal Set */}
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Dumbbell size={18} color="#A3E635" />
                </View>
                <Text style={styles.statLabel}>SET & ÖVNINGAR</Text>
                <Text style={styles.statValue}>
                  {summary.completedSetsCount} set / {summary.completedExercisesCount} övn
                </Text>
              </View>
            </View>

            {/* Achievements Section */}
            {summary.achievements.length > 0 ? (
              <View style={styles.achievementsContainer}>
                <View style={styles.achievementsHeader}>
                  <Trophy size={18} color="#FBBF24" />
                  <Text style={styles.achievementsTitle}>Nya Personbästa!</Text>
                </View>
                {summary.achievements.map((item, idx) => (
                  <View key={idx} style={styles.achievementRow}>
                    <View style={styles.achievementLeft}>
                      <Text style={styles.achievementExName} numberOfLines={1}>
                        {item.exerciseName}
                      </Text>
                      <Text style={styles.achievementSubtitle}>
                        {item.title} {item.diff ? `(+${item.diff} ${item.unit})` : ''}
                      </Text>
                    </View>
                    <View style={styles.achievementBadge}>
                      <Text style={styles.achievementValue}>
                        {item.currentValue} {item.unit}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.motivationalContainer}>
                <Flame size={20} color="#A3E635" style={{ marginRight: 8 }} />
                <Text style={styles.motivationalText}>
                  Stark insats! Du flyttade {(summary.totalVolume / 1000).toFixed(1)} ton idag 💪
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Share2 size={18} color="#F8FAFC" />
              <Text style={styles.shareButtonText}>Dela pass</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>Klar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '90%',
    backgroundColor: '#18181B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 20,
  },
  headerBanner: {
    backgroundColor: '#0F1115',
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  trophyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
    borderWidth: 1.5,
    borderColor: '#A3E635',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgeText: {
    color: '#A3E635',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  workoutTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 4,
  },
  workoutDate: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  scrollArea: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#27272A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  achievementsContainer: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    marginBottom: 18,
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  achievementsTitle: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '800',
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E2024',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  achievementLeft: {
    flex: 1,
    marginRight: 10,
  },
  achievementExName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  achievementSubtitle: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '500',
  },
  achievementBadge: {
    backgroundColor: '#FBBF24',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  achievementValue: {
    color: '#0A0A0A',
    fontSize: 12.5,
    fontWeight: '800',
  },
  motivationalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272A',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 18,
  },
  motivationalText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    backgroundColor: '#0F1115',
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#27272A',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  shareButtonText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  doneButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A3E635',
    paddingVertical: 14,
    borderRadius: 12,
  },
  doneButtonText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '800',
  },
});
