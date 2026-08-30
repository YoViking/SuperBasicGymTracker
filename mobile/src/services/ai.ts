import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { findBestExerciseMatch } from './exerciseMatcher';
import { ExerciseLibrary } from '../types';
import { cacheService } from './cacheService';

// Types for the generated AI program
export interface GeneratedExercise {
  exerciseName: string;
  targetMuscle: string;
  equipment: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes: string;
}

export interface GeneratedWorkout {
  dayName: string;
  targetFocus: string;
  estimatedDurationMinutes: number;
  exercises: GeneratedExercise[];
}

export interface GeneratedProgram {
  programName: string;
  description: string;
  daysPerWeek: number;
  workouts: GeneratedWorkout[];
}

// Preview type combining generated data with matched database exercises
export interface MatchedExercise extends GeneratedExercise {
  matchedExerciseId: string | null;
  matchedExerciseName: string;
  matchedGifUrl: string | null;
}

export interface MatchedWorkout {
  dayName: string;
  targetFocus: string;
  estimatedDurationMinutes: number;
  exercises: MatchedExercise[];
}

export interface MatchedProgram {
  programName: string;
  description: string;
  daysPerWeek: number;
  workouts: MatchedWorkout[];
}

/**
 * Sends inputs to the OpenCode Zen API directly or falls back to client-side mock generation if keys are missing/billing fails.
 */
