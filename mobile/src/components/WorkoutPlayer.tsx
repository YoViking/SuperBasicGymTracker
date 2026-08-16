import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, Platform, ScrollView, AppState, TextInput, KeyboardAvoidingView, Keyboard } from 'react-native';
import { Image } from 'expo-image';
import { Play, Pause, SkipForward, SkipBack, Timer, MoreHorizontal, Check, ChevronDown, X } from 'lucide-react-native';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { getMuscleGroupImage } from '../utils/images';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Don't show alert if the app is in the foreground
    shouldPlaySound: false, // Don't play notification sound if in foreground
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

const { width, height } = Dimensions.get('window');

interface WorkoutPlayerProps {
  activeExercise: any; // Using any here to avoid cyclic imports, or we can just pass the necessary data
  isExpanded: boolean;
  setIsExpanded: (b: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleSet: (setId: string, currentStatus: boolean) => void;
  onUpdateSet?: (setId: string, reps: number, weight: number) => void;
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
  onUpdateSet,
  workoutTimeElapsed,
  isWorkoutActive,
  setIsWorkoutActive,
  progressPercentage,
  onOptionsPress
}: WorkoutPlayerProps) {
  // Editing state for sets
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editReps, setEditReps] = useState<string>('');
  const [editWeight, setEditWeight] = useState<string>('');

  const handleStartEdit = (set: any) => {
    setEditingSetId(set.id);
    setEditReps(String(set.reps ?? ''));
    setEditWeight(String(set.weight ?? ''));
  };

  const handleCancelEdit = () => {
    Keyboard.dismiss();
    setEditingSetId(null);
    setEditReps('');
    setEditWeight('');
  };

  const handleSaveEdit = () => {
    if (!editingSetId) return;
    Keyboard.dismiss();
    const parsedReps = parseInt(editReps, 10) || 0;
    const parsedWeight = parseFloat(editWeight.replace(',', '.')) || 0;

    if (onUpdateSet) {
      onUpdateSet(editingSetId, parsedReps, parsedWeight);
    }

    if (activeExercise?.sets) {
      const targetSet = activeExercise.sets.find((s: any) => s.id === editingSetId);
      if (targetSet) {
        targetSet.reps = parsedReps;
        targetSet.weight = parsedWeight;
      }
    }

    setEditingSetId(null);
    setEditReps('');
    setEditWeight('');
  };

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
  const scheduledNotificationIdRef = useRef<string | null>(null);

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

  const scheduleNotification = async (seconds: number) => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: false,
            allowSound: true,
          },
        });
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        return;
      }

      if (scheduledNotificationIdRef.current) {
        await Notifications.cancelScheduledNotificationAsync(scheduledNotificationIdRef.current);
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Rest Time Over!",
          body: `Time for your next set of ${activeExercise?.exerciseName || 'exercise'}!`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          channelId: 'rest-timer',
        },
      });
      scheduledNotificationIdRef.current = id;
    } catch (e) {
      console.log('Error scheduling notification', e);
    }
  };

  const cancelNotification = async () => {
    try {
      if (scheduledNotificationIdRef.current) {
        await Notifications.cancelScheduledNotificationAsync(scheduledNotificationIdRef.current);
        scheduledNotificationIdRef.current = null;
      }
    } catch (e) {
      console.log('Error canceling notification', e);
    }
  };

  useEffect(() => {
    const requestNotificationPermission = async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: false,
              allowSound: true,
            },
          });
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('rest-timer', {
            name: 'Rest Timer Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#A3E635',
          });
        }
      } catch (e) {
        console.log('Error requesting notification permission', e);
      }
    };
    requestNotificationPermission();

    return () => {
      cancelNotification();
    };
  }, []);

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
      cancelNotification();
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
              cancelNotification();
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
      scheduleNotification(30);
    } else {
      setRestTimerSeconds(prev => {
        const next = prev + 30;
        setRestTimerMax(next);
        scheduleNotification(next);
        return next;
      });
    }
  };

  const resetRestTimer = () => {
    if (restTimerActive) {
      setRestTimerActive(false);
      setRestTimerSeconds(30);
      cancelNotification();
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
        onRequestClose={() => {
          if (editingSetId) {
            handleCancelEdit();
          } else {
            setIsExpanded(false);
          }
        }}
      >
        <KeyboardAvoidingView 
          style={{ flex: 1, backgroundColor: '#0A0A0A' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity 
              style={styles.collapseButton} 
              onPress={() => {
                if (editingSetId) {
                  handleCancelEdit();
                } else {
                  setIsExpanded(false);
                }
              }}
            >
              <ChevronDown size={32} color="#F8FAFC" />
            </TouchableOpacity>

            {editingSetId ? (
              <View style={styles.compactHeader}>
                {activeExercise.gifUrl ? (
                  <Image
                    source={{ uri: activeExercise.gifUrl }}
                    style={styles.compactThumbnail}
                    contentFit="cover"
                    autoplay={false}
                  />
                ) : (
                  <Image
                    source={getMuscleGroupImage(activeExercise.muscleGroup)}
                    style={styles.compactThumbnail}
                    contentFit="contain"
                    autoplay={false}
                  />
                )}
                <View style={styles.compactHeaderText}>
                  <Text style={styles.compactTitle} numberOfLines={1}>{activeExercise.exerciseName}</Text>
                  <Text style={styles.compactSubtitle}>Redigera reps & vikt</Text>
                </View>
              </View>
            ) : (
              activeExercise.gifUrl ? (
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
              )
            )}

            <ScrollView 
              style={styles.exerciseDetails} 
              contentContainerStyle={{ paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
            >
              {!editingSetId && (
                <Text style={styles.modalTitle}>{activeExercise.exerciseName}</Text>
              )}

              <View style={styles.setsContainer}>
                {activeExercise.sets.map((set: any) => {
                  const isEditing = editingSetId === set.id;
                  return (
                    <View key={set.id} style={[styles.setRow, isEditing && styles.setRowEditing]}>
                      <TouchableOpacity
                        style={[styles.checkbox, set.is_done && styles.checkboxChecked]}
                        onPress={() => handleToggleSet(set.id, set.is_done)}
                        activeOpacity={0.7}
                      >
                        {set.is_done && <Check size={16} color="#0A0A0A" strokeWidth={4} />}
                      </TouchableOpacity>
                      
                      {isEditing ? (
                        <View style={styles.setInfoEdit}>
                          <View style={styles.editInputsGroup}>
                            <View style={styles.editInputWrapper}>
                              <TextInput
                                style={styles.editInput}
                                value={editReps}
                                onChangeText={setEditReps}
                                keyboardType="numeric"
                                selectTextOnFocus
                                autoFocus
                                placeholder="0"
                                placeholderTextColor="#64748B"
                                returnKeyType="next"
                              />
                              <Text style={styles.editUnitText}>reps</Text>
                            </View>
                            <View style={styles.editInputWrapper}>
                              <TextInput
                                style={styles.editInput}
                                value={editWeight}
                                onChangeText={setEditWeight}
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                                placeholder="0"
                                placeholderTextColor="#64748B"
                                returnKeyType="done"
                                onSubmitEditing={handleSaveEdit}
                              />
                              <Text style={styles.editUnitText}>kg</Text>
                            </View>
                          </View>
                          <View style={styles.editActions}>
                            <TouchableOpacity style={styles.saveEditBtn} onPress={handleSaveEdit} activeOpacity={0.7}>
                              <Check size={18} color="#0A0A0A" strokeWidth={3} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelEditBtn} onPress={handleCancelEdit} activeOpacity={0.7}>
                              <X size={18} color="#94A3B8" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.setInfo}
                          onLongPress={() => handleStartEdit(set)}
                          delayLongPress={350}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.setText}>{set.reps} reps</Text>
                          <Text style={styles.weightText}>{set.weight} kg</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {!editingSetId && (
              <>
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
              </>
            )}
          </View>
        </KeyboardAvoidingView>
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
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#18181B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 12,
  },
  compactThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  compactHeaderText: {
    flex: 1,
  },
  compactTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
  },
  compactSubtitle: {
    color: '#A3E635',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
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
    minHeight: 44,
  },
  setRowEditing: {
    backgroundColor: '#18181B',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3F3F46',
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
  setInfoEdit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editInputsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  editInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2024',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3F3F46',
    paddingHorizontal: 8,
    height: 38,
  },
  editInput: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  editUnitText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 2,
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  saveEditBtn: {
    backgroundColor: '#A3E635',
    borderRadius: 8,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelEditBtn: {
    backgroundColor: '#27272A',
    borderRadius: 8,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
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
