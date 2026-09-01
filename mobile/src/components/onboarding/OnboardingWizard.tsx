import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
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
  Dumbbell,
  Home,
  Trees,
  CheckCircle2,
  Sparkles,
  Flame,
  Zap,
  TrendingUp,
  Clock,
  Lightbulb,
  ShieldAlert,
  Layers,
  Award
} from 'lucide-react-native';
import TrackLogo from '../TrackLogo';
import { onboardingService, OnboardingProfile } from '../../services/onboardingService';
import { fetchAIProgram, mapProgramToLibrary, saveProgramToDatabase, MatchedProgram } from '../../services/ai';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

interface OnboardingWizardProps {
  visible: boolean;
  onClose: () => void;
  onCompleted?: (folderId?: string | null, folderName?: string) => void;
}

const GOALS = [
  {
    id: 'Muscle Growth (Hypertrophy)',
    title: 'Bygg muskler',
    subtitle: 'Hypertrofi & muskelmassa',
    icon: Dumbbell,
  },
  {
    id: 'Pure Strength',
    title: 'Bli starkare',
    subtitle: 'Maxstyrka & tunga lyft',
    icon: Zap,
  },
  {
    id: 'Fat Loss',
    title: 'Gå ner i vikt',
    subtitle: 'Fettförbränning & form',
    icon: Flame,
  },
  {
    id: 'Endurance',
    title: 'Uthållighet & Hälsa',
    subtitle: 'Kondition, energi & rörlighet',
    icon: TrendingUp,
  },
];

const LOCATIONS = [
  {
    id: 'Gym',
    title: 'Gym',
    subtitle: 'Komplett träningsanläggning',
    icon: Dumbbell,
  },
  {
    id: 'Hem',
    title: 'Hemma',
    subtitle: 'Träning i hemmet',
    icon: Home,
  },
  {
    id: 'Utomhus',
    title: 'Utomhus / Resande',
    subtitle: 'Kroppsvikt & mobila redskap',
    icon: Trees,
  },
];

const FREQUENCY_OPTIONS = [2, 3, 4, 5, 6];

const DURATION_OPTIONS = [
  { id: '30m', label: '30 min', sub: '~4 övn' },
  { id: '45m', label: '45 min', sub: '~5 övn' },
  { id: '60m', label: '60 min', sub: '~6 övn' },
  { id: '90m', label: '90 min', sub: '~8 övn' },
];

const ALL_EQUIPMENT = [
  { id: 'Barbell', label: 'Skivstång & Vikter', desc: 'Baslyft och tunga vikter' },
  { id: 'Dumbbell', label: 'Hantlar', desc: 'Isolerande och fria vikter' },
  { id: 'Machine', label: 'Maskiner', desc: 'Träningsmaskiner och benpress' },
  { id: 'Cable', label: 'Kabelmaskin', desc: 'Jämnt motstånd och drag' },
  { id: 'Kettlebell', label: 'Kettlebells', desc: 'Funktionell träning och svingar' },
  { id: 'Resistance Bands', label: 'Gummiband', desc: 'Portabelt och skonsamt motstånd' },
  { id: 'Bodyweight', label: 'Kroppsvikt / Räcke', desc: 'Chins, dips och armhävningar' },
];

