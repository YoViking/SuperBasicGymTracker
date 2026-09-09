import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Video, Image as ImageIcon, PlusCircle } from 'lucide-react-native';
import { ExerciseLibrary } from '../types';
import ExerciseVideoPlayer from './ExerciseVideoPlayer';
import origymMatchedVideos from '../data/origym_matched_videos.json';

const MATCHED_MAP: Record<string, string> = origymMatchedVideos as Record<string, string>;

// Curated or fallback video mapping for exercises
const KNOWN_EXERCISE_VIDEOS: Record<string, string> = {
  // Seated Side Lateral Raise
  'c8011fc0-589a-4776-8eb3-48c9ece1b5a5': 'https://www.youtube.com/embed/Ksbk8gFS9CA?si=zAIWd4lhw_sT4mtW',
  'seated side lateral raise': 'https://www.youtube.com/embed/Ksbk8gFS9CA?si=zAIWd4lhw_sT4mtW',
};

export function resolveExerciseVideoUrl(exercise?: ExerciseLibrary | null, fallbackId?: string): string | null {
  if (!exercise && !fallbackId) return null;

  // If explicitly set to 'none' in database, disable video (fall back to GIF)
  if (exercise?.link === 'none' || exercise?.link === 'no_video') {
    return null;
  }

  return exercise?.video_url || 
    (exercise?.link?.includes('youtu') ? exercise.link : null) ||
    (exercise?.id && MATCHED_MAP[exercise.id]) ||
    (fallbackId && MATCHED_MAP[fallbackId]) ||
    (exercise?.id && KNOWN_EXERCISE_VIDEOS[exercise.id]) ||
    (fallbackId && KNOWN_EXERCISE_VIDEOS[fallbackId]) ||
    (exercise?.name && KNOWN_EXERCISE_VIDEOS[exercise.name.toLowerCase().trim()]) ||
    null;
}

export interface ExerciseDetailViewProps {
  exercise: ExerciseLibrary;
  showAddToWorkout?: boolean;
  onAddToWorkout?: () => void;
  notes?: string;
  onNotesChange?: (text: string) => void;
  onNotesBlur?: () => void;
  notesPlaceholder?: string;
  savingNotes?: boolean;
}