export async function fetchAIProgram(inputs: {
  location: string;
  equipment: string[];
  daysPerWeek: number;
  duration: string;
  splitType: string;
  injuries: string[];
  exclusions: string;
  fitnessGoal: string;
}): Promise<GeneratedProgram> {
  const { location, equipment, daysPerWeek, duration, splitType, injuries, exclusions, fitnessGoal } = inputs;
  
  // Read key. In Expo client, environment variables prefixed with EXPO_PUBLIC_ are exposed.
  const apiKey = process.env.EXPO_PUBLIC_OPENCODE_API_KEY || process.env.OPENCODE_API_KEY;
  const modelName = process.env.EXPO_PUBLIC_OPENCODE_MODEL || process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free';

  // Fallback if key is missing or is the default placeholder
  if (!apiKey || apiKey === 'your_opencode_api_key_here') {
    console.log('No OpenCode API key found on client. Using client-side mock generator.');
    return generateMockProgram(inputs);
  }

  try {
    console.log(`Calling OpenCode Zen API client-side with model ${modelName}...`);
    
    const systemPrompt = `You are an expert strength coach.
Generate a balanced weekly workout program based on user constraints.
Strictly avoid exercises that strain reported injury areas:
- If 'Wrists' is flagged: Avoid barbell wrist-heavy exercises, heavy front squats, or traditional bench press where heavy wrist extension occurs. Substitute with safer alternatives like neutral-grip dumbbells or machines.
- If 'Knees' is flagged: Avoid heavy squats, lunges, leg extensions. Substitute with box squats, leg curls, or glute bridges.
- If 'Shoulders' is flagged: Avoid overhead presses, traditional bench press, or dips. Substitute with incline dumbbell presses, landmine presses, or chest press machines.
- If 'Lower Back' is flagged: Avoid heavy deadlifts, bent-over rows, or back squats. Substitute with chest-supported rows, leg presses, or hip thrusts.
- If 'Elbows' is flagged: Avoid skull crushers, heavy tricep pushdowns, or chin-ups. Substitute with neutral grip pushdowns, hammer curls, or light extensions.
- If 'Ankles' is flagged: Avoid calf raises with heavy extension, deep squats, or running. Substitute with leg presses, seated calf raises, or swimming/cycling (cardio).

Only select exercises matching the provided available equipment.
Exclusions requested by the user: "${exclusions || 'None'}". Ensure you avoid any exercises or movements mentioned here.

Return ONLY a structured JSON response matching this exact schema:
{
  "programName": "Name of the program",
  "description": "Short description of the program and its focus",
  "daysPerWeek": number,
  "workouts": [
    {
      "dayName": "Workout Day Name (e.g. Day 1: Upper Body Push)",
      "targetFocus": "Main target muscles or focus",
      "estimatedDurationMinutes": number,
      "exercises": [
        {
          "exerciseName": "Standard English exercise name (e.g., Dumbbell Bench Press)",
          "targetMuscle": "Chest, Back, Legs, Arms, Shoulders, Core, Glutes, or Other",
          "equipment": "body only, machine, kettlebells, dumbbell, cable, barbell, or bands",
          "sets": number,
          "reps": "string showing reps, e.g. 8-12 or 5",
          "restSeconds": number,
          "notes": "Advice and safety tips"
        }
      ]
    }
  ]
}`;

    const userPrompt = `Generate a workout program with the following constraints:
- Location: ${location}
- Available Equipment: ${equipment.join(', ') || 'bodyweight only'}
- Frequency: ${daysPerWeek} days per week
- Target Workout Duration: ${duration}
- Split Type: ${splitType}
- Sensitive/Injured Body Parts: ${injuries.join(', ') || 'None'}
- Specific Exclusions/Notes: ${exclusions || 'None'}
- Fitness Goal: ${fitnessGoal}`;

    const response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`OpenCode Zen API returned error status ${response.status}: ${errText}. Falling back to mock generator.`);
      return generateMockProgram(inputs);
    }

    const apiData = await response.json();
    const content = apiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content returned from OpenCode Zen API');
    }

    // Extract and parse returned JSON safely
    let cleanJson;
    let cleanText = content.trim();
    if (cleanText.startsWith('```')) {
      const firstNewline = cleanText.indexOf('\n');
      const lastBackticks = cleanText.lastIndexOf('```');
      if (firstNewline !== -1 && lastBackticks !== -1 && lastBackticks > firstNewline) {
        cleanText = cleanText.substring(firstNewline + 1, lastBackticks).trim();
      }
    }
    cleanJson = JSON.parse(cleanText);

    // Schema normalization
    if (cleanJson.program && typeof cleanJson.program === 'object' && !Array.isArray(cleanJson.program)) {
      cleanJson = { ...cleanJson.program, ...cleanJson };
    }
    if (!cleanJson.workouts && cleanJson.days && Array.isArray(cleanJson.days)) {
      cleanJson.workouts = cleanJson.days;
    }
    if (!cleanJson.workouts || !Array.isArray(cleanJson.workouts)) {
      throw new Error('AI response missing workouts array');
    }

    // Sanitize workouts and exercises
    cleanJson.workouts = cleanJson.workouts.map((w: any) => {
      let exercises = w.exercises;
      if (!exercises && w.actions && Array.isArray(w.actions)) exercises = w.actions;
      if (!exercises && w.movements && Array.isArray(w.movements)) exercises = w.movements;
      if (!exercises) exercises = [];

      return {
        dayName: w.dayName || w.name || 'Träningspass',
        targetFocus: w.targetFocus || w.focus || 'Allmänt',
        estimatedDurationMinutes: parseInt(w.estimatedDurationMinutes || w.duration) || 60,
        exercises: exercises.map((ex: any) => ({
          exerciseName: ex.exerciseName || ex.name || 'Övning',
          targetMuscle: ex.targetMuscle || ex.muscle || 'Other',
          equipment: ex.equipment || 'body only',
          sets: parseInt(ex.sets) || 3,
          reps: String(ex.reps || '8-12'),
          restSeconds: parseInt(ex.restSeconds || ex.rest) || 60,
          notes: ex.notes || ''
        }))
      };
    });

    return cleanJson as GeneratedProgram;
  } catch (error) {
    console.warn('Failed client-side AI generation. Falling back to mock generator. Error:', error);
    return generateMockProgram(inputs);
  }
}

/**
 * Maps a generated AI program to the database exercise library using fuzzy matching.
 */
