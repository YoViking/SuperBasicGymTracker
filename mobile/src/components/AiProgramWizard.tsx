import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  ToastAndroid
} from 'react-native';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Check,
  Dumbbell,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Zap
} from 'lucide-react-native';
import { fetchAIProgram, mapProgramToLibrary, saveProgramToDatabase, MatchedProgram } from '../services/ai';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';

interface AiProgramWizardProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const { width, height } = Dimensions.get('window');

const STEPS = [
  { id: 1, title: 'Utrustning' },
  { id: 2, title: 'Upplägg' },
  { id: 3, title: 'Skador' },
  { id: 4, title: 'Mål' },
];

const LOCATIONS = ['Gym', 'Hem', 'Utomhus'];
const EQUIPMENT_OPTIONS = [
  'Bodyweight',
  'Dumbbell',
  'Barbell',
  'Cable',
  'Machine',
  'Kettlebell',
  'Resistance Bands',
];

const SPLIT_OPTIONS = [
  'Full Body',
  'Upper/Lower',
  'Push/Pull/Legs',
  'Split',
  'Auto/AI Recommendation'
];

const INJURY_OPTIONS = [
  'Wrists',
  'Knees',
  'Shoulders',
  'Lower Back',
  'Elbows',
  'Ankles'
];

const GOAL_OPTIONS = [
  { id: 'Muscle Growth (Hypertrophy)', label: 'Muskelmassa', desc: 'Hypertrofi och muskeltillväxt' },
  { id: 'Pure Strength', label: 'Styrka', desc: 'Maximal styrka och tunga lyft' },
  { id: 'General Fitness', label: 'Allmän Hälsa', desc: 'Komma i form och må bra' },
  { id: 'Endurance', label: 'Uthållighet', desc: 'Högintensivt och muskeluthållighet' }
];

