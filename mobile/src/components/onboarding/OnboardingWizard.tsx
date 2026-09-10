import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Zap,
  TrendingUp,
  Clock,
  Lightbulb,
  Sparkles,
  ShieldCheck,
  Dumbbell,
} from 'lucide-react-native';
import { onboardingService, OnboardingProfile } from '../../services/onboardingService';
import {
  fetchAIProgram,
  mapProgramToLibrary,
  saveProgramToDatabase,
  MatchedProgram,
} from '../../services/ai';
import { useAuth } from '../../context/AuthContext';
import {
  StepGoals,
  StepLevel,
  StepInjuries,
  StepEquipment,
  WizardLoading,
  EXPERIENCE_LEVELS,
  GOAL_OPTIONS,
  EQUIPMENT_OPTIONS,
  INJURY_LABELS,
} from '../ai-wizard';

const { width } = Dimensions.get('window');

const TOTAL_STEPS = 6;

interface OnboardingWizardProps {
  visible: boolean;
  onClose: () => void;
  onCompleted?: (folderId?: string | null, folderName?: string) => void;
}

const FREQUENCY_OPTIONS = [2, 3, 4, 5, 6];

const DURATION_OPTIONS = [
  { id: '30m', label: '30 min', sub: '~4 övn' },
  { id: '45m', label: '45 min', sub: '~5 övn' },
  { id: '60m', label: '60 min', sub: '~6 övn' },
  { id: '90m', label: '90 min', sub: '~8 övn' },
];