export async function mapProgramToLibrary(program: GeneratedProgram): Promise<MatchedProgram> {
  // 1. Fetch entire exercise library to run matches locally
  const { data: libraryData, error: libraryError } = await supabase
    .from('exercise_library')
    .select('*')
    .limit(3000);

  if (libraryError) {
    console.error('Error fetching exercise library for matcher:', libraryError);
  }

  const library = (libraryData || []) as ExerciseLibrary[];

  // 1b. Defensive guard: check if program structure is valid
  if (!program || !program.workouts || !Array.isArray(program.workouts)) {
    console.error('Invalid program structure in mapProgramToLibrary:', program);
    return {
      programName: program?.programName || 'AI Träningsprogram',
      description: program?.description || 'Skräddarsytt program',
      daysPerWeek: program?.daysPerWeek || 0,
      workouts: []
    };
  }

  // 2. Perform matches
  const matchedWorkouts = program.workouts.map(w => {
    const matchedExercises = w.exercises.map(ex => {
      const match = findBestExerciseMatch(ex.exerciseName, ex.targetMuscle, ex.equipment, library);
      return {
        ...ex,
        matchedExerciseId: match ? match.id : null,
        matchedExerciseName: match ? match.name : ex.exerciseName,
        matchedGifUrl: match ? match.gifUrl || null : null
      };
    });

    return {
      ...w,
      exercises: matchedExercises
    };
  });

  return {
    ...program,
    workouts: matchedWorkouts
  };
}

// Helper: Parse reps string (like "8-12") to a number for the DB
function parseReps(repsStr: string | number): number {
  if (typeof repsStr === 'number') return repsStr;
  const match = repsStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 10;
}

/**
 * Checks if a user already has a folder/program with the same name.
 */
export async function checkExistingProgram(
  programName: string,
  userId: string
): Promise<{ exists: boolean; existingFolderId?: string; existingFolderName?: string }> {
  if (!userId || !programName) return { exists: false };

  try {
    const { data: existingFolder } = await supabase
      .from('folders')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', programName.trim())
      .maybeSingle();

    if (existingFolder) {
      return {
        exists: true,
        existingFolderId: existingFolder.id,
        existingFolderName: existingFolder.name
      };
    }

    return { exists: false };
  } catch (err) {
    console.error('Error checking existing program:', err);
    return { exists: false };
  }
}

/**
 * Saves a matched program to Supabase as a folder, workouts, and workout_exercises.
 * If overwriteFolderId is provided, it replaces the workouts & exercises in that existing folder.
 * Returns the folder/program ID.
 */