export default function ExerciseDetailView({
  exercise,
  showAddToWorkout = false,
  onAddToWorkout,
  notes,
  onNotesChange,
  onNotesBlur,
  notesPlaceholder = 'Skriv dina anteckningar här...',
  savingNotes = false,
}: ExerciseDetailViewProps) {
  const [mediaMode, setMediaMode] = useState<'video' | 'gif'>('video');

  const videoUrl = resolveExerciseVideoUrl(exercise);
  const hasVideo = Boolean(videoUrl);
  const hasGif = Boolean(exercise?.gifUrl);

  const openLink = () => {
    if (exercise?.link) {
      Linking.openURL(exercise.link);
    }
  };

  return (
    <View style={styles.container}>
      {/* Main Exercise Card */}
      <View style={styles.card}>
        {/* Media Mode Switcher (if both Video and GIF are available) */}
        {hasVideo && hasGif && (
          <View style={styles.mediaToggleContainer}>
            <TouchableOpacity
              style={[styles.mediaToggleButton, mediaMode === 'video' && styles.mediaToggleButtonActive]}
              onPress={() => setMediaMode('video')}
              activeOpacity={0.7}
            >
              <Video size={16} color={mediaMode === 'video' ? '#0A0A0A' : '#94A3B8'} />
              <Text style={[styles.mediaToggleText, mediaMode === 'video' && styles.mediaToggleTextActive]}>
                Video
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mediaToggleButton, mediaMode === 'gif' && styles.mediaToggleButtonActive]}
              onPress={() => setMediaMode('gif')}
              activeOpacity={0.7}
            >
              <ImageIcon size={16} color={mediaMode === 'gif' ? '#0A0A0A' : '#94A3B8'} />
              <Text style={[styles.mediaToggleText, mediaMode === 'gif' && styles.mediaToggleTextActive]}>
                GIF
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Video or GIF Media Display */}
        {hasVideo && (!hasGif || mediaMode === 'video') ? (
          <ExerciseVideoPlayer videoSource={videoUrl} />
        ) : hasGif ? (
          <Image 
            source={{ uri: exercise.gifUrl }} 
            style={styles.detailImage} 
            contentFit="cover"
            autoplay={true}
          />
        ) : null}

        {/* Exercise Title */}
        <View style={styles.titleSection}>
          <Text style={styles.cardHeaderTitle}>{exercise.name}</Text>
        </View>

        {/* Tags / Chips (Muscle Group, Target Muscle, Equipment) */}
        <View style={styles.tagsContainer}>
          {exercise.muscle_group && (
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{exercise.muscle_group}</Text>
            </View>
          )}

          {(() => {
            const target = exercise.target_muscle_sv || exercise.target_muscle;
            const group = exercise.muscle_group;
            if (!target) return null;
            
            // Skip duplicate if target is essentially identical to main muscle group
            const isSame = group && (
              target.toLowerCase().trim() === group.toLowerCase().trim() ||
              (target.toLowerCase() === 'axlar' && group.toLowerCase() === 'shoulders') ||
              (target.toLowerCase() === 'bröst' && group.toLowerCase() === 'chest') ||
              (target.toLowerCase() === 'rygg' && group.toLowerCase() === 'back') ||
              (target.toLowerCase() === 'ben' && group.toLowerCase() === 'legs') ||
              (target.toLowerCase() === 'armar' && group.toLowerCase() === 'arms')
            );
            if (isSame) return null;

            return (
              <View style={[styles.tagBadge, styles.targetTagBadge]}>
                <Text style={[styles.tagText, styles.targetTagText]}>
                  {target}
                </Text>
              </View>
            );
          })()}

          {exercise.equipment && (
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{exercise.equipment}</Text>
            </View>
          )}
        </View>

        {/* Add to Workout Button (only shown when requested) */}
        {showAddToWorkout && onAddToWorkout && (
          <TouchableOpacity style={styles.addToWorkoutButton} onPress={onAddToWorkout} activeOpacity={0.8}>
            <PlusCircle size={20} color="#0A0A0A" />
            <Text style={styles.addToWorkoutButtonText}>Add to workout</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Google Image/GIF Search Link */}
      <View style={styles.infoSection}>
        <TouchableOpacity 
          onPress={() => Linking.openURL(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(exercise.name + ' exercise gif')}`)}
          activeOpacity={0.7}
        >
          <Text style={styles.gifSearchLink}>
            🔍 Sök efter fler {exercise.name} GIFs / bilder
          </Text>
        </TouchableOpacity>
      </View>

      {/* Instructions Link (if available and not YouTube) */}
      {exercise.link && !exercise.link.includes('youtu') && (
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Instruktioner:</Text>
          <TouchableOpacity style={styles.linkBox} onPress={openLink} activeOpacity={0.7}>
            <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="tail">
              {exercise.link}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notes Section (if notes handler provided) */}
      {onNotesChange && (
        <View style={styles.infoSection}>
          <View style={styles.notesHeader}>
            <Text style={styles.sectionTitle}>Anteckningar:</Text>
            {savingNotes && <Text style={styles.savingNotesText}>Sparar...</Text>}
          </View>
          <TextInput 
            style={styles.notesInput}
            multiline
            value={notes}
            onChangeText={onNotesChange}
            onBlur={onNotesBlur}
            placeholder={notesPlaceholder}
            placeholderTextColor="#64748B"
            textAlignVertical="top"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  card: {
    backgroundColor: '#1E2028',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D3039',
  },
  mediaToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#0A0A0A',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  mediaToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  mediaToggleButtonActive: {
    backgroundColor: '#A3E635',
  },
  mediaToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  mediaToggleTextActive: {
    color: '#0A0A0A',
  },
  detailImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    marginBottom: 16,
  },
  titleSection: {
    marginBottom: 12,
  },
  cardHeaderTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: -0.3,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tagBadge: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D3039',
  },
  tagText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  targetTagBadge: {
    borderColor: '#A3E63544',
    backgroundColor: '#A3E63511',
  },
  targetTagText: {
    color: '#A3E635',
  },
  addToWorkoutButton: {
    backgroundColor: '#A3E635',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  addToWorkoutButtonText: {
    color: '#0A0A0A',
    fontWeight: '700',
    fontSize: 16,
  },
  infoSection: {
    marginBottom: 20,
  },
  gifSearchLink: {
    color: '#A3E635',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginVertical: 4,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  savingNotesText: {
    color: '#A3E635',
    fontSize: 12,
    fontWeight: '500',
  },
  linkBox: {
    backgroundColor: '#1E2028',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D3039',
    marginTop: 8,
  },
  linkText: {
    color: '#A3E635',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  notesInput: {
    backgroundColor: '#1E2028',
    color: '#F8FAFC',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D3039',
    minHeight: 100,
    fontSize: 14,
  },
});