export default function OnboardingWizard({ visible, onClose, onCompleted }: OnboardingWizardProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  // User Selections State
  const [fitnessGoal, setFitnessGoal] = useState('Muscle Growth (Hypertrophy)');
  const [experienceLevel, setExperienceLevel] = useState('intermediate');
  const [selectedInjuries, setSelectedInjuries] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState('');
  const [location, setLocation] = useState('Gym');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [duration, setDuration] = useState('60m');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([...EQUIPMENT_OPTIONS]);

  // Program Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStepText, setGenerationStepText] = useState('Förbereder din personliga plan...');
  const [generatedProgram, setGeneratedProgram] = useState<MatchedProgram | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [savedFolderId, setSavedFolderId] = useState<string | null>(null);
  const [savedFolderName, setSavedFolderName] = useState<string>('');

  // Load existing profile if any
  useEffect(() => {
    if (user?.id && visible) {
      onboardingService.getOnboardingProfile(user.id).then((profile) => {
        if (profile) {
          if (profile.fitnessGoal) setFitnessGoal(profile.fitnessGoal);
          if (profile.experienceLevel) setExperienceLevel(profile.experienceLevel);
          if (profile.injuries) setSelectedInjuries(profile.injuries);
          if (profile.exclusions) setExclusions(profile.exclusions);
          if (profile.location) setLocation(profile.location);
          if (profile.daysPerWeek) setDaysPerWeek(profile.daysPerWeek);
          if (profile.duration) setDuration(profile.duration);
          if (profile.equipment && profile.equipment.length > 0) {
            setSelectedEquipment(profile.equipment);
          }
        }
      });
    }
  }, [user?.id, visible]);

  // Equipment handlers
  const handleToggleEquipment = (eq: string) => {
    if (selectedEquipment.includes(eq)) {
      if (selectedEquipment.length === 1) {
        Alert.alert('Minst en utrustning', 'Du behöver välja minst ett utrustningsalternativ.');
        return;
      }
      setSelectedEquipment(selectedEquipment.filter((item) => item !== eq));
    } else {
      setSelectedEquipment([...selectedEquipment, eq]);
    }
  };

  const handleSelectAllEquipment = () => {
    if (selectedEquipment.length === EQUIPMENT_OPTIONS.length) {
      setSelectedEquipment([]);
    } else {
      setSelectedEquipment([...EQUIPMENT_OPTIONS]);
    }
  };

  // Injury handlers
  const handleToggleInjury = (injury: string) => {
    if (selectedInjuries.includes(injury)) {
      setSelectedInjuries(selectedInjuries.filter((item) => item !== injury));
    } else {
      setSelectedInjuries([...selectedInjuries, injury]);
    }
  };

  // Generate program on reaching step 6
  const generateInitialProgram = async () => {
    if (generatedProgram || isGenerating) return;

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationStepText('Analyserar dina mål och din nivå...');

    try {
      setTimeout(() => setGenerationStepText('Skapar skräddarsydda träningspass...'), 800);

      const generated = await fetchAIProgram({
        location,
        equipment: selectedEquipment,
        daysPerWeek,
        duration,
        splitType: 'Auto/AI Recommendation',
        injuries: selectedInjuries,
        exclusions,
        fitnessGoal,
        experienceLevel,
      });

      setGenerationStepText('Matchar övningar mot biblioteket...');
      const matched = await mapProgramToLibrary(generated, {
        allowedEquipment: selectedEquipment,
        experienceLevel,
      });

      if (user?.id) {
        setGenerationStepText('Sparar ditt nya program...');
        const folderId = await saveProgramToDatabase(matched, user.id);
        setSavedFolderId(folderId);
        setSavedFolderName(matched.programName);
      }

      setGeneratedProgram(matched);
    } catch (err: any) {
      console.error('Error generating onboarding program:', err);
      setGenerationError('Kunde inte generera programmet automatiskt just nu, men dina inställningar har sparats.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Skip individual step
  const handleSkipStep = () => {
    if (currentStep === 2) {
      // Skip Goals -> keep default
      if (!fitnessGoal) setFitnessGoal('Muscle Growth (Hypertrophy)');
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Skip Level -> keep default
      if (!experienceLevel) setExperienceLevel('intermediate');
      setCurrentStep(4);
    } else if (currentStep === 4) {
      // Skip Injuries -> clear
      setSelectedInjuries([]);
      setExclusions('');
      setCurrentStep(5);
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      const next = currentStep + 1;
      setCurrentStep(next);
      if (next === TOTAL_STEPS) {
        generateInitialProgram();
      }
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (user?.id) {
      const profile: OnboardingProfile = {
        fitnessGoal,
        experienceLevel,
        injuries: selectedInjuries,
        exclusions,
        location,
        daysPerWeek,
        duration,
        equipment: selectedEquipment,
      };
      await onboardingService.saveOnboardingProfile(user.id, profile);
      await onboardingService.setHasCompletedOnboarding(user.id, true);
    }
    onClose();
    if (onCompleted) {
      onCompleted(savedFolderId, savedFolderName || generatedProgram?.programName);
    }
  };

  // Skip entire onboarding
  const handleSkipAll = async () => {
    if (user?.id) {
      // Save sensible defaults
      const profile: OnboardingProfile = {
        fitnessGoal,
        experienceLevel,
        injuries: [],
        exclusions: '',
        location,
        daysPerWeek,
        duration,
        equipment: selectedEquipment,
      };
      await onboardingService.saveOnboardingProfile(user.id, profile);
      await onboardingService.setHasCompletedOnboarding(user.id, true);
    }
    onClose();
    if (onCompleted) {
      onCompleted();
    }
  };

  const progressPercent = (currentStep / TOTAL_STEPS) * 100;
  const currentGoalObj = GOAL_OPTIONS.find((g) => g.id === fitnessGoal);
  const currentLevelObj = EXPERIENCE_LEVELS.find((l) => l.id === experienceLevel);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      presentationStyle="fullScreen"
      statusBarTranslucent={true}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.container}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View style={styles.stepInfoContainer}>
              <Text style={styles.stepIndicatorText}>
                ONBOARDING • STEG {currentStep} AV {TOTAL_STEPS}
              </Text>
            </View>
            {currentStep < TOTAL_STEPS && (
              <TouchableOpacity onPress={handleSkipAll} style={styles.skipAllButton} activeOpacity={0.7}>
                <Text style={styles.skipAllButtonText}>Hoppa över allt</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          {/* Main Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* STEP 1: VÄLKOMMEN (Startsida) */}
            {currentStep === 1 && (
              <View style={styles.stepContainer}>
                {/* Brand Hero Circle */}
                <View style={styles.heroWrapper}>
                  <View style={styles.heroGlowCircle}>
                    <View style={styles.heroInnerCard}>
                      <Image
                        source={require('../../../assets/images/logo.png')}
                        style={styles.heroLogoImage}
                        resizeMode="cover"
                      />
                    </View>
                  </View>
                </View>

                <Text style={styles.mainTitle}>Välkommen till Workout Player</Text>
                <Text style={styles.mainSubtitle}>
                  Låt oss sätta upp din profil och skapa ett träningsschema som är skräddarsytt för dina mål, din nivå och din vardag.
                </Text>

                {/* Value Props */}
                <View style={styles.valuePropsContainer}>
                  <View style={styles.valuePropCard}>
                    <View style={styles.valuePropIconBox}>
                      <Zap size={20} color="#CCFF00" />
                    </View>
                    <View style={styles.valuePropTextBox}>
                      <Text style={styles.valuePropTitle}>Skräddarsydda pass</Text>
                      <Text style={styles.valuePropSubtitle}>Övningar anpassade efter din nivå och utrustning</Text>
                    </View>
                  </View>

                  <View style={styles.valuePropCard}>
                    <View style={styles.valuePropIconBox}>
                      <ShieldCheck size={20} color="#CCFF00" />
                    </View>
                    <View style={styles.valuePropTextBox}>
                      <Text style={styles.valuePropTitle}>Skadeanpassning</Text>
                      <Text style={styles.valuePropSubtitle}>Undvik övningar som belastar känsliga leder</Text>
                    </View>
                  </View>

                  <View style={styles.valuePropCard}>
                    <View style={styles.valuePropIconBox}>
                      <TrendingUp size={20} color="#CCFF00" />
                    </View>
                    <View style={styles.valuePropTextBox}>
                      <Text style={styles.valuePropTitle}>Smart progression</Text>
                      <Text style={styles.valuePropSubtitle}>Spåra vikter, personbästa och volym smidigt</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* STEP 2: HUVUDSAKLIGA MÅL (Återanvänder StepGoals) */}
            {currentStep === 2 && (
              <View style={styles.stepContainer}>
                <StepGoals fitnessGoal={fitnessGoal} onSelectGoal={setFitnessGoal} />
              </View>
            )}

            {/* STEP 3: TRÄNINGSNIVÅ (Återanvänder StepLevel i 3 steg) */}
            {currentStep === 3 && (
              <View style={styles.stepContainer}>
                <StepLevel experienceLevel={experienceLevel} onSelectLevel={setExperienceLevel} />
              </View>
            )}

            {/* STEP 4: SKADOR & BEGRÄNSNINGAR (Återanvänder StepInjuries) */}
            {currentStep === 4 && (
              <View style={styles.stepContainer}>
                <StepInjuries
                  selectedInjuries={selectedInjuries}
                  onToggleInjury={handleToggleInjury}
                  exclusions={exclusions}
                  onChangeExclusions={setExclusions}
                />
              </View>
            )}

            {/* STEP 5: UTRUSTNING & TRÄNINGSPLAN */}
            {currentStep === 5 && (
              <View style={styles.stepContainer}>
                <StepEquipment
                  location={location}
                  onSelectLocation={setLocation}
                  selectedEquipment={selectedEquipment}
                  onToggleEquipment={handleToggleEquipment}
                  onSelectAllEquipment={handleSelectAllEquipment}
                />

                {/* Frekvens */}
                <View style={styles.frequencySection}>
                  <View style={styles.frequencyHeaderRow}>
                    <Text style={styles.sectionHeader}>PASS PER VECKA</Text>
                    {daysPerWeek === 3 && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedBadgeText}>REKOMMENDERAT</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.frequencyPillRow}>
                    {FREQUENCY_OPTIONS.map((days) => {
                      const isSelected = daysPerWeek === days;
                      return (
                        <TouchableOpacity
                          key={days}
                          style={[styles.frequencyPill, isSelected && styles.frequencyPillSelected]}
                          onPress={() => setDaysPerWeek(days)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.frequencyPillText, isSelected && styles.frequencyPillTextSelected]}>
                            {days}
                          </Text>
                          <Text style={[styles.frequencyPillSub, isSelected && styles.frequencyPillSubSelected]}>
                            dagar
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Passlängd */}
                <View style={styles.frequencySection}>
                  <View style={styles.frequencyHeaderRow}>
                    <Text style={styles.sectionHeader}>ÖNSKAD PASSLÄNGD</Text>
                    {duration === '60m' && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedBadgeText}>REKOMMENDERAT</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.frequencyPillRow}>
                    {DURATION_OPTIONS.map((opt) => {
                      const isSelected = duration === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[styles.frequencyPill, isSelected && styles.frequencyPillSelected]}
                          onPress={() => setDuration(opt.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.durationPillText, isSelected && styles.durationPillTextSelected]}>
                            {opt.label}
                          </Text>
                          <Text style={[styles.frequencyPillSub, isSelected && styles.frequencyPillSubSelected]}>
                            {opt.sub}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

            {/* STEP 6: ALLT KLART / RESULTAT */}
            {currentStep === 6 && (
              <View style={styles.stepContainer}>
                {isGenerating ? (
                  <View style={styles.loadingWrapper}>
                    <WizardLoading />
                    <Text style={styles.loadingStatusText}>{generationStepText}</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.heroWrapper}>
                      <View style={styles.heroGlowCircle}>
                        <View style={styles.heroCheckCircle}>
                          <Check size={40} color="#121A00" strokeWidth={3.5} />
                        </View>
                      </View>
                    </View>

                    <Text style={styles.mainTitle}>Din profil är redo!</Text>
                    <Text style={styles.mainSubtitle}>
                      Vi har sparat dina inställningar och anpassat ditt startschema efter din nivå, dina mål och din utrustning.
                    </Text>

                    {/* Summary Card */}
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryCardHeader}>DIN SPARADE TRÄNINGSPROFIL</Text>

                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryRowLabel}>🎯 Huvudmål</Text>
                        <Text style={styles.summaryRowValue}>
                          {currentGoalObj?.label || fitnessGoal}
                        </Text>
                      </View>

                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryRowLabel}>⚡ Nivå</Text>
                        <Text style={styles.summaryRowValue}>
                          {currentLevelObj?.label || experienceLevel}
                        </Text>
                      </View>

                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryRowLabel}>🛡️ Skadeanpassning</Text>
                        <Text style={styles.summaryRowValue}>
                          {selectedInjuries.length > 0
                            ? selectedInjuries.map((i) => INJURY_LABELS[i] || i).join(', ')
                            : 'Inga begränsningar'}
                        </Text>
                      </View>

                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryRowLabel}>📍 Plats & Utrustning</Text>
                        <Text style={styles.summaryRowValue}>
                          {location} • {selectedEquipment.length === EQUIPMENT_OPTIONS.length ? 'Fullt utrustat' : `${selectedEquipment.length} redskap`}
                        </Text>
                      </View>

                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryRowLabel}>📅 Schema</Text>
                        <Text style={styles.summaryRowValue}>
                          {daysPerWeek} pass/vecka • {duration}
                        </Text>
                      </View>
                    </View>

                    {/* Tip Box */}
                    <View style={styles.tipBox}>
                      <Lightbulb size={20} color="#CCFF00" style={{ marginRight: 10 }} />
                      <Text style={styles.tipBoxText}>
                        Du kan när som helst uppdatera din profil och dina skador under fliken "Du".
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer Navigation */}
          <View style={styles.footer}>
            <View style={styles.footerInner}>
              {currentStep > 1 && currentStep < TOTAL_STEPS && (
                <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
                  <ChevronLeft size={20} color="#94A3B8" />
                  <Text style={styles.backButtonText}>Tillbaka</Text>
                </TouchableOpacity>
              )}

              {/* Step-specific skip button on steps 2, 3, 4 */}
              {(currentStep === 2 || currentStep === 3 || currentStep === 4) && (
                <TouchableOpacity style={styles.skipStepButton} onPress={handleSkipStep} activeOpacity={0.7}>
                  <Text style={styles.skipStepButtonText}>Hoppa över</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  currentStep === 1 || currentStep === TOTAL_STEPS ? styles.primaryButtonFull : null,
                  isGenerating && styles.primaryButtonDisabled,
                ]}
                onPress={handleNext}
                disabled={isGenerating}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>
                  {currentStep === 1
                    ? 'Kom igång'
                    : currentStep === 5
                    ? 'Skapa schema'
                    : currentStep === TOTAL_STEPS
                    ? 'Börja träna'
                    : 'Nästa'}
                </Text>
                {currentStep < TOTAL_STEPS && currentStep !== 5 && (
                  <ChevronRight size={20} color="#121A00" strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 14,
    paddingBottom: 12,
  },
  stepInfoContainer: {
    flexDirection: 'column',
  },
  stepIndicatorText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  skipAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  skipAllButtonText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarTrack: {
    width: '100%',
    height: 3,
    backgroundColor: '#1E293B',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#A3E635',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  stepContainer: {
    flex: 1,
  },
  heroWrapper: {
    alignItems: 'center',
    marginVertical: 20,
  },
  heroGlowCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInnerCard: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#18181B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#A3E635',
    overflow: 'hidden',
  },
  heroLogoImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  heroCheckCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#A3E635',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  mainSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  valuePropsContainer: {
    gap: 12,
    marginTop: 8,
  },
  valuePropCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  valuePropIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  valuePropTextBox: {
    flex: 1,
  },
  valuePropTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  valuePropSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  frequencySection: {
    marginTop: 20,
  },
  frequencyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  recommendedBadge: {
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recommendedBadgeText: {
    color: '#A3E635',
    fontSize: 10,
    fontWeight: '700',
  },
  frequencyPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyPill: {
    flex: 1,
    backgroundColor: '#18181B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  frequencyPillSelected: {
    borderColor: '#A3E635',
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
  },
  frequencyPillText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  frequencyPillTextSelected: {
    color: '#A3E635',
  },
  frequencyPillSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  frequencyPillSubSelected: {
    color: '#A3E635',
  },
  durationPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  durationPillTextSelected: {
    color: '#A3E635',
  },
  loadingWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingStatusText: {
    marginTop: 16,
    fontSize: 14,
    color: '#A3E635',
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#18181B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 16,
    gap: 12,
  },
  summaryCardHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryRowLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  summaryRowValue: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '700',
    maxWidth: '55%',
    textAlign: 'right',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(163, 230, 53, 0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.25)',
  },
  tipBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#18181B',
    backgroundColor: '#0A0A0A',
  },
  footerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  backButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  skipStepButton: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  skipStepButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A3E635',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 6,
  },
  primaryButtonFull: {
    flex: 1,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '800',
  },
});
