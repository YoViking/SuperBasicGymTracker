export const WIZARD_STEPS = [
  { id: 1, title: 'Utrustning' },
  { id: 2, title: 'Upplägg' },
  { id: 3, title: 'Skador' },
  { id: 4, title: 'Mål' },
];

export const LOCATIONS = ['Gym', 'Hem', 'Utomhus'];

export const EQUIPMENT_OPTIONS = [
  'Bodyweight',
  'Dumbbell',
  'Barbell',
  'Cable',
  'Machine',
  'Kettlebell',
  'Resistance Bands',
];

export const SPLIT_OPTIONS = [
  'Full Body',
  'Upper/Lower',
  'Push/Pull/Legs',
  'Split',
  'Auto/AI Recommendation',
];

export const WORKOUT_FOCUS_OPTIONS = [
  'Bröst & Triceps',
  'Rygg & Biceps',
  'Ben & Rumpa',
  'Axlar & Armar',
  'Överkropp',
  'Underkropp',
  'Helkropp',
  'Mage & Core',
  'Auto / AI-Rekommendation ✨',
];

export const DURATION_OPTIONS = ['30m', '45m', '60m', '90m'];

export const INJURY_OPTIONS = [
  'Wrists',
  'Knees',
  'Shoulders',
  'Lower Back',
  'Elbows',
  'Ankles',
];

export const INJURY_LABELS: Record<string, string> = {
  Wrists: 'Handleder',
  Knees: 'Knän',
  Shoulders: 'Axlar',
  'Lower Back': 'Ländrygg',
  Elbows: 'Armbågar',
  Ankles: 'Anklar',
};

export const GOAL_OPTIONS = [
  { id: 'Muscle Growth (Hypertrophy)', label: 'Muskelmassa', desc: 'Hypertrofi och muskeltillväxt' },
  { id: 'Pure Strength', label: 'Styrka', desc: 'Maximal styrka och tunga lyft' },
  { id: 'General Fitness', label: 'Allmän Hälsa', desc: 'Komma i form och må bra' },
  { id: 'Endurance', label: 'Uthållighet', desc: 'Högintensivt och muskeluthållighet' },
];

export const LOADING_MESSAGES = [
  'Analyserar dina val...',
  'Designar ett skräddarsytt upplägg...',
  'Säkerställer skadeanpassning...',
  'Filtrerar passande övningar...',
  'Optimerar volym, set och reps...',
  'Matchar med övningsdatabasen...',
  'Klar om ett ögonblick!',
];
