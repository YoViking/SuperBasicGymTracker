import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, Platform, ScrollView, AppState } from 'react-native';
import { Image } from 'expo-image';
import { Play, Pause, SkipForward, SkipBack, Timer, MoreHorizontal, Check, ChevronDown } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { getMuscleGroupImage } from '../utils/images';

const { width, height } = Dimensions.get('window');

interface WorkoutPlayerProps {
  activeExercise: any; // Using any here to avoid cyclic imports, or we can just pass the necessary data
  isExpanded: boolean;
  setIsExpanded: (b: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleSet: (setId: string, currentStatus: boolean) => void;
  workoutTimeElapsed: number;
  isWorkoutActive: boolean;
  setIsWorkoutActive: (b: boolean) => void;
  progressPercentage: number;
  onOptionsPress: () => void;
}

export default function WorkoutPlayer({
  activeExercise,
  isExpanded,
  setIsExpanded,
  onNext,
  onPrevious,
  onToggleSet,
  workoutTimeElapsed,
  isWorkoutActive,
  setIsWorkoutActive,
  progressPercentage,
  onOptionsPress
}: WorkoutPlayerProps) {
  // When a set is checked off, we handle it
  const handleToggleSet = (setId: string, currentStatus: boolean) => {
    onToggleSet(setId, currentStatus);
    
    // Check if all sets are now done
    const allWillBeDone = activeExercise.sets.every((s: any) => s.id === setId ? true : s.is_done);
    if (allWillBeDone && !currentStatus) {
      // Auto-advance after a small delay
      setTimeout(() => {
        onNext();
      }, 500);
    }
  };

  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimerSeconds, setRestTimerSeconds] = useState(30);
  const [restTimerMax, setRestTimerMax] = useState(30);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  async function playSound() {
    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/ding.wav')
      );
      setSound(newSound);
      await newSound.playAsync();
    } catch (e) {
      console.log('Could not play sound', e);
    }
  }

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (restTimerActive && restTimerSeconds > 0) {
      interval = setInterval(() => {
        setRestTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (restTimerActive && restTimerSeconds === 0) {
      // Timer finished!
      setRestTimerActive(false);
      playSound();
    }
    return () => clearInterval(interval);
  }, [restTimerActive, restTimerSeconds]);

  const appState = useRef(AppState.currentState);
  const backgroundTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (backgroundTimeRef.current && restTimerActive) {
          const timeAway = Math.floor((Date.now() - backgroundTimeRef.current) / 1000);
          setRestTimerSeconds(prev => {
            const remaining = prev - timeAway;
            if (remaining <= 0) {
              setRestTimerActive(false);
              playSound();
              return 0;
            }
            return remaining;
          });
        }
        backgroundTimeRef.current = null;
      } else if (nextAppState.match(/inactive|background/)) {
        backgroundTimeRef.current = Date.now();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [restTimerActive]);

  const toggleRestTimer = () => {
    if (!restTimerActive) {
      setRestTimerSeconds(30);
      setRestTimerMax(30);
      setRestTimerActive(true);
    } else {
      setRestTimerSeconds(prev => {
        const next = prev + 30;
        setRestTimerMax(next);
        return next;
      });
    }
  };

  const resetRestTimer = () => {
    if (restTimerActive) {
      setRestTimerActive(false);
      setRestTimerSeconds(30);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!activeExercise) return null;

  return (
    <>
      {/* Folded Mini Player */}
      {!isExpanded && (
        <TouchableOpacity 
          style={styles.miniPlayer} 
          activeOpacity={0.9}
          onPress={() => setIsExpanded(true)}
        >
          <View style={styles.miniPlayerContent}>
            <Text style={styles.miniPlayerTitle} numberOfLines={1}>
              {activeExercise.exerciseName}
            </Text>
            <View style={styles.miniPlayerControls}>
              <TouchableOpacity onPress={() => setIsWorkoutActive(!isWorkoutActive)} style={styles.miniIconButton}>
                {isWorkoutActive ? <Pause size={24} color="#0A0A0A" /> : <Play size={24} color="#0A0A0A" fill="#0A0A0A" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={onNext} style={styles.miniIconButton}>
                <SkipForward size={24} color="#0A0A0A" fill="#0A0A0A" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Upfolded Modal */}
      <Modal
        visible={isExpanded}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsExpanded(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.collapseButton} onPress={() => setIsExpanded(false)}>
            <ChevronDown size={32} color="#F8FAFC" />
          </TouchableOpacity>

          {activeExercise.gifUrl ? (
            <Image 
              source={{ uri: activeExercise.gifUrl }} 
              style={styles.largeImage} 
              contentFit="cover"
              autoplay={isWorkoutActive}
            />
          ) : (
            <Image 
              source={getMuscleGroupImage(activeExercise.muscleGroup)} 
              style={styles.largeImage} 
              contentFit="contain"
              autoplay={false}
            />
          )}

          <ScrollView style={styles.exerciseDetails} contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={styles.modalTitle}>{activeExercise.exerciseName}</Text>
            
            <View style={styles.setsContainer}>
              {activeExercise.sets.map((set: any) => (
                <View key={set.id} style={styles.setRow}>
                  <TouchableOpacity 
                    style={[styles.checkbox, set.is_done && styles.checkboxChecked]} 
                    onPress={() => handleToggleSet(set.id, set.is_done)}
                    activeOpacity={0.7}
                  >
                    {set.is_done && <Check size={16} color="#0A0A0A" strokeWidth={4} />}
                  </TouchableOpacity>
                  <View style={styles.setInfo}>
                    <Text style={styles.setText}>{set.reps} reps</Text>
                    <Text style={styles.weightText}>{set.weight} kg</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.playerBottom}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: restTimerActive ? `${(restTimerSeconds / restTimerMax) * 100}%` : `${progressPercentage}%` },
                    restTimerActive && { backgroundColor: '#A3E635' }
                  ]} 
                />
              </View>
              <Text style={styles.timeText}>
                {restTimerActive ? formatTime(restTimerSeconds) : formatTime(workoutTimeElapsed)}
              </Text>
            </View>

            <View style={styles.mainControls}>
              <View style={styles.playControlsGroup}>
                <TouchableOpacity onPress={onPrevious}>
                  <SkipBack size={36} color="#F8FAFC" fill="#F8FAFC" />
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => setIsWorkoutActive(!isWorkoutActive)} style={styles.playButton}>
                  {isWorkoutActive ? <Pause size={48} color="#0A0A0A" /> : <Play size={48} color="#0A0A0A" fill="#0A0A0A" />}
                </TouchableOpacity>
                
                <TouchableOpacity onPress={onNext}>
                  <SkipForward size={36} color="#F8FAFC" fill="#F8FAFC" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.timerBtn} 
                onPress={toggleRestTimer}
                onLongPress={resetRestTimer}
                delayLongPress={500}
              >
                <Timer size={28} color={restTimerActive ? "#A3E635" : "#F8FAFC"} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.moreBtn} onPress={onOptionsPress}>
            <MoreHorizontal size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  miniPlayer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#2D3039',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  miniPlayerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniPlayerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    paddingLeft: 8,
  },
  miniPlayerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniIconButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
  },
  collapseButton: {
    alignItems: 'center',
    padding: 8,
  },
  largeImage: {
    width: width * 0.75,
    height: width * 0.75,
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
    marginBottom: 16,
    borderRadius: 16, // Optional: add some rounding if desired, though 1:1 square is fine
  },
  exerciseDetails: {
    paddingHorizontal: 16,
    flex: 1,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  setsContainer: {
    gap: 16,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 28,
    height: 28,
    backgroundColor: '#D1D5DB',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  checkboxChecked: {
    backgroundColor: '#A3E635',
  },
  setInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  setText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '500',
  },
  weightText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '500',
  },
  playerBottom: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 64, // Extra space at bottom to prevent overlap with moreBtn
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#3F3F46',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 2,
  },
  timeText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 16,
  },
  playControlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
  },
  timerBtn: {
    position: 'absolute',
    right: 0,
    padding: 8,
  },
  playButton: {
    backgroundColor: '#F8FAFC',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
