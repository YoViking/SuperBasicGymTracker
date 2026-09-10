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
} from 'lucide-react-native';
import {
  fetchAIProgram,
  mapProgramToLibrary,
  saveProgramToDatabase,
  checkExistingProgram,
  MatchedProgram,
} from '../services/ai';
import { onboardingService } from '../services/onboardingService';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import {
  EQUIPMENT_OPTIONS,
  SPLIT_OPTIONS,
  DURATION_OPTIONS,
  StepEquipment,
  StepInjuries,
  StepGoals,
  WizardLoading,
  wizardStyles,
} from './ai-wizard';

interface AiProgramWizardProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const { width } = Dimensions.get('window');

export default function AiProgramWizard({ visible, onClose, onSaved }: AiProgramWizardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Location & Equipment State
  const [location, setLocation] = useState('Gym');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(EQUIPMENT_OPTIONS);

  // Step 2: Frequency & Duration & Split State
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [duration, setDuration] = useState('60m');
  const [splitType, setSplitType] = useState('Auto/AI Recommendation');

  // Step 3: Injuries & Exclusions State
  const [selectedInjuries, setSelectedInjuries] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState('');

  // Step 4: Fitness Goal State
  const [fitnessGoal, setFitnessGoal] = useState('Muscle Growth (Hypertrophy)');
  const [experienceLevel, setExperienceLevel] = useState('intermediate');

  // Loading & Generation State
  const [generating, setGenerating] = useState(false);
  const [matchedProgram, setMatchedProgram] = useState<MatchedProgram | null>(null);
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
          if (profile.daysPerWeek) setDaysPerWeek(profile.daysPerWeek);
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
    const targetProgress = matchedProgram ? 1.0 : currentStep / 4;
    Animated.timing(progressAnim, {
      toValue: targetProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep, matchedProgram]);

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

      const rawProgram = await fetchAIProgram({
        location,
        equipment: selectedEquipment,
        daysPerWeek,
        duration,
        splitType,
        injuries: selectedInjuries,
        exclusions,
        fitnessGoal,
        experienceLevel,
      });

      const matched = await mapProgramToLibrary(rawProgram, {
        allowedEquipment: selectedEquipment,
        experienceLevel,
      });
      setMatchedProgram(matched);
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Misslyckades att generera program', ToastAndroid.LONG);
      } else {
        Alert.alert('Fel', 'Misslyckades att generera program: ' + (e.message || 'Okänt fel'));
      }
    } finally {
      setGenerating(false);
    }
  };

  const performSaveProgram = async (overwriteFolderId?: string) => {
    if (!matchedProgram || !user) return;
    try {
      setSaving(true);
      const folderId = await saveProgramToDatabase(matchedProgram, user.id, overwriteFolderId);

      if (Platform.OS === 'android') {
        ToastAndroid.show(
          overwriteFolderId ? 'Programmet har ersatts!' : 'Program sparat!',
          ToastAndroid.SHORT
        );
      }

      onSaved();
      onClose();

      router.push({
        pathname: '/folder/[id]',
        params: { id: folderId, name: matchedProgram.programName },
      });
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Kunde inte spara program', ToastAndroid.SHORT);
      } else {
        Alert.alert('Fel', 'Kunde inte spara programmet: ' + (e.message || 'Okänt fel'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProgram = async () => {
    if (!matchedProgram || !user || saving) return;

    try {
      setSaving(true);
      const existing = await checkExistingProgram(matchedProgram.programName, user.id);
      setSaving(false);

      if (existing.exists && existing.existingFolderId) {
        Alert.alert(
          'Programmet finns redan',
          `Ett program med namnet "${existing.existingFolderName || matchedProgram.programName}" finns redan.\n\nVill du ersätta det gamla programmet eller avbryta?`,
          [
            { text: 'Avbryt', style: 'cancel' },
            {
              text: 'Ersätt / Skriv över',
              style: 'destructive',
              onPress: () => performSaveProgram(existing.existingFolderId),
            },
          ]
        );
      } else {
        await performSaveProgram();
      }
    } catch (err: any) {
      setSaving(false);
      console.error('Error during pre-save duplicate check:', err);
      await performSaveProgram();
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setLocation('Gym');
    setSelectedEquipment(EQUIPMENT_OPTIONS);
    setDaysPerWeek(3);
    setDuration('60m');
    setSplitType('Auto/AI Recommendation');
    setSelectedInjuries([]);
    setExclusions('');
    setFitnessGoal('Muscle Growth (Hypertrophy)');
    setMatchedProgram(null);
    setSaving(false);
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  // Program-specific Step 2: Days per week + Duration + Split
  const renderProgramStep2 = () => {
    return (
      <View style={wizardStyles.stepContainer}>
        <Text style={wizardStyles.stepTitle}>Hur ser ditt schema ut?</Text>

        {/* Frequency selector (1 to 7) */}
        <Text style={wizardStyles.sectionLabel}>Pass per vecka</Text>
        <View style={wizardStyles.daysSelectorRow}>
          {[1, 2, 3, 4, 5, 6, 7].map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                wizardStyles.dayCircle,
                daysPerWeek === num && wizardStyles.activeDayCircle,
              ]}
              onPress={() => setDaysPerWeek(num)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  wizardStyles.dayCircleText,
                  daysPerWeek === num && wizardStyles.activeDayCircleText,
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Target workout duration */}
        <Text style={wizardStyles.sectionLabel}>Måltid per träningspass</Text>
        <View style={wizardStyles.durationRow}>
          {DURATION_OPTIONS.map((time) => (
            <TouchableOpacity
              key={time}
              style={[
                wizardStyles.durationChip,
                duration === time && wizardStyles.activeDurationChip,
              ]}
              onPress={() => setDuration(time)}
              activeOpacity={0.8}
            >
              <Clock
                size={14}
                color={duration === time ? '#0A0A0A' : '#94A3B8'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  wizardStyles.durationText,
                  duration === time && wizardStyles.activeDurationText,
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
          ))}
        </View>

        {/* Split Type Selector */}
        <Text style={wizardStyles.sectionLabel}>Träningssplit</Text>
        <ScrollView style={wizardStyles.splitScroll} showsVerticalScrollIndicator={false}>
          {SPLIT_OPTIONS.map((split) => (
            <TouchableOpacity
              key={split}
              style={[
                wizardStyles.splitCard,
                splitType === split && wizardStyles.activeSplitCard,
              ]}
              onPress={() => setSplitType(split)}
              activeOpacity={0.8}
            >
              <View style={wizardStyles.splitCardHeader}>
                <Text
                  style={[
                    wizardStyles.splitText,
                    splitType === split && wizardStyles.activeSplitText,
                  ]}
                >
                  {split === 'Auto/AI Recommendation' ? 'Auto / AI-Rekommendation ✨' : split}
                </Text>
                {splitType === split && <Check size={16} color="#A3E635" />}
              </View>
            </TouchableOpacity>
          ))}
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
        return renderProgramStep2();
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

  // Render Review Screen for Program
  const renderReviewScreen = () => {
    if (!matchedProgram) return null;

    return (
      <View style={wizardStyles.reviewContainer}>
        <View style={wizardStyles.reviewHeader}>
          <Sparkles size={24} color="#A3E635" />
          <Text style={wizardStyles.reviewTitle}>Ditt AI-Program Är Redo!</Text>
        </View>

        <ScrollView style={wizardStyles.reviewScroll} showsVerticalScrollIndicator={false}>
          <View style={wizardStyles.programMetaCard}>
            <Text style={wizardStyles.programName}>{matchedProgram.programName}</Text>
            <Text style={wizardStyles.programDescription}>{matchedProgram.description}</Text>
            <View style={wizardStyles.metaBadgeRow}>
              <View style={wizardStyles.metaBadge}>
                <Text style={wizardStyles.metaBadgeText}>
                  {matchedProgram.daysPerWeek} Pass/vecka
                </Text>
              </View>
              <View style={wizardStyles.metaBadge}>
                <Text style={wizardStyles.metaBadgeText}>{duration} Passlängd</Text>
              </View>
            </View>
          </View>

          <Text style={wizardStyles.reviewWorkoutsLabel}>Genererade pass:</Text>

          {(matchedProgram.workouts || []).map((workout, wIdx) => (
            <View key={wIdx} style={wizardStyles.reviewWorkoutCard}>
              <View style={wizardStyles.reviewWorkoutHeader}>
                <Text style={wizardStyles.reviewWorkoutName}>{workout.dayName}</Text>
                <Text style={wizardStyles.reviewWorkoutFocus} numberOfLines={1}>
                  {workout.targetFocus}
                </Text>
              </View>

              <View style={wizardStyles.reviewExercisesList}>
                {(workout.exercises || []).map((ex, exIdx) => {
                  const isMatched = !!ex.matchedExerciseId;
                  return (
                    <View key={exIdx} style={wizardStyles.reviewExerciseItem}>
                      <View style={wizardStyles.exerciseHeaderRow}>
                        <Text style={wizardStyles.reviewExerciseName} numberOfLines={1}>
                          {ex.exerciseName}
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
          ))}
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
            onPress={handleSaveProgram}
            style={[wizardStyles.wizardButton, wizardStyles.nextBtn]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <>
                <Text style={wizardStyles.nextBtnText}>SPARA PROGRAM</Text>
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
          <WizardLoading title="Genererar Program..." />
        ) : matchedProgram ? (
          renderReviewScreen()
        ) : (
          <View style={wizardStyles.wizardContainer}>
            {/* Header */}
            <View style={wizardStyles.header}>
              <View>
                <Text style={wizardStyles.headerTitle}>AI Program Skapare</Text>
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
                  <Text style={wizardStyles.generateBtnText}>SKAPA PROGRAM</Text>
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
