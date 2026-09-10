import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  ToastAndroid,
  Alert,
} from 'react-native';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Folder as FolderIcon,
} from 'lucide-react-native';
import {
  fetchAISingleWorkout,
  mapWorkoutToLibrary,
  saveSingleWorkoutToDatabase,
  MatchedWorkout,
} from '../services/ai';
import { onboardingService } from '../services/onboardingService';
import { useAuth } from '../context/AuthContext';
import { Folder } from '../types';
import { useRouter } from 'expo-router';
import {
  EQUIPMENT_OPTIONS,
  WORKOUT_FOCUS_OPTIONS,
  DURATION_OPTIONS,
  GOAL_OPTIONS,
  StepEquipment,
  StepInjuries,
  StepGoals,
  WizardLoading,
  wizardStyles,
} from './ai-wizard';

interface AiWorkoutWizardProps {
  visible: boolean;
  folders?: Folder[];
  onClose: () => void;
  onSaved: (workoutId?: string) => void;
}

const { width } = Dimensions.get('window');

export default function AiWorkoutWizard({
  visible,
  folders = [],
  onClose,
  onSaved,
}: AiWorkoutWizardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Location & Equipment State
  const [location, setLocation] = useState('Gym');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(EQUIPMENT_OPTIONS);

  // Step 2: Upplägg State (Duration + Focus + Optional Folder, NO "pass per vecka")
  const [duration, setDuration] = useState('45m');
  const [focus, setFocus] = useState('Bröst & Triceps');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Step 3: Injuries & Exclusions State
  const [selectedInjuries, setSelectedInjuries] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState('');

  // Step 4: Fitness Goal State
  const [fitnessGoal, setFitnessGoal] = useState('Muscle Growth (Hypertrophy)');
  const [experienceLevel, setExperienceLevel] = useState('intermediate');

  // Loading & Generation State
  const [generating, setGenerating] = useState(false);
  const [matchedWorkout, setMatchedWorkout] = useState<MatchedWorkout | null>(null);
  const [saving, setSaving] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0.25)).current;

  // Pre-load saved user profile preferences
  useEffect(() => {
    if (user?.id && visible) {
      onboardingService.getOnboardingProfile(user.id).then((profile) => {
        if (profile) {
          if (profile.location) setLocation(profile.location);
          if (profile.equipment && profile.equipment.length > 0) {
            setSelectedEquipment(profile.equipment);
          }
          if (profile.duration) setDuration(profile.duration);
          if (profile.injuries) setSelectedInjuries(profile.injuries);
          if (profile.exclusions) setExclusions(profile.exclusions);
          if (profile.fitnessGoal) setFitnessGoal(profile.fitnessGoal);
          if (profile.experienceLevel) setExperienceLevel(profile.experienceLevel);
        }
      });
    }
  }, [user?.id, visible]);

  // Handle Progress Bar Animation
  useEffect(() => {
    const targetProgress = matchedWorkout ? 1.0 : currentStep / 4;
    Animated.timing(progressAnim, {
      toValue: targetProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep, matchedWorkout]);

  const handleNext = () => {
    if (currentStep < 4) {
      Animated.timing(slideAnim, {
        toValue: -width,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep((prev) => prev + 1);
        slideAnim.setValue(width);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      Animated.timing(slideAnim, {
        toValue: width,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep((prev) => prev - 1);
        slideAnim.setValue(-width);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const handleSelectAllEquipment = () => {
    if (selectedEquipment.length === EQUIPMENT_OPTIONS.length) {
      setSelectedEquipment([]);
    } else {
      setSelectedEquipment([...EQUIPMENT_OPTIONS]);
    }
  };

  const handleToggleEquipment = (eq: string) => {
    if (selectedEquipment.includes(eq)) {
      setSelectedEquipment(selectedEquipment.filter((item) => item !== eq));
    } else {
      setSelectedEquipment([...selectedEquipment, eq]);
    }
  };

  const handleToggleInjury = (injury: string) => {
    if (selectedInjuries.includes(injury)) {
      setSelectedInjuries(selectedInjuries.filter((item) => item !== injury));
    } else {
      setSelectedInjuries([...selectedInjuries, injury]);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);

      const targetFocusName = focus === 'Auto / AI-Rekommendation ✨' ? 'Helkropp' : focus;
      const workoutName = `${targetFocusName} AI`;

      const generated = await fetchAISingleWorkout({
        workoutName,
        focus: targetFocusName,
        duration,
        equipment: selectedEquipment,
        location,
        injuries: selectedInjuries,
        exclusions,
        fitnessGoal,
        experienceLevel,
      });

      const matched = await mapWorkoutToLibrary(generated, {
        allowedEquipment: selectedEquipment,
        experienceLevel,
      });
      setMatchedWorkout(matched);
    } catch (e: any) {
      console.error('Error generating AI workout:', e);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Misslyckades att generera träningspass', ToastAndroid.LONG);
      } else {
        Alert.alert('Fel', 'Misslyckades att generera pass: ' + (e.message || 'Okänt fel'));
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveWorkout = async () => {
    if (!matchedWorkout || !user || saving) return;

    try {
      setSaving(true);
      const workoutId = await saveSingleWorkoutToDatabase(
        matchedWorkout,
        user.id,
        selectedFolderId
      );

      if (Platform.OS === 'android') {
        ToastAndroid.show('Träningspass sparat!', ToastAndroid.SHORT);
      }

      onSaved(workoutId);
      handleClose();

      // Navigate to the newly created workout detail screen
      router.push(`/workout/${workoutId}`);
    } catch (e: any) {
      console.error('Error saving AI workout:', e);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Kunde inte spara träningspass', ToastAndroid.SHORT);
      } else {
        Alert.alert('Fel', 'Kunde inte spara träningspasset: ' + (e.message || 'Okänt fel'));
      }
    } finally {
      setSaving(false);
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setLocation('Gym');
    setSelectedEquipment(EQUIPMENT_OPTIONS);
    setDuration('45m');
    setFocus('Bröst & Triceps');
    setSelectedFolderId(null);
    setSelectedInjuries([]);
    setExclusions('');
    setFitnessGoal('Muscle Growth (Hypertrophy)');
    setMatchedWorkout(null);
    setSaving(false);
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  // Render Step 2: Specific for Single Workout (Duration + Focus, NO "Pass per vecka")
  const renderWorkoutStep2 = () => {
    return (
      <View style={wizardStyles.stepContainer}>
        <Text style={wizardStyles.stepTitle}>Hur ser ditt träningspass ut?</Text>

        {/* Target workout duration */}
        <Text style={wizardStyles.sectionLabel}>Måltid per träningspass</Text>
        <View style={wizardStyles.durationRow}>
          {DURATION_OPTIONS.map((time) => {
            const isActive = duration === time;
            return (
              <TouchableOpacity
                key={time}
                style={[wizardStyles.durationChip, isActive && wizardStyles.activeDurationChip]}
                onPress={() => setDuration(time)}
                activeOpacity={0.8}
              >
                <Clock
                  size={14}
                  color={isActive ? '#0A0A0A' : '#94A3B8'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    wizardStyles.durationText,
                    isActive && wizardStyles.activeDurationText,
                  ]}
                >
                  {time === '30m'
                    ? '30 min'
                    : time === '45m'
                    ? '45 min'
                    : time === '60m'
                    ? '60 min'
                    : '90 min'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Focus / Muscle Group Selector */}
        <Text style={wizardStyles.sectionLabel}>Fokus / Muskelgrupp</Text>
        <ScrollView style={wizardStyles.splitScroll} showsVerticalScrollIndicator={false}>
          {WORKOUT_FOCUS_OPTIONS.map((foc) => {
            const isActive = focus === foc;
            return (
              <TouchableOpacity
                key={foc}
                style={[wizardStyles.splitCard, isActive && wizardStyles.activeSplitCard]}
                onPress={() => setFocus(foc)}
                activeOpacity={0.8}
              >
                <View style={wizardStyles.splitCardHeader}>
                  <Text
                    style={[
                      wizardStyles.splitText,
                      isActive && wizardStyles.activeSplitText,
                    ]}
                  >
                    {foc}
                  </Text>
                  {isActive && <Check size={16} color="#A3E635" />}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Optional Program / Folder assignment */}
          {folders.length > 0 && (
            <View style={{ marginTop: 12, marginBottom: 20 }}>
              <Text style={wizardStyles.sectionLabel}>Lägg till i program (valfritt)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={wizardStyles.folderChipsContainer}
              >
                <TouchableOpacity
                  style={[
                    wizardStyles.folderChip,
                    selectedFolderId === null && wizardStyles.folderChipActive,
                  ]}
                  onPress={() => setSelectedFolderId(null)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      wizardStyles.folderChipText,
                      selectedFolderId === null && wizardStyles.folderChipTextActive,
                    ]}
                  >
                    Inget (Fristående)
                  </Text>
                </TouchableOpacity>
                {folders.map((f) => {
                  const isSelected = selectedFolderId === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[
                        wizardStyles.folderChip,
                        isSelected && wizardStyles.folderChipActive,
                      ]}
                      onPress={() => setSelectedFolderId(f.id)}
                      activeOpacity={0.7}
                    >
                      <FolderIcon
                        size={14}
                        color={isSelected ? '#A3E635' : '#94A3B8'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          wizardStyles.folderChipText,
                          isSelected && wizardStyles.folderChipTextActive,
                        ]}
                      >
                        {f.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepEquipment
            location={location}
            onSelectLocation={setLocation}
            selectedEquipment={selectedEquipment}
            onToggleEquipment={handleToggleEquipment}
            onSelectAllEquipment={handleSelectAllEquipment}
          />
        );
      case 2:
        return renderWorkoutStep2();
      case 3:
        return (
          <StepInjuries
            selectedInjuries={selectedInjuries}
            onToggleInjury={handleToggleInjury}
            exclusions={exclusions}
            onChangeExclusions={setExclusions}
          />
        );
      case 4:
        return (
          <StepGoals
            fitnessGoal={fitnessGoal}
            onSelectGoal={setFitnessGoal}
          />
        );
      default:
        return null;
    }
  };

  // Render Review Screen for Single Workout
  const renderReviewScreen = () => {
    if (!matchedWorkout) return null;

    const goalObj = GOAL_OPTIONS.find((g) => g.id === fitnessGoal);
    const goalLabel = goalObj ? goalObj.label : 'Anpassat';

    return (
      <View style={wizardStyles.reviewContainer}>
        <View style={wizardStyles.reviewHeader}>
          <Sparkles size={24} color="#A3E635" />
          <Text style={wizardStyles.reviewTitle}>Ditt AI-Pass Är Redo!</Text>
        </View>

        <ScrollView style={wizardStyles.reviewScroll} showsVerticalScrollIndicator={false}>
          <View style={wizardStyles.programMetaCard}>
            <Text style={wizardStyles.programName}>{matchedWorkout.dayName}</Text>
            <Text style={wizardStyles.programDescription}>
              Skräddarsytt {duration} pass med fokus på {matchedWorkout.targetFocus}.
            </Text>
            <View style={wizardStyles.metaBadgeRow}>
              <View style={wizardStyles.metaBadge}>
                <Text style={wizardStyles.metaBadgeText}>{duration} Passlängd</Text>
              </View>
              <View style={wizardStyles.metaBadge}>
                <Text style={wizardStyles.metaBadgeText}>
                  {matchedWorkout.exercises.length} Övningar
                </Text>
              </View>
              <View style={wizardStyles.metaBadge}>
                <Text style={wizardStyles.metaBadgeText}>{goalLabel}</Text>
              </View>
            </View>
          </View>

          <Text style={wizardStyles.reviewWorkoutsLabel}>Planerade övningar:</Text>

          <View style={wizardStyles.reviewWorkoutCard}>
            <View style={wizardStyles.reviewExercisesList}>
              {(matchedWorkout.exercises || []).map((ex, exIdx) => {
                const isMatched = !!ex.matchedExerciseId;
                return (
                  <View key={exIdx} style={wizardStyles.reviewExerciseItem}>
                    <View style={wizardStyles.exerciseHeaderRow}>
                      <Text style={wizardStyles.reviewExerciseName} numberOfLines={1}>
                        {ex.matchedExerciseName || ex.exerciseName}
                      </Text>
                      <View style={wizardStyles.matchStatusBadge}>
                        {isMatched ? (
                          <View style={wizardStyles.matchedLabelRow}>
                            <CheckCircle2 size={12} color="#A3E635" style={{ marginRight: 4 }} />
                            <Text style={wizardStyles.matchedLabelText}>Matchad</Text>
                          </View>
                        ) : (
                          <View style={wizardStyles.matchedLabelRow}>
                            <AlertCircle size={12} color="#F59E0B" style={{ marginRight: 4 }} />
                            <Text style={[wizardStyles.matchedLabelText, { color: '#F59E0B' }]}>
                              Skapad
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Text style={wizardStyles.reviewExerciseSubtext}>
                      {ex.sets} set × {ex.reps} reps | Vila: {ex.restSeconds}s
                    </Text>

                    {ex.notes && (
                      <Text style={wizardStyles.reviewExerciseNotes} numberOfLines={2}>
                        💡 {ex.notes}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={wizardStyles.reviewActions}>
          <TouchableOpacity
            onPress={resetWizard}
            style={[wizardStyles.wizardButton, wizardStyles.backBtn]}
            disabled={saving}
          >
            <Text style={wizardStyles.backBtnText}>GÖR OM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSaveWorkout}
            style={[wizardStyles.wizardButton, wizardStyles.nextBtn]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <>
                <Text style={wizardStyles.nextBtnText}>SPARA TRÄNINGSPASS</Text>
                <Check size={18} color="#0A0A0A" style={{ marginLeft: 6 }} strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={wizardStyles.overlay}>
        {generating ? (
          <WizardLoading title="Genererar Träningspass..." />
        ) : matchedWorkout ? (
          renderReviewScreen()
        ) : (
          <View style={wizardStyles.wizardContainer}>
            {/* Header */}
            <View style={wizardStyles.header}>
              <View>
                <Text style={wizardStyles.headerTitle}>AI Pass Skapare</Text>
                <Text style={wizardStyles.headerSubtitle}>Steg {currentStep} av 4</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={wizardStyles.closeButton}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Progress Bar */}
            <View style={wizardStyles.progressBarBg}>
              <Animated.View style={[wizardStyles.progressBarFill, { width: progressWidth }]} />
            </View>

            {/* Slideable step content */}
            <Animated.View
              style={[
                wizardStyles.stepContentContainer,
                { transform: [{ translateX: slideAnim }] },
              ]}
            >
              {renderStepContent()}
            </Animated.View>

            {/* Footer Navigation */}
            <View style={wizardStyles.footer}>
              {currentStep > 1 ? (
                <TouchableOpacity
                  onPress={handleBack}
                  style={[wizardStyles.wizardButton, wizardStyles.backBtn]}
                >
                  <ChevronLeft size={18} color="#F8FAFC" style={{ marginRight: 6 }} />
                  <Text style={wizardStyles.backBtnText}>TILLBAKA</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flex: 1 }} />
              )}

              {currentStep < 4 ? (
                <TouchableOpacity
                  onPress={handleNext}
                  style={[wizardStyles.wizardButton, wizardStyles.nextBtn]}
                >
                  <Text style={wizardStyles.nextBtnText}>NÄSTA</Text>
                  <ChevronRight size={18} color="#0A0A0A" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleGenerate}
                  style={[wizardStyles.wizardButton, wizardStyles.generateBtn]}
                >
                  <Text style={wizardStyles.generateBtnText}>SKAPA PASS</Text>
                  <Sparkles size={18} color="#0A0A0A" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
