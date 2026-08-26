export const DEFAULT_CUSTOM_WORKOUT_IMAGE = require('../../assets/images/default_workout_custom.jpg');
export const DEFAULT_AI_WORKOUT_IMAGE = require('../../assets/images/default_workout_ai.jpg');

export const getMuscleGroupImage = (muscleGroup?: string) => {
  return require('../../assets/images/bicep.png');
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