export default function OnboardingWizard({ visible, onClose, onCompleted }: OnboardingWizardProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  // User Selections State
  const [fitnessGoal, setFitnessGoal] = useState('Muscle Growth (Hypertrophy)');
  const [location, setLocation] = useState('Gym');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [duration, setDuration] = useState('60m');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([
    'Barbell',
    'Dumbbell',
    'Machine',
    'Cable',
    'Kettlebell',
    'Resistance Bands',
    'Bodyweight',
  ]);

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

  // Handle Preset selection
  const handleSelectPreset = (preset: 'gym' | 'home' | 'bodyweight') => {
    if (preset === 'gym') {
      setSelectedEquipment(ALL_EQUIPMENT.map((e) => e.id));
    } else if (preset === 'home') {
      setSelectedEquipment(['Dumbbell', 'Kettlebell', 'Resistance Bands', 'Bodyweight']);
    } else if (preset === 'bodyweight') {
      setSelectedEquipment(['Bodyweight']);
    }
  };

  const toggleEquipment = (id: string) => {
    if (selectedEquipment.includes(id)) {
      if (selectedEquipment.length === 1) {
        Alert.alert('Minst en utrustning', 'Du behöver välja minst ett utrustningsalternativ.');
        return;
      }
      setSelectedEquipment(selectedEquipment.filter((item) => item !== id));
    } else {
      setSelectedEquipment([...selectedEquipment, id]);
    }
  };

  // Generate program on reaching step 5
  const generateInitialProgram = async () => {
    if (generatedProgram || isGenerating) return;

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationStepText('Analyserar dina val och mål...');

    try {
      // Step A: Call AI service or mock generator
      setTimeout(() => setGenerationStepText('Designar skräddarsydda träningspass...'), 700);

      const generated = await fetchAIProgram({
        location,
        equipment: selectedEquipment,
        daysPerWeek,
        duration,
        splitType: 'Auto/AI Recommendation',
        injuries: [],
        exclusions: '',
        fitnessGoal,
      });

      setGenerationStepText('Matchar övningar mot databasen...');
      const matched = await mapProgramToLibrary(generated);

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

  const handleNext = () => {
    if (currentStep < 5) {
      const next = currentStep + 1;
      setCurrentStep(next);
      if (next === 5) {
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

  const handleSkip = async () => {
    if (user?.id) {
      await onboardingService.setHasCompletedOnboarding(user.id, true);
    }
    onClose();
    if (onCompleted) {
      onCompleted();
    }
  };

  const progressPercent = (currentStep / 5) * 100;

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
            <Text style={styles.stepIndicatorText}>ONBOARDING • STEG {currentStep} AV 5</Text>
          </View>
          {currentStep < 5 && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton} activeOpacity={0.7}>
              <Text style={styles.skipButtonText}>Hoppa över</Text>
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
          {/* STEP 1: VÄLKOMMEN */}
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
                Låt oss skapa ett träningsschema som är skräddarsytt för dina mål, din vardag och din utrustning.
              </Text>

              {/* Value Props */}
              <View style={styles.valuePropsContainer}>
                <View style={styles.valuePropCard}>
                  <View style={styles.valuePropIconBox}>
                    <Zap size={20} color="#CCFF00" />
                  </View>
                  <View style={styles.valuePropTextBox}>
                    <Text style={styles.valuePropTitle}>Skräddarsydda pass</Text>
                    <Text style={styles.valuePropSubtitle}>Övningar anpassade efter din utrustning</Text>
                  </View>
                </View>

                <View style={styles.valuePropCard}>
                  <View style={styles.valuePropIconBox}>
                    <TrendingUp size={20} color="#CCFF00" />
                  </View>
                  <View style={styles.valuePropTextBox}>
                    <Text style={styles.valuePropTitle}>Smart progression</Text>
                    <Text style={styles.valuePropSubtitle}>Spåra vikter, PB och total volym automatiskt</Text>
                  </View>
                </View>

                <View style={styles.valuePropCard}>
                  <View style={styles.valuePropIconBox}>
                    <Clock size={20} color="#CCFF00" />
                  </View>
                  <View style={styles.valuePropTextBox}>
                    <Text style={styles.valuePropTitle}>Snabb och smidig loggning</Text>
                    <Text style={styles.valuePropSubtitle}>Byggt för att vara snabbt och enkelt på gymmet</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* STEP 2: VAD ÄR DITT MÅL? */}
          {currentStep === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.mainTitle}>Vad är ditt huvudsakliga mål?</Text>
              <Text style={styles.mainSubtitle}>
                Välj det som passar bäst för att skräddarsy ditt schema och dina repetitionsintervall.
              </Text>

              <View style={styles.optionsList}>
                {GOALS.map((goal) => {
                  const isSelected = fitnessGoal === goal.id;
                  const Icon = goal.icon;
                  return (
                    <TouchableOpacity
                      key={goal.id}
                      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                      onPress={() => setFitnessGoal(goal.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.optionIconContainer, isSelected && styles.optionIconContainerSelected]}>
                        <Icon size={24} color={isSelected ? '#121A00' : '#CCFF00'} />
                      </View>
                      <View style={styles.optionTextContainer}>
                        <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                          {goal.title}
                        </Text>
                        <Text style={styles.optionSubtitle}>{goal.subtitle}</Text>
                      </View>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected && <Check size={14} color="#121A00" strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* STEP 3: VAR & HUR OFTA? */}
          {currentStep === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.mainTitle}>Var & hur ofta vill du träna?</Text>
              <Text style={styles.mainSubtitle}>
                Vi anpassar övningsval och volym efter din plats och dina träningsdagar.
              </Text>

              {/* Plats */}
              <Text style={styles.sectionHeader}>TRÄNINGSPLATS</Text>
              <View style={styles.optionsList}>
                {LOCATIONS.map((loc) => {
                  const isSelected = location === loc.id;
                  const Icon = loc.icon;
                  return (
                    <TouchableOpacity
                      key={loc.id}
                      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                      onPress={() => setLocation(loc.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.optionIconContainer, isSelected && styles.optionIconContainerSelected]}>
                        <Icon size={24} color={isSelected ? '#121A00' : '#CCFF00'} />
                      </View>
                      <View style={styles.optionTextContainer}>
                        <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                          {loc.title}
                        </Text>
                        <Text style={styles.optionSubtitle}>{loc.subtitle}</Text>
                      </View>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected && <Check size={14} color="#121A00" strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Frekvens */}
              <View style={styles.frequencySection}>
                <View style={styles.frequencyHeaderRow}>
                  <Text style={styles.sectionHeader}>ANTAL DAGAR PER VECKA</Text>
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
                <Text style={styles.frequencyHint}>
                  {daysPerWeek <= 3
                    ? 'Perfekt för helkroppspass med optimal återhämtning.'
                    : 'Passar utmärkt för överkropp/underkropp eller split-program.'}
                </Text>
              </View>

              {/* Passlängd */}
              <View style={styles.frequencySection}>
                <View style={styles.frequencyHeaderRow}>
                  <Text style={styles.sectionHeader}>ÖNSKAD PASSLÄNGD / TID PER PASS</Text>
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
                <Text style={styles.frequencyHint}>
                  {duration === '30m'
                    ? 'Korta och intensiva pass med ca 4 fokuserade övningar.'
                    : duration === '45m'
                    ? 'Effektiva pass med ca 5 övningar och bra volym.'
                    : duration === '60m'
                    ? 'Balanserade pass med ca 6 övningar och fullständig stimulans.'
                    : 'Omfattande pass med ca 8 övningar för maximal volym.'}
                </Text>
              </View>
            </View>
          )}

          {/* STEP 4: VILKEN UTRUSTNING HAR DU? */}
          {currentStep === 4 && (
            <View style={styles.stepContainer}>
              <Text style={styles.mainTitle}>Vilken utrustning har du?</Text>
              <Text style={styles.mainSubtitle}>
                Välj det du har tillgång till. Vi filtrerar övningar och pass automatiskt efter dina val.
              </Text>

              {/* Quick Preset Chips */}
              <Text style={styles.sectionHeader}>SNABBVAL</Text>
              <View style={styles.presetChipsRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handleSelectPreset('gym')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipText}>🏋️ Fullt Gym</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handleSelectPreset('home')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipText}>🏠 Hemmagym</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handleSelectPreset('bodyweight')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipText}>🤸 Endast Kroppsvikt</Text>
                </TouchableOpacity>
              </View>

              {/* Equipment Multi-select list */}
              <Text style={[styles.sectionHeader, { marginTop: 20 }]}>TILLGÄNGLIG UTRUSTNING</Text>
              <View style={styles.optionsList}>
                {ALL_EQUIPMENT.map((eq) => {
                  const isChecked = selectedEquipment.includes(eq.id);
                  return (
                    <TouchableOpacity
                      key={eq.id}
                      style={[styles.optionCard, isChecked && styles.optionCardSelected]}
                      onPress={() => toggleEquipment(eq.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkboxSquare, isChecked && styles.checkboxSquareChecked]}>
                        {isChecked && <Check size={14} color="#121A00" strokeWidth={3} />}
                      </View>
                      <View style={styles.optionTextContainer}>
                        <Text style={[styles.optionTitle, isChecked && styles.optionTitleSelected]}>
                          {eq.label}
                        </Text>
                        <Text style={styles.optionSubtitle}>{eq.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* STEP 5: ALLT KLART! */}
          {currentStep === 5 && (
            <View style={styles.stepContainer}>
              {isGenerating ? (
                <View style={styles.loadingContainer}>
                  <View style={styles.loadingGlowCircle}>
                    <ActivityIndicator size="large" color="#CCFF00" />
                  </View>
                  <Text style={styles.loadingTitle}>Skapar ditt schema...</Text>
                  <Text style={styles.loadingSubtitle}>{generationStepText}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.heroWrapper}>
                    <View style={styles.heroGlowCircle}>
                      <View style={styles.heroCheckCircle}>
                        <Check size={44} color="#121A00" strokeWidth={3.5} />
                      </View>
                    </View>
                  </View>

                  <Text style={styles.mainTitle}>Allt klart! Din plan är redo</Text>
                  <Text style={styles.mainSubtitle}>
                    Vi har anpassat övningar, volym och vilodagar efter dina mål och din utrustning.
                  </Text>

                  {/* Summary Card */}
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryCardHeader}>DITT PERSONLIGA UPPFÖLJNINGSSCHEMA</Text>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryRowLabel}>🎯 Mål</Text>
                      <Text style={styles.summaryRowValue}>
                        {GOALS.find((g) => g.id === fitnessGoal)?.title || fitnessGoal}
                      </Text>
                    </View>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryRowLabel}>📍 Plats</Text>
                      <Text style={styles.summaryRowValue}>
                        {LOCATIONS.find((l) => l.id === location)?.title || location}
                      </Text>
                    </View>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryRowLabel}>📅 Frekvens</Text>
                      <Text style={styles.summaryRowValue}>{daysPerWeek} pass per vecka</Text>
                    </View>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryRowLabel}>⏱️ Passlängd</Text>
                      <Text style={styles.summaryRowValue}>
                        {DURATION_OPTIONS.find((d) => d.id === duration)?.label || duration} ({duration === '30m' ? '4' : duration === '45m' ? '5' : duration === '60m' ? '6' : '8'} övn/pass)
                      </Text>
                    </View>

                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryRowLabel}>🏋️ Utrustning</Text>
                      <Text style={styles.summaryRowValue} numberOfLines={1}>
                        {selectedEquipment.length === ALL_EQUIPMENT.length
                          ? 'Fullt gym'
                          : `${selectedEquipment.length} typer valda`}
                      </Text>
                    </View>
                  </View>

                  {/* Tip Box */}
                  <View style={styles.tipBox}>
                    <Lightbulb size={20} color="#CCFF00" style={{ marginRight: 10 }} />
                    <Text style={styles.tipBoxText}>
                      Du kan när som helst ändra övningar eller lägga till egna pass under fliken AI Plan och Mina Pass.
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer Buttons */}
        <View style={styles.footer}>
          {currentStep > 1 && currentStep < 5 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
              <Text style={styles.backButtonText}>Tillbaka</Text>
            </TouchableOpacity>
          )}

          {currentStep === 1 && (
            <TouchableOpacity style={styles.backButton} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.backButtonText}>Hoppa över</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              currentStep === 5 ? styles.primaryButtonFull : null,
              isGenerating && styles.primaryButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={isGenerating}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              {currentStep === 1 ? 'Kom igång' : currentStep === 5 ? 'Börja träna' : 'Nästa'}
            </Text>
            {currentStep < 5 && <ChevronRight size={20} color="#121A00" strokeWidth={2.5} />}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  </Modal>
);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#131313',
  },
  container: {
    flex: 1,
    backgroundColor: '#131313',
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
    color: '#8E9379',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#1F222A',
  },
  skipButtonText: {
    color: '#C4C9AC',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarTrack: {
    width: '100%',
    height: 3,
    backgroundColor: '#2A2A2A',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#CCFF00',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  stepContainer: {
    flex: 1,
  },
  heroWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  heroGlowCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(204, 255, 0, 0.12)',
    borderWidth: 2,
    borderColor: '#CCFF00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#CCFF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  heroInnerCard: {
    width: 130,
    height: 130,
    borderRadius: 65,
    overflow: 'hidden',
    backgroundColor: '#1F222A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogoImage: {
    width: '100%',
    height: '100%',
  },
  heroCheckCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#CCFF00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E5E2E1',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 30,
  },
  mainSubtitle: {
    fontSize: 14,
    color: '#C4C9AC',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  valuePropsContainer: {
    gap: 12,
    marginTop: 8,
  },
  valuePropCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F222A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  valuePropIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  valuePropTextBox: {
    flex: 1,
  },
  valuePropTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E5E2E1',
    marginBottom: 2,
  },
  valuePropSubtitle: {
    fontSize: 12,
    color: '#C4C9AC',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E9379',
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  optionsList: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F222A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
  },
  optionCardSelected: {
    backgroundColor: '#232A1F',
    borderColor: '#CCFF00',
    shadowColor: '#CCFF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#131313',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionIconContainerSelected: {
    backgroundColor: '#CCFF00',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E5E2E1',
    marginBottom: 2,
  },
  optionTitleSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  optionSubtitle: {
    fontSize: 12,
    color: '#C4C9AC',
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#444933',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  radioCircleSelected: {
    backgroundColor: '#CCFF00',
    borderColor: '#CCFF00',
  },
  checkboxSquare: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#444933',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  checkboxSquareChecked: {
    backgroundColor: '#CCFF00',
    borderColor: '#CCFF00',
  },
  frequencySection: {
    marginTop: 24,
  },
  frequencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  recommendedBadge: {
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCFF00',
  },
  recommendedBadgeText: {
    color: '#CCFF00',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  frequencyPillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  frequencyPill: {
    flex: 1,
    backgroundColor: '#1F222A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
  },
  frequencyPillSelected: {
    backgroundColor: '#CCFF00',
    borderColor: '#CCFF00',
  },
  frequencyPillText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E5E2E1',
  },
  frequencyPillTextSelected: {
    color: '#121A00',
  },
  durationPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E5E2E1',
  },
  durationPillTextSelected: {
    color: '#121A00',
  },
  frequencyPillSub: {
    fontSize: 10,
    color: '#8E9379',
    marginTop: 1,
  },
  frequencyPillSubSelected: {
    color: '#121A00',
    fontWeight: '600',
  },
  frequencyHint: {
    fontSize: 12,
    color: '#8E9379',
    marginTop: 10,
    textAlign: 'center',
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    backgroundColor: '#1F222A',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  presetChipText: {
    color: '#E5E2E1',
    fontSize: 13,
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: '#1F222A',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 12,
  },
  summaryCardHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E9379',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  summaryRowLabel: {
    fontSize: 14,
    color: '#C4C9AC',
  },
  summaryRowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E2E1',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(204, 255, 0, 0.05)',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.15)',
  },
  tipBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#C4C9AC',
    lineHeight: 18,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingGlowCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E5E2E1',
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#C4C9AC',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    backgroundColor: '#131313',
    borderTopWidth: 1,
    borderTopColor: '#1F222A',
  },
  backButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1F222A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E2E1',
  },
  primaryButton: {
    flex: 1.5,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#CCFF00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#CCFF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonFull: {
    flex: 1,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#121A00',
  },
});