const LOADING_MESSAGES = [
  'Analyserar dina val...',
  'Designar ett skräddarsytt program...',
  'Säkerställer skadeanpassning...',
  'Filtrerar passande övningar...',
  'Skapar träningsvolym och set-antal...',
  'Matchar med övningsdatabasen...',
  'Klar om ett ögonblick!'
];

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

  // Loading & Generation State
  const [generating, setGenerating] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [matchedProgram, setMatchedProgram] = useState<MatchedProgram | null>(null);
  const [saving, setSaving] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0.25)).current;

  // Handle loading message rotation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (generating) {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [generating]);

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
      // Slide out left, then slide in right
      Animated.timing(slideAnim, {
        toValue: -width,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep(prev => prev + 1);
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
      // Slide out right, then slide in left
      Animated.timing(slideAnim, {
        toValue: width,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep(prev => prev - 1);
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
      setSelectedEquipment(selectedEquipment.filter(item => item !== eq));
    } else {
      setSelectedEquipment([...selectedEquipment, eq]);
    }
  };

  const handleToggleInjury = (injury: string) => {
    if (selectedInjuries.includes(injury)) {
      setSelectedInjuries(selectedInjuries.filter(item => item !== injury));
    } else {
      setSelectedInjuries([...selectedInjuries, injury]);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setLoadingMsgIdx(0);
      
      const rawProgram = await fetchAIProgram({
        location,
        equipment: selectedEquipment,
        daysPerWeek,
        duration,
        splitType,
        injuries: selectedInjuries,
        exclusions,
        fitnessGoal
      });

      const matched = await mapProgramToLibrary(rawProgram);
      setMatchedProgram(matched);
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Misslyckades att generera program', ToastAndroid.LONG);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveProgram = async () => {
    if (!matchedProgram || !user || saving) return;
    try {
      setSaving(true);
      const folderId = await saveProgramToDatabase(matchedProgram, user.id);
      
      if (Platform.OS === 'android') {
        ToastAndroid.show('Program sparat!', ToastAndroid.SHORT);
      }
      
      onSaved();
      onClose();
      
      // Navigate to the folder details
      router.push({
        pathname: '/folder/[id]',
        params: { id: folderId, name: matchedProgram.programName }
      });
    } catch (e: any) {
      console.error(e);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Kunde inte spara program', ToastAndroid.SHORT);
      }
    } finally {
      setSaving(false);
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

  // Render Step Content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Var tränar du och vad har du tillgång till?</Text>
            
            {/* Location selector */}
            <Text style={styles.sectionLabel}>Träningsplats</Text>
            <View style={styles.locationRow}>
              {LOCATIONS.map(loc => (
                <TouchableOpacity
                  key={loc}
                  style={[styles.locationCard, location === loc && styles.activeLocationCard]}
                  onPress={() => setLocation(loc)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.locationCardText, location === loc && styles.activeLocationCardText]}>{loc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Equipment checkboxes */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Utrustning</Text>
              <TouchableOpacity onPress={handleSelectAllEquipment} style={styles.selectAllBtn}>
                <Text style={styles.selectAllBtnText}>
                  {selectedEquipment.length === EQUIPMENT_OPTIONS.length ? 'Avmarkera alla' : 'Välj alla'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.equipmentScroll} showsVerticalScrollIndicator={false}>
              {EQUIPMENT_OPTIONS.map(eq => {
                const isSelected = selectedEquipment.includes(eq);
                return (
                  <TouchableOpacity
                    key={eq}
                    style={[styles.checkboxCard, isSelected && styles.activeCheckboxCard]}
                    onPress={() => handleToggleEquipment(eq)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Check size={12} color="#0A0A0A" strokeWidth={3} />}
                    </View>
                    <Text style={styles.checkboxText}>{eq}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Hur ser ditt schema ut?</Text>

            {/* Frequency selector (1 to 7) */}
            <Text style={styles.sectionLabel}>Pass per vecka</Text>
            <View style={styles.daysSelectorRow}>
              {[1, 2, 3, 4, 5, 6, 7].map(num => (
                <TouchableOpacity
                  key={num}
                  style={[styles.dayCircle, daysPerWeek === num && styles.activeDayCircle]}
                  onPress={() => setDaysPerWeek(num)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayCircleText, daysPerWeek === num && styles.activeDayCircleText]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Target workout duration */}
            <Text style={styles.sectionLabel}>Måltid per träningspass</Text>
            <View style={styles.durationRow}>
              {['30m', '45m', '60m', '90m'].map(time => (
                <TouchableOpacity
                  key={time}
                  style={[styles.durationChip, duration === time && styles.activeDurationChip]}
                  onPress={() => setDuration(time)}
                  activeOpacity={0.8}
                >
                  <Clock size={14} color={duration === time ? '#0A0A0A' : '#94A3B8'} style={{ marginRight: 6 }} />
                  <Text style={[styles.durationText, duration === time && styles.activeDurationText]}>
                    {time === '30m' ? '30 min' : time === '45m' ? '45 min' : time === '60m' ? '60 min' : '90 min'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Split Type Selector */}
            <Text style={styles.sectionLabel}>Träningssplit</Text>
            <ScrollView style={styles.splitScroll} showsVerticalScrollIndicator={false}>
              {SPLIT_OPTIONS.map(split => (
                <TouchableOpacity
                  key={split}
                  style={[styles.splitCard, splitType === split && styles.activeSplitCard]}
                  onPress={() => setSplitType(split)}
                  activeOpacity={0.8}
                >
                  <View style={styles.splitCardHeader}>
                    <Text style={[styles.splitText, splitType === split && styles.activeSplitText]}>
                      {split === 'Auto/AI Recommendation' ? 'Auto / AI-Rekommendation ✨' : split}
                    </Text>
                    {splitType === split && <Check size={16} color="#A3E635" />}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Har du några skador eller övningar du vill undvika?</Text>

            {/* Sensitive body parts multi-select */}
            <Text style={styles.sectionLabel}>Känsliga områden / Leder</Text>
            <View style={styles.injuriesContainer}>
              {INJURY_OPTIONS.map(injury => {
                const isSelected = selectedInjuries.includes(injury);
                return (
                  <TouchableOpacity
                    key={injury}
                    style={[styles.injuryChip, isSelected && styles.activeInjuryChip]}
                    onPress={() => handleToggleInjury(injury)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.injuryText, isSelected && styles.activeInjuryText]}>
                      {injury === 'Wrists' ? 'Handleder' : 
                       injury === 'Knees' ? 'Knän' : 
                       injury === 'Shoulders' ? 'Axlar' : 
                       injury === 'Lower Back' ? 'Ländrygg' : 
                       injury === 'Elbows' ? 'Armbågar' : 
                       injury === 'Ankles' ? 'Anklingar' : injury}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Optional exclusions free-text */}
            <Text style={styles.sectionLabel}>Övriga skador eller övningar att undvika (frivilligt)</Text>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={4}
                placeholder="T.ex: 'Inga bänkpress med skivstång pga axelsmärta, eller undvik knäböj pga meniskskada.'"
                placeholderTextColor="#64748B"
                value={exclusions}
                onChangeText={setExclusions}
                selectionColor="#A3E635"
              />
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Vad är ditt huvudsakliga träningsmål?</Text>

            <View style={styles.goalsContainer}>
              {GOAL_OPTIONS.map(goal => (
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.goalCard, fitnessGoal === goal.id && styles.activeGoalCard]}
                  onPress={() => setFitnessGoal(goal.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.goalInfo}>
                    <Text style={[styles.goalLabel, fitnessGoal === goal.id && styles.activeGoalLabel]}>
                      {goal.label}
                    </Text>
                    <Text style={styles.goalDesc}>{goal.desc}</Text>
                  </View>
                  <View style={[styles.goalIndicator, fitnessGoal === goal.id && styles.activeGoalIndicator]}>
                    {fitnessGoal === goal.id && <View style={styles.goalIndicatorInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  // Render Review Screen
  const renderReviewScreen = () => {
    if (!matchedProgram) return null;

    return (
      <View style={styles.reviewContainer}>
        <View style={styles.reviewHeader}>
          <Sparkles size={24} color="#A3E635" />
          <Text style={styles.reviewTitle}>Ditt AI-Program Är Redo!</Text>
        </View>

        <ScrollView style={styles.reviewScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.programMetaCard}>
            <Text style={styles.programName}>{matchedProgram.programName}</Text>
            <Text style={styles.programDescription}>{matchedProgram.description}</Text>
            <View style={styles.metaBadgeRow}>
              <View style={styles.metaBadge}>
                <Text style={styles.metaBadgeText}>{matchedProgram.daysPerWeek} Pass/vecka</Text>
              </View>
              <View style={styles.metaBadge}>
                <Text style={styles.metaBadgeText}>{duration} Passlängd</Text>
              </View>
            </View>
          </View>

          <Text style={styles.reviewWorkoutsLabel}>Genererade pass:</Text>

          {(matchedProgram.workouts || []).map((workout, wIdx) => (
            <View key={wIdx} style={styles.reviewWorkoutCard}>
              <View style={styles.reviewWorkoutHeader}>
                <Text style={styles.reviewWorkoutName}>{workout.dayName}</Text>
                <Text style={styles.reviewWorkoutFocus} numberOfLines={1}>{workout.targetFocus}</Text>
              </View>

              <View style={styles.reviewExercisesList}>
                {(workout.exercises || []).map((ex, exIdx) => {
                  const isMatched = !!ex.matchedExerciseId;
                  return (
                    <View key={exIdx} style={styles.reviewExerciseItem}>
                      <View style={styles.exerciseHeaderRow}>
                        <Text style={styles.reviewExerciseName} numberOfLines={1}>
                          {ex.exerciseName}
                        </Text>
                        <View style={styles.matchStatusBadge}>
                          {isMatched ? (
                            <View style={styles.matchedLabelRow}>
                              <CheckCircle2 size={12} color="#A3E635" style={{ marginRight: 4 }} />
                              <Text style={styles.matchedLabelText}>Matchad</Text>
                            </View>
                          ) : (
                            <View style={styles.matchedLabelRow}>
                              <AlertCircle size={12} color="#F59E0B" style={{ marginRight: 4 }} />
                              <Text style={[styles.matchedLabelText, { color: '#F59E0B' }]}>Skapad</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <Text style={styles.reviewExerciseSubtext}>
                        {ex.sets} set × {ex.reps} reps | Vila: {ex.restSeconds}s
                      </Text>

                      {ex.notes && (
                        <Text style={styles.reviewExerciseNotes} numberOfLines={2}>
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

        <View style={styles.reviewActions}>
          <TouchableOpacity onPress={resetWizard} style={[styles.wizardButton, styles.backBtn]} disabled={saving}>
            <Text style={styles.backBtnText}>GÖR OM</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSaveProgram} style={[styles.wizardButton, styles.nextBtn]} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#0A0A0A" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>SPARA PROGRAM</Text>
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
    outputRange: ['0%', '100%']
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {generating ? (
          // Dynamic Loading Screen
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A3E635" style={{ marginBottom: 24 }} />
            <Text style={styles.loadingTitle}>Genererar Program...</Text>
            <Text style={styles.loadingSubtitle}>{LOADING_MESSAGES[loadingMsgIdx]}</Text>
          </View>
        ) : matchedProgram ? (
          // Review Program Screen
          renderReviewScreen()
        ) : (
          // Multi-Step Form
          <View style={styles.wizardContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>AI Program Skapare</Text>
                <Text style={styles.headerSubtitle}>Steg {currentStep} av 4</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
            </View>

            {/* Slideable step content */}
            <Animated.View style={[styles.stepContentContainer, { transform: [{ translateX: slideAnim }] }]}>
              {renderStepContent()}
            </Animated.View>

            {/* Footer Navigation */}
            <View style={styles.footer}>
              {currentStep > 1 ? (
                <TouchableOpacity onPress={handleBack} style={[styles.wizardButton, styles.backBtn]}>
                  <ChevronLeft size={18} color="#F8FAFC" style={{ marginRight: 6 }} />
                  <Text style={styles.backBtnText}>TILLBAKA</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flex: 1 }} />
              )}

              {currentStep < 4 ? (
                <TouchableOpacity onPress={handleNext} style={[styles.wizardButton, styles.nextBtn]}>
                  <Text style={styles.nextBtnText}>NÄSTA</Text>
                  <ChevronRight size={18} color="#0A0A0A" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleGenerate} style={[styles.wizardButton, styles.generateBtn]}>
                  <Text style={styles.generateBtnText}>SKAPA PROGRAM</Text>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 5, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wizardContainer: {
    backgroundColor: '#0A0A0A',
    width: '100%',
    height: '100%',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#1E293B',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#A3E635',
  },
  stepContentContainer: {
    flex: 1,
    width: '100%',
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  stepTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 24,
    lineHeight: 26,
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  selectAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  selectAllBtnText: {
    color: '#A3E635',
    fontSize: 12,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  locationCard: {
    flex: 1,
    backgroundColor: '#18181B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  activeLocationCard: {
    borderColor: '#A3E635',
    backgroundColor: 'rgba(163, 230, 53, 0.05)',
  },
  locationCardText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '700',
  },
  activeLocationCardText: {
    color: '#A3E635',
  },
  equipmentScroll: {
    flex: 1,
  },
  checkboxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  activeCheckboxCard: {
    borderColor: '#3F3F46',
    backgroundColor: '#27272A',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#475569',
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#A3E635',
    borderColor: '#A3E635',
  },
  checkboxText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '600',
  },
  daysSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  dayCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#18181B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  activeDayCircle: {
    borderColor: '#A3E635',
    backgroundColor: '#A3E635',
  },
  dayCircleText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '800',
  },
  activeDayCircleText: {
    color: '#0A0A0A',
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  activeDurationChip: {
    borderColor: '#A3E635',
    backgroundColor: '#A3E635',
  },
  durationText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  activeDurationText: {
    color: '#0A0A0A',
  },
  splitScroll: {
    flex: 1,
  },
  splitCard: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  activeSplitCard: {
    borderColor: '#A3E635',
    backgroundColor: 'rgba(163, 230, 53, 0.03)',
  },
  splitCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
  activeSplitText: {
    color: '#A3E635',
  },
  injuriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  injuryChip: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  activeInjuryChip: {
    borderColor: '#F59E0B', // Amber color for warning/injury focus
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  injuryText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  activeInjuryText: {
    color: '#F59E0B',
  },
  textAreaContainer: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#27272A',
    padding: 12,
  },
  textArea: {
    color: '#F8FAFC',
    fontSize: 15,
    textAlignVertical: 'top',
    height: 100,
    fontWeight: '500',
  },
  goalsContainer: {
    gap: 12,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181B',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  activeGoalCard: {
    borderColor: '#A3E635',
    backgroundColor: 'rgba(163, 230, 53, 0.03)',
  },
  goalInfo: {
    flex: 1,
    marginRight: 16,
  },
  goalLabel: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  activeGoalLabel: {
    color: '#A3E635',
  },
  goalDesc: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  goalIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeGoalIndicator: {
    borderColor: '#A3E635',
  },
  goalIndicatorInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#A3E635',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0A0A0A',
  },
  wizardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  backBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  backBtnText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  nextBtn: {
    backgroundColor: '#A3E635',
  },
  nextBtnText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '800',
  },
  generateBtn: {
    backgroundColor: '#A3E635',
    shadowColor: '#A3E635',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  generateBtnText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  loadingSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  reviewContainer: {
    backgroundColor: '#0A0A0A',
    width: '100%',
    height: '100%',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    justifyContent: 'space-between',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#1E293B',
  },
  reviewTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 12,
  },
  reviewScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  programMetaCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 20,
  },
  programName: {
    color: '#A3E635',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  programDescription: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 16,
  },
  metaBadgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaBadge: {
    backgroundColor: '#27272A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  metaBadgeText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  reviewWorkoutsLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  reviewWorkoutCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  reviewWorkoutHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
    paddingBottom: 10,
    marginBottom: 12,
  },
  reviewWorkoutName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  reviewWorkoutFocus: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  reviewExercisesList: {
    gap: 12,
  },
  reviewExerciseItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewExerciseName: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  matchStatusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  matchedLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchedLabelText: {
    color: '#A3E635',
    fontSize: 10,
    fontWeight: '800',
  },
  reviewExerciseSubtext: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  reviewExerciseNotes: {
    color: '#64748B',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
    fontWeight: '500',
  },
  reviewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0A0A0A',
    gap: 12,
  },
});
