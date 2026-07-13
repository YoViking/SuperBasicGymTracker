export const getMuscleGroupImage = (muscleGroup?: string) => {
  if (!muscleGroup) return require('../../img/chest.jpg');
  const mg = muscleGroup.toLowerCase();
  if (mg === 'bröst' || mg === 'chest') return require('../../img/chest.jpg');
  if (mg === 'rygg' || mg === 'back') return require('../../img/back.jpg');
  if (mg === 'arm' || mg === 'armar' || mg === 'arms') return require('../../img/arms.jpg');
  if (mg === 'ben' || mg === 'legs') return require('../../img/legs.jpg');
  return require('../../img/chest.jpg'); 
};
