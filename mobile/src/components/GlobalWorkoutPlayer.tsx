import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, Platform } from 'react-native';
import { useSegments, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dumbbell, Repeat, Trash2, CheckCircle2, XCircle } from 'lucide-react-native';
import { useWorkoutSession } from '../context/WorkoutSessionContext';
import WorkoutPlayer from './WorkoutPlayer';
import WorkoutSummaryModal from './WorkoutSummaryModal';

export default function GlobalWorkoutPlayer() {
  const segments = useSegments();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    activeWorkout,
    activeExercise,
    isPlayerExpanded,
    setIsPlayerExpanded,
    handleNextExercise,
    handlePreviousExercise,
    toggleSetStatus,
    handleUpdateSet,
    workoutTimeElapsed,
    isWorkoutActive,
    setIsWorkoutActive,
    progressPercentage,
    openExerciseOptions,
    optionsModalVisible,
    closeExerciseOptions,
    handleGoToExercise,
    handleChangeExercise,
    handleRemoveExerciseFromWorkout,
    finishWorkout,
    discardWorkout,
    summaryModalVisible,
    summaryData,
    handleCloseSummary,
  } = useWorkoutSession();

  const handleWorkoutTitlePress = () => {
    if (activeWorkout) {
      setIsPlayerExpanded(false);
      router.push(`/workout/${activeWorkout.id}`);
    }
  };

  if (!activeExercise) {
    return (
      <WorkoutSummaryModal
        visible={summaryModalVisible}
        summary={summaryData}
        onClose={handleCloseSummary}
      />
    );
  }

  // Calculate bottom offset according to current screen's bottom nav
  const segs = segments as string[];
  const isTabsScreen = segs[0] === '(tabs)';
  const isWorkoutDetailScreen = segs[0] === 'workout';
  const hasBottomNav = isTabsScreen || isWorkoutDetailScreen;

  const defaultNavHeight = Platform.OS === 'ios' ? 90 : 74;
  const bottomNavHeight = hasBottomNav ? defaultNavHeight : Math.max(insets.bottom, 0);

  return (
    <>
      <WorkoutPlayer
        activeExercise={activeExercise}
        workoutName={activeWorkout?.name}
        onWorkoutTitlePress={handleWorkoutTitlePress}
        isExpanded={isPlayerExpanded}
        setIsExpanded={setIsPlayerExpanded}
        onNext={handleNextExercise}
        onPrevious={handlePreviousExercise}
        onToggleSet={toggleSetStatus}
        onUpdateSet={handleUpdateSet}
        workoutTimeElapsed={workoutTimeElapsed}
        isWorkoutActive={isWorkoutActive}
        setIsWorkoutActive={setIsWorkoutActive}
        progressPercentage={progressPercentage}
        onOptionsPress={() => openExerciseOptions(activeExercise.exerciseId)}
        bottomNavHeight={bottomNavHeight}
      />

      {/* Options Bottom Sheet */}
      <Modal
        visible={optionsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeExerciseOptions}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalOverlayDismiss} activeOpacity={1} onPress={closeExerciseOptions} />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHeader}>
              <View style={styles.bottomSheetHandle} />
            </View>

            <TouchableOpacity style={styles.optionRow} onPress={handleGoToExercise}>
              <Dumbbell size={24} color="#A3E635" />
              <Text style={styles.optionText}>Gå till övning</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={handleChangeExercise}>
              <Repeat size={24} color="#F8FAFC" />
              <Text style={styles.optionTextWhite}>Byt övning</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={handleRemoveExerciseFromWorkout}>
              <Trash2 size={24} color="#FF3B3E" />
              <Text style={styles.optionTextRed}>Ta bort övning från workout</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.optionRow, { borderTopWidth: 1, borderTopColor: '#27272A', marginTop: 8, paddingTop: 16 }]} 
              onPress={() => {
                closeExerciseOptions();
                finishWorkout();
              }}
            >
              <CheckCircle2 size={24} color="#A3E635" />
              <Text style={styles.optionText}>Slutför Workout</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionRow} 
              onPress={() => {
                closeExerciseOptions();
                discardWorkout();
              }}
            >
              <XCircle size={24} color="#94A3B8" />
              <Text style={styles.optionTextWhite}>Avbryt träningspass</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Workout Completion Summary Card */}
      <WorkoutSummaryModal
        visible={summaryModalVisible}
        summary={summaryData}
        onClose={handleCloseSummary}
      />
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalOverlayDismiss: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: '#18181B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },
  bottomSheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bottomSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#3F3F46',
    borderRadius: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 16,
  },
  optionText: {
    color: '#A3E635',
    fontSize: 16,
    fontWeight: '600',
  },
  optionTextWhite: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  optionTextRed: {
    color: '#FF3B3E',
    fontSize: 16,
    fontWeight: '600',
  },
});