export async function saveProgramToDatabase(
  matchedProgram: MatchedProgram,
  userId: string,
  overwriteFolderId?: string
): Promise<string> {
  if (!userId) throw new Error('User must be logged in to save a program.');

  try {
    let folderId: string;

    if (overwriteFolderId) {
      folderId = overwriteFolderId;
      // 1a. Overwrite existing program: find and delete existing workouts under this folder
      const { data: oldWorkouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('folder_id', folderId)
        .eq('user_id', userId);

      if (oldWorkouts && oldWorkouts.length > 0) {
        const oldWorkoutIds = oldWorkouts.map(w => w.id);
        // Delete all exercises for these workouts
        await supabase
          .from('workout_exercises')
          .delete()
          .in('workout_id', oldWorkoutIds);

        // Delete old workouts
        await supabase
          .from('workouts')
          .delete()
          .in('id', oldWorkoutIds)
          .eq('user_id', userId);
      }

      // Update folder name/description
      await supabase
        .from('folders')
        .update({
          name: matchedProgram.programName,
          description: matchedProgram.description
        })
        .eq('id', folderId);
    } else {
      // 1b. Create the Folder (represents the overall program)
      let { data: folder, error: folderError } = await supabase
        .from('folders')
        .insert([{
          name: matchedProgram.programName,
          description: matchedProgram.description,
          user_id: userId,
          image_url: 'ai-default',
          is_ai: true
        }])
        .select()
        .single();

      if (folderError && folderError.message.includes('is_ai')) {
        const fb = await supabase
          .from('folders')
          .insert([{
            name: matchedProgram.programName,
            description: matchedProgram.description,
            user_id: userId,
            image_url: 'ai-default'
          }])
          .select()
          .single();
        folder = fb.data;
        folderError = fb.error;
      }

      if (folderError || !folder) {
        throw new Error(`Failed to create program folder: ${folderError?.message}`);
      }
      folderId = folder.id;
    }

    // 2. Insert workouts and workout exercises sequentially
    for (const w of matchedProgram.workouts) {
      // Create the workout (with is_ai: true, with fallback if column not yet added in DB)
      let { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert([{
          name: w.dayName,
          folder_id: folderId,
          user_id: userId,
          is_ai: true
        }])
        .select()
        .single();

      if (workoutError && workoutError.message.includes('is_ai')) {
        const fallback = await supabase
          .from('workouts')
          .insert([{
            name: w.dayName,
            folder_id: folderId,
            user_id: userId
          }])
          .select()
          .single();
        workout = fallback.data;
        workoutError = fallback.error;
      }

      if (workoutError || !workout) {
        throw new Error(`Failed to create workout: ${workoutError?.message}`);
      }

      // Collect sets to insert under this workout
      const setsToInsert: any[] = [];
      w.exercises.forEach((ex, exIndex) => {
        // If we matched an exercise, write it
        if (ex.matchedExerciseId) {
          const reps = parseReps(ex.reps);
          const notes = `${ex.notes || ''} (Vila: ${ex.restSeconds || 60}s)`.trim();
          
          for (let i = 0; i < ex.sets; i++) {
            setsToInsert.push({
              workout_id: workout.id,
              exercise_id: ex.matchedExerciseId,
              sets: i + 1, // Set index 1-based
              reps: reps,
              weight: 0, // default empty
              is_done: false,
              notes: notes,
              order_index: exIndex
            });
          }
        }
      });

      // Insert sets in bulk for the workout
      if (setsToInsert.length > 0) {
        const { error: exercisesError } = await supabase
          .from('workout_exercises')
          .insert(setsToInsert);

        if (exercisesError) {
          throw new Error(`Failed to insert workout exercises: ${exercisesError.message}`);
        }
      }
    }

    // Invalidate cache so workouts & folders reload cleanly
    cacheService.invalidate('workouts', userId);

    return folderId;
  } catch (error) {
    console.error('Error saving program:', error);
    throw error;
  }
}

// -------------------------------------------------------------
// High-Fidelity Client-Side Mock Program Generator
// -------------------------------------------------------------
function generateMockProgram(inputs: {
  location: string;
  equipment: string[];
  daysPerWeek: number;
  duration: string;
  splitType: string;
  injuries: string[];
  exclusions: string;
  fitnessGoal: string;
}): GeneratedProgram {
  const { location, equipment, daysPerWeek, duration, splitType, injuries, exclusions, fitnessGoal } = inputs;

  const hasBarbell = equipment.includes('Barbell') || equipment.length === 0;
  const hasDumbbell = equipment.includes('Dumbbell') || equipment.length === 0;
  const hasCable = equipment.includes('Cable') || equipment.length === 0;
  const hasMachine = equipment.includes('Machine') || equipment.length === 0;
  const hasKettlebell = equipment.includes('Kettlebell') || equipment.length === 0;
  const hasBands = equipment.includes('Resistance Bands') || equipment.length === 0;
  const hasBodyweight = equipment.includes('Bodyweight') || equipment.length === 0 || equipment.length === 0;

  const hasInjury = (part: string) => injuries.map(i => i.toLowerCase()).includes(part.toLowerCase());

  let sets = 3;
  let reps = '8-12';
  let rest = 90;
  let goalDesc = 'hypertrofi (muskeltillväxt)';

  if (fitnessGoal.includes('Strength')) {
    sets = 4;
    reps = '5';
    rest = 120;
    goalDesc = 'maximal styrka';
  } else if (fitnessGoal.includes('Endurance')) {
    sets = 3;
    reps = '15-20';
    rest = 60;
    goalDesc = 'muskeluthållighet';
  } else if (fitnessGoal.includes('General')) {
    sets = 3;
    reps = '10-12';
    rest = 75;
    goalDesc = 'allmän fitness';
  }

  const getExercisePool = (muscle: string): Array<{ name: string; eq: string; notes: string }> => {
    const list: Array<{ name: string; eq: string; notes: string; strains: string[] }> = [];

    if (muscle === 'Chest') {
      if (hasBarbell && !hasInjury('wrists') && !hasInjury('shoulders')) {
        list.push({ name: 'Barbell Bench Press', eq: 'barbell', notes: 'Squeeze shoulder blades together', strains: ['wrists', 'shoulders'] });
        list.push({ name: 'Incline Barbell Bench Press', eq: 'barbell', notes: 'Lower barbell to upper chest', strains: ['wrists', 'shoulders'] });
      }
      if (hasDumbbell) {
        list.push({ name: 'Dumbbell Bench Press', eq: 'dumbbell', notes: 'Neutral grip is safer on wrists and shoulders', strains: [] });
        list.push({ name: 'Incline Dumbbell Bench Press', eq: 'dumbbell', notes: 'Keeps shoulders in a safer path', strains: [] });
      }
      if (hasCable && !hasInjury('shoulders')) {
        list.push({ name: 'Cable Crossover', eq: 'cable', notes: 'Squeeze chest at the bottom', strains: ['shoulders'] });
      }
      if (hasMachine) {
        list.push({ name: 'Chest Press Machine', eq: 'machine', notes: 'Safe alternative to free weights', strains: [] });
      }
      if (hasBodyweight && !hasInjury('wrists') && !hasInjury('shoulders')) {
        list.push({ name: 'Push-Up', eq: 'body only', notes: 'Keep body in straight line', strains: ['wrists', 'shoulders'] });
      }
    }

    if (muscle === 'Back') {
      if (hasBarbell && !hasInjury('lower back') && !hasInjury('wrists')) {
        list.push({ name: 'Barbell Deadlift', eq: 'barbell', notes: 'Keep spine neutral, hinge hips', strains: ['lower back', 'wrists'] });
        list.push({ name: 'Bent-Over Barbell Row', eq: 'barbell', notes: 'Pull bar towards lower abdomen', strains: ['lower back', 'wrists'] });
      }
      if (hasDumbbell && !hasInjury('lower back')) {
        list.push({ name: 'One-Arm Dumbbell Row', eq: 'dumbbell', notes: 'Support body on bench to protect lower back', strains: [] });
      }
      if (hasCable) {
        list.push({ name: 'Lat Pulldown', eq: 'cable', notes: 'Pull down to upper collarbone', strains: [] });
        list.push({ name: 'Seated Cable Row', eq: 'cable', notes: 'Sit upright, pull with chest out', strains: [] });
      }
      if (hasMachine) {
        list.push({ name: 'Chest-Supported Row Machine', eq: 'machine', notes: 'Perfect row alternative for lower back injuries', strains: [] });
      }
      if (hasBodyweight && !hasInjury('elbows')) {
        list.push({ name: 'Pull-Up', eq: 'body only', notes: 'Full range of motion', strains: ['elbows'] });
      }
    }

    if (muscle === 'Legs') {
      if (hasBarbell && !hasInjury('knees') && !hasInjury('lower back')) {
        list.push({ name: 'Barbell Back Squat', eq: 'barbell', notes: 'Sit back, keep chest up', strains: ['knees', 'lower back'] });
        list.push({ name: 'Barbell Romanian Deadlift', eq: 'barbell', notes: 'Feel stretch in hamstrings', strains: ['lower back'] });
      }
      if (hasDumbbell && !hasInjury('knees')) {
        list.push({ name: 'Dumbbell Goblet Squat', eq: 'dumbbell', notes: 'Hold close to chest, keep heels down', strains: [] });
        list.push({ name: 'Dumbbell Romanian Deadlift', eq: 'dumbbell', notes: 'Hinge hips back, keep back flat', strains: [] });
      }
      if (hasMachine) {
        if (!hasInjury('knees')) {
          list.push({ name: 'Leg Press', eq: 'machine', notes: 'Adjust depth to protect knees', strains: ['knees'] });
        }
        list.push({ name: 'Lying Leg Curl', eq: 'machine', notes: 'Squeeze hamstrings at top', strains: [] });
      }
      if (hasBodyweight) {
        list.push({ name: 'Glute Bridge', eq: 'body only', notes: 'Squeeze glutes at top', strains: [] });
        if (!hasInjury('knees')) {
          list.push({ name: 'Bodyweight Squat', eq: 'body only', notes: 'Keep chest tall', strains: ['knees'] });
        }
      }
    }

    if (muscle === 'Shoulders') {
      if (hasBarbell && !hasInjury('shoulders') && !hasInjury('wrists')) {
        list.push({ name: 'Barbell Overhead Press', eq: 'barbell', notes: 'Strict press, do not flare elbows', strains: ['shoulders', 'wrists'] });
      }
      if (hasDumbbell) {
        list.push({ name: 'Dumbbell Lateral Raise', eq: 'dumbbell', notes: 'Raise to shoulder level with pinkies up slightly', strains: [] });
        if (!hasInjury('shoulders')) {
          list.push({ name: 'Dumbbell Shoulder Press', eq: 'dumbbell', notes: 'Press straight up with palms in', strains: ['shoulders'] });
        }
      }
      if (hasCable) {
        list.push({ name: 'Cable Face Pull', eq: 'cable', notes: 'Pull to nose, squeeze rear delts', strains: [] });
      }
      if (hasMachine) {
        list.push({ name: 'Shoulder Press Machine', eq: 'machine', notes: 'Fixed path offers high stability', strains: ['shoulders'] });
      }
    }

    if (muscle === 'Arms') {
      if (hasBarbell && !hasInjury('wrists')) {
        list.push({ name: 'Barbell Bicep Curl', eq: 'barbell', notes: 'Do not swing body', strains: ['wrists'] });
      }
      if (hasDumbbell) {
        list.push({ name: 'Dumbbell Hammer Curl', eq: 'dumbbell', notes: 'Neutral grip is very safe on wrists', strains: [] });
        list.push({ name: 'Incline Dumbbell Bicep Curl', eq: 'dumbbell', notes: 'Stretch bicep at the bottom', strains: [] });
      }
      if (hasCable && !hasInjury('elbows')) {
        list.push({ name: 'Triceps Rope Pushdown', eq: 'cable', notes: 'Keep elbows tucked at sides', strains: ['elbows'] });
      }
      if (hasBands) {
        list.push({ name: 'Bicep Band Curl', eq: 'bands', notes: 'Keep constant tension', strains: [] });
      }
    }

    if (muscle === 'Core') {
      list.push({ name: 'Plank', eq: 'body only', notes: 'Keep core tight, body level', strains: [] });
      list.push({ name: 'Abdominal Crunch', eq: 'body only', notes: 'Contract abs, do not pull neck', strains: [] });
    }

    if (muscle === 'Glutes') {
      if (hasDumbbell) {
        list.push({ name: 'Dumbbell Hip Thrust', eq: 'dumbbell', notes: 'Drive hips up, squeeze glutes', strains: [] });
      } else if (hasBarbell && !hasInjury('lower back')) {
        list.push({ name: 'Barbell Hip Thrust', eq: 'barbell', notes: 'Hold at top for 1s', strains: ['lower back'] });
      } else {
        list.push({ name: 'Bodyweight Hip Thrust', eq: 'body only', notes: 'High volume squeeze', strains: [] });
      }
    }

    if (list.length === 0) {
      list.push({ name: `${muscle} Exercise`, eq: 'body only', notes: 'Do standard movement', strains: [] });
    }

    return list.filter(ex => {
      const strainsInjury = ex.strains?.some(str => hasInjury(str));
      return !strainsInjury;
    });
  };

  const workouts: any[] = [];
  const names: string[] = [];
  const muscleGroupsPerDay: string[][] = [];

  if (splitType.includes('Full Body')) {
    for (let d = 1; d <= daysPerWeek; d++) {
      names.push(`Pass ${d}: Helkropp`);
      muscleGroupsPerDay.push(['Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Core']);
    }
  } else if (splitType.includes('Upper/Lower')) {
    for (let d = 1; d <= daysPerWeek; d++) {
      if (d % 2 === 1) {
        names.push(`Pass ${d}: Överkropp`);
        muscleGroupsPerDay.push(['Chest', 'Back', 'Shoulders', 'Arms']);
      } else {
        names.push(`Pass ${d}: Underkropp & Mage`);
        muscleGroupsPerDay.push(['Legs', 'Glutes', 'Core']);
      }
    }
  } else if (splitType.includes('Push/Pull/Legs') || splitType.includes('PPL')) {
    for (let d = 1; d <= daysPerWeek; d++) {
      const mod = d % 3;
      if (mod === 1) {
        names.push(`Pass ${d}: Push (Bröst/Axlar/Triceps)`);
        muscleGroupsPerDay.push(['Chest', 'Shoulders', 'Arms']);
      } else if (mod === 2) {
        names.push(`Pass ${d}: Pull (Rygg/Biceps)`);
        muscleGroupsPerDay.push(['Back', 'Arms']);
      } else {
        names.push(`Pass ${d}: Legs (Ben/Mage)`);
        muscleGroupsPerDay.push(['Legs', 'Glutes', 'Core']);
      }
    }
  } else {
    if (daysPerWeek === 1) {
      names.push('Helkropp Express');
      muscleGroupsPerDay.push(['Legs', 'Chest', 'Back', 'Core']);
    } else if (daysPerWeek === 2) {
      names.push('Pass A: Överkropp');
      muscleGroupsPerDay.push(['Chest', 'Back', 'Shoulders', 'Arms']);
      names.push('Pass B: Underkropp');
      muscleGroupsPerDay.push(['Legs', 'Glutes', 'Core']);
    } else if (daysPerWeek === 3) {
      names.push('Pass 1: Bröst, Rygg & Armar');
      muscleGroupsPerDay.push(['Chest', 'Back', 'Arms']);
      names.push('Pass 2: Ben & Rumpa');
      muscleGroupsPerDay.push(['Legs', 'Glutes']);
      names.push('Pass 3: Axlar & Mage');
      muscleGroupsPerDay.push(['Shoulders', 'Core']);
    } else {
      for (let d = 1; d <= daysPerWeek; d++) {
        names.push(`Pass ${d}: Split`);
        const muscles = [['Chest', 'Arms'], ['Legs'], ['Back', 'Core'], ['Shoulders', 'Glutes']];
        muscleGroupsPerDay.push(muscles[(d - 1) % muscles.length]);
      }
    }
  }

  for (let i = 0; i < daysPerWeek; i++) {
    const dayName = names[i] || `Day ${i + 1}`;
    const muscles = muscleGroupsPerDay[i] || ['Legs', 'Chest', 'Back'];
    const exercisesList: any[] = [];

    for (const muscle of muscles) {
      const pool = getExercisePool(muscle);
      if (pool.length > 0) {
        const numToSelect = muscles.length > 4 ? 1 : 2;
        const selected = pool.slice(0, numToSelect);
        selected.forEach(ex => {
          exercisesList.push({
            exerciseName: ex.name,
            targetMuscle: muscle,
            equipment: ex.eq,
            sets: sets,
            reps: reps,
            restSeconds: rest,
            notes: ex.notes
          });
        });
      }
    }

    workouts.push({
      dayName: dayName,
      targetFocus: muscles.join(', '),
      estimatedDurationMinutes: parseInt(duration) || 60,
      exercises: exercisesList.slice(0, 6)
    });
  }

  return {
    programName: `AI-Program: ${fitnessGoal.split(' ')[0]} (${splitType.split(' ')[0]})`,
    description: `Ett skräddarsytt ${daysPerWeek}-dagars program optimerat för ${goalDesc}. Anpassat för ${location} och din tillgängliga utrustning. Skonsamt för ${injuries.join(', ') || 'alla leder'}.`,
    daysPerWeek: daysPerWeek,
    workouts: workouts
  };
}


