export const DEFAULT_CUSTOM_WORKOUT_IMAGE = require('../../assets/images/default_workout_custom.jpg');
export const DEFAULT_AI_WORKOUT_IMAGE = require('../../assets/images/default_workout_ai.jpg');

export const MUSCLE_CARD_IMAGES: Record<string, { active: any; inactive: any }> = {
  Chest: {
    active: require('../../assets/images/muscles/chest_active.png'),
    inactive: require('../../assets/images/muscles/chest_inactive.png'),
  },
  Back: {
    active: require('../../assets/images/muscles/back_active.png'),
    inactive: require('../../assets/images/muscles/back_inactive.png'),
  },
  Legs: {
    active: require('../../assets/images/muscles/legs_active.png'),
    inactive: require('../../assets/images/muscles/legs_inactive.png'),
  },
  Arms: {
    active: require('../../assets/images/muscles/arms_active.png'),
    inactive: require('../../assets/images/muscles/arms_inactive.png'),
  },
  Shoulders: {
    active: require('../../assets/images/muscles/shoulders_active.png'),
    inactive: require('../../assets/images/muscles/shoulders_inactive.png'),
  },
  Core: {
    active: require('../../assets/images/muscles/core_active.png'),
    inactive: require('../../assets/images/muscles/core_inactive.png'),
  },
  Glutes: {
    active: require('../../assets/images/muscles/glutes_active.png'),
    inactive: require('../../assets/images/muscles/glutes_inactive.png'),
  },
  Other: {
    active: require('../../assets/images/muscles/other_active.png'),
    inactive: require('../../assets/images/muscles/other_inactive.png'),
  },
  Bookmarked: {
    active: require('../../assets/images/muscles/bookmark_active.png'),
    inactive: require('../../assets/images/muscles/bookmark_inactive.png'),
  },
};

export const getMuscleCardImage = (id?: string, isActive: boolean = false) => {
  if (!id) return isActive ? MUSCLE_CARD_IMAGES.Chest.active : MUSCLE_CARD_IMAGES.Chest.inactive;

  if (MUSCLE_CARD_IMAGES[id]) {
    return isActive ? MUSCLE_CARD_IMAGES[id].active : MUSCLE_CARD_IMAGES[id].inactive;
  }

  const clean = id.toLowerCase().trim();
  let key = 'Chest';
  if (clean.includes('chest') || clean.includes('bröst') || clean.includes('pectoral')) key = 'Chest';
  else if (clean.includes('back') || clean.includes('rygg') || clean.includes('lat') || clean.includes('trap')) key = 'Back';
  else if (clean.includes('leg') || clean.includes('ben') || clean.includes('quad') || clean.includes('calf') || clean.includes('vader') || clean.includes('lår') || clean.includes('hamstring')) key = 'Legs';
  else if (clean.includes('arm') || clean.includes('bicep') || clean.includes('tricep') || clean.includes('underarm')) key = 'Arms';
  else if (clean.includes('shoulder') || clean.includes('axel') || clean.includes('axlar') || clean.includes('deltoid')) key = 'Shoulders';
  else if (clean.includes('core') || clean.includes('ab') || clean.includes('mage')) key = 'Core';
  else if (clean.includes('glute') || clean.includes('rump') || clean.includes('säte')) key = 'Glutes';
  else if (clean.includes('bookmark') || clean.includes('favorit') || clean.includes('bokmärk')) key = 'Bookmarked';
  else if (clean.includes('other') || clean.includes('övrigt') || clean.includes('neck') || clean.includes('nack')) key = 'Other';

  const item = MUSCLE_CARD_IMAGES[key] || MUSCLE_CARD_IMAGES.Chest;
  return isActive ? item.active : item.inactive;
};

export const getMuscleGroupImage = (muscleGroup?: string) => {
  if (!muscleGroup) return MUSCLE_CARD_IMAGES.Arms.active;
  const mg = muscleGroup.toLowerCase().trim();
  if (mg.includes('chest') || mg.includes('bröst') || mg.includes('pectoral')) return MUSCLE_CARD_IMAGES.Chest.active;
  if (mg.includes('back') || mg.includes('rygg') || mg.includes('lat') || mg.includes('trap')) return MUSCLE_CARD_IMAGES.Back.active;
  if (mg.includes('leg') || mg.includes('ben') || mg.includes('quad') || mg.includes('calf') || mg.includes('vader') || mg.includes('lår') || mg.includes('hamstring')) return MUSCLE_CARD_IMAGES.Legs.active;
  if (mg.includes('arm') || mg.includes('bicep') || mg.includes('tricep') || mg.includes('underarm')) return MUSCLE_CARD_IMAGES.Arms.active;
  if (mg.includes('shoulder') || mg.includes('axel') || mg.includes('axlar') || mg.includes('deltoid')) return MUSCLE_CARD_IMAGES.Shoulders.active;
  if (mg.includes('core') || mg.includes('ab') || mg.includes('mage')) return MUSCLE_CARD_IMAGES.Core.active;
  if (mg.includes('glute') || mg.includes('rump') || mg.includes('säte')) return MUSCLE_CARD_IMAGES.Glutes.active;
  if (mg.includes('neck') || mg.includes('nack') || mg.includes('adductor')) return MUSCLE_CARD_IMAGES.Other.active;
  return MUSCLE_CARD_IMAGES.Arms.active;
};

export const getDefaultWorkoutImage = (isAi?: boolean) => {
  return isAi ? DEFAULT_AI_WORKOUT_IMAGE : DEFAULT_CUSTOM_WORKOUT_IMAGE;
};

export const isAiFolder = (folder?: { is_ai?: boolean; image_url?: string; description?: string; name?: string } | null): boolean => {
  if (!folder) return false;
  if (folder.is_ai) return true;
  if (folder.image_url === 'ai-default') return true;
  if (folder.description && (
    folder.description.toLowerCase().includes('skräddarsytt') ||
    folder.description.toLowerCase().includes('ai-skapat') ||
    folder.description.toLowerCase().includes('program genererat')
  )) return true;
  return false;
};

export const isAiWorkout = (
  workout?: { is_ai?: boolean; name?: string; folder_id?: string | null } | null,
  folders?: Array<{ id: string; is_ai?: boolean; image_url?: string; description?: string; name?: string }>
): boolean => {
  if (!workout) return false;
  if (workout.is_ai) return true;
  if (workout.folder_id && folders) {
    const parentFolder = folders.find(f => f.id === workout.folder_id);
    if (parentFolder && isAiFolder(parentFolder)) return true;
  }
  return false;
};


