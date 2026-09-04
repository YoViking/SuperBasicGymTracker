import exerciseTargets from '../data/exerciseTargets';

export interface MuscleSubGroup {
  id: string; // e.g. 'triceps', 'biceps'
  label: string; // e.g. 'Triceps', 'Biceps'
}

export const TARGET_DISPLAY_SV: Record<string, string> = {
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearms: 'Underarmar',
  quadriceps: 'Framsida lår',
  hamstrings: 'Baksida lår',
  calves: 'Vader',
  lats: 'Lats',
  'middle back': 'Övre rygg',
  'lower back': 'Ländrygg',
  traps: 'Traps',
  neck: 'Nacke',
  chest: 'Bröst',
  shoulders: 'Axlar',
  abdominals: 'Mage',
  glutes: 'Rumpa',
  adductors: 'Insida lår',
  abductors: 'Utsida lår',
  other: 'Övrigt'
};

export const GROUP_SUB_MUSCLES: Record<string, MuscleSubGroup[]> = {
  Arms: [
    { id: 'triceps', label: 'Triceps' },
    { id: 'biceps', label: 'Biceps' },
    { id: 'forearms', label: 'Underarmar' }
  ],
  Legs: [
    { id: 'quadriceps', label: 'Framsida lår' },
    { id: 'hamstrings', label: 'Baksida lår' },
    { id: 'calves', label: 'Vader' }
  ],
  Back: [
    { id: 'lats', label: 'Lats' },
    { id: 'middle back', label: 'Övre rygg' },
    { id: 'lower back', label: 'Ländrygg' },
    { id: 'traps', label: 'Traps' },
    { id: 'neck', label: 'Nacke' }
  ],
  Chest: [
    { id: 'chest', label: 'Bröst' }
  ],
  Shoulders: [
    { id: 'shoulders', label: 'Axlar' }
  ],
  Core: [
    { id: 'abdominals', label: 'Mage' }
  ],
  Glutes: [
    { id: 'glutes', label: 'Rumpa' }
  ],
  Other: [
    { id: 'adductors', label: 'Insida lår' },
    { id: 'abductors', label: 'Utsida lår' }
  ]
};

// Aliases for Swedish main group names
GROUP_SUB_MUSCLES['Armar'] = GROUP_SUB_MUSCLES['Arms'];
GROUP_SUB_MUSCLES['Ben'] = GROUP_SUB_MUSCLES['Legs'];
GROUP_SUB_MUSCLES['Rygg'] = GROUP_SUB_MUSCLES['Back'];
GROUP_SUB_MUSCLES['Bröst'] = GROUP_SUB_MUSCLES['Chest'];
GROUP_SUB_MUSCLES['Axlar'] = GROUP_SUB_MUSCLES['Shoulders'];
GROUP_SUB_MUSCLES['Mage'] = GROUP_SUB_MUSCLES['Core'];
GROUP_SUB_MUSCLES['Rumpa'] = GROUP_SUB_MUSCLES['Glutes'];
GROUP_SUB_MUSCLES['Övrigt'] = GROUP_SUB_MUSCLES['Other'];

// Inverted lookup to find main group from target
const TARGET_TO_MAIN_GROUP: Record<string, string> = {
  triceps: 'Arms',
  biceps: 'Arms',
  forearms: 'Arms',
  quadriceps: 'Legs',
  hamstrings: 'Legs',
  calves: 'Legs',
  lats: 'Back',
  'middle back': 'Back',
  'lower back': 'Back',
  traps: 'Back',
  neck: 'Back',
  chest: 'Chest',
  shoulders: 'Shoulders',
  abdominals: 'Core',
  glutes: 'Glutes',
  adductors: 'Other',
  abductors: 'Other'
};

const idMap: Record<string, string> = (exerciseTargets as any).idMap || {};
const nameMap: Record<string, string> = (exerciseTargets as any).nameMap || {};

/**
 * Returns the target muscle and its Swedish display name for a given exercise ID or name.
 */
export function getExerciseTarget(
  id?: string | null,
  name?: string | null
): { target: string; targetSv: string; mainGroup: string } {
  let target = '';

  if (id && idMap[id]) {
    target = idMap[id];
  } else if (name) {
    const cleanName = name.toLowerCase().trim();
    if (nameMap[cleanName]) {
      target = nameMap[cleanName];
    } else {
      // Fuzzy / substring match fallback
      const foundKey = Object.keys(nameMap).find(k => cleanName.includes(k) || k.includes(cleanName));
      if (foundKey) {
        target = nameMap[foundKey];
      }
    }
  }

  if (!target) {
    target = 'other';
  }

  const targetSv = TARGET_DISPLAY_SV[target] || target.charAt(0).toUpperCase() + target.slice(1);
  const mainGroup = TARGET_TO_MAIN_GROUP[target] || 'Other';

  return { target, targetSv, mainGroup };
}

/**
 * Returns the list of sub-muscles for a given main muscle group.
 */
export function getSubMusclesForGroup(group?: string | null): MuscleSubGroup[] {
  if (!group) return [];
  const normalized = group.trim();
  return GROUP_SUB_MUSCLES[normalized] || [];
}

/**
 * Converts any target key or Swedish label to standard English target key.
 */
export function normalizeTargetKey(target?: string | null): string {
  if (!target) return '';
  const clean = target.toLowerCase().trim();
  for (const [key, svLabel] of Object.entries(TARGET_DISPLAY_SV)) {
    if (key.toLowerCase() === clean || svLabel.toLowerCase() === clean) {
      return key;
    }
  }
  return clean;
}
