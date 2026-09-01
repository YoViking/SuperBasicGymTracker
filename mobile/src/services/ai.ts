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
  
  // Read keys. In Expo client, environment variables prefixed with EXPO_PUBLIC_ are exposed.
  const geminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const opencodeKey = process.env.EXPO_PUBLIC_OPENCODE_API_KEY || process.env.OPENCODE_API_KEY;
  const opencodeModel = process.env.EXPO_PUBLIC_OPENCODE_MODEL || process.env.OPENCODE_MODEL || 'mimo-v2.5-free';

  // Check if Gemini key is available (or if opencodeKey is actually a Gemini key starting with AIza)
  const activeGeminiKey = geminiKey || (opencodeKey && opencodeKey.startsWith('AIza') ? opencodeKey : null);
  const activeOpenCodeKey = !activeGeminiKey && opencodeKey && opencodeKey !== 'your_opencode_api_key_here' ? opencodeKey : null;

  // Fallback if no API key is provided
  if (!activeGeminiKey && !activeOpenCodeKey) {
    console.log('No AI API key found on client. Using client-side mock generator.');
    return generateMockProgram(inputs);
  }

  try {
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

Duration & Volume Guidelines:
The number of exercises per workout MUST match the target duration consistently:
- 30 minutes: exactly 4 exercises per workout.
- 45 minutes: exactly 5 exercises per workout.
- 60 minutes: exactly 6 exercises per workout.
- 90 minutes: exactly 7-8 exercises per workout.
Every workout in the program must have a balanced and complete list of exercises according to this count. Never output a workout with only 2-3 exercises.

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

    let content: string | null = null;

    if (activeGeminiKey) {
      console.log('Calling Google Gemini 3.6 Flash API...');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${activeGeminiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Gemini API returned error status ${response.status}: ${errText}. Falling back to mock generator.`);
        return generateMockProgram(inputs);
      }

      const geminiData = await response.json();
      content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } else {
      console.log(`Calling OpenCode Zen API client-side with model ${opencodeModel}...`);
      const response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeOpenCodeKey}`,
        },
        body: JSON.stringify({
          model: opencodeModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`OpenCode Zen API returned error status ${response.status}: ${errText}. Falling back to mock generator.`);
        return generateMockProgram(inputs);
      }

      const apiData = await response.json();
      content = apiData.choices?.[0]?.message?.content || null;
    }
    
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

  const durNum = parseInt(duration) || 60;
  let targetExerciseCount = 6;
  if (durNum <= 30) targetExerciseCount = 4;
  else if (durNum <= 45) targetExerciseCount = 5;
  else if (durNum <= 60) targetExerciseCount = 6;
  else targetExerciseCount = 8;

  const getExercisePool = (muscle: string): Array<{ name: string; eq: string; notes: string }> => {
    const list: Array<{ name: string; eq: string; notes: string; strains: string[] }> = [];

    if (muscle === 'Chest') {
      if (hasBarbell && !hasInjury('wrists') && !hasInjury('shoulders')) {
        list.push({ name: 'Barbell Bench Press', eq: 'barbell', notes: 'Squeeze shoulder blades together, lower bar to mid-chest', strains: ['wrists', 'shoulders'] });
        list.push({ name: 'Incline Barbell Bench Press', eq: 'barbell', notes: 'Lower barbell to upper chest with control', strains: ['wrists', 'shoulders'] });
        list.push({ name: 'Decline Barbell Bench Press', eq: 'barbell', notes: 'Target lower chest fibers', strains: ['wrists', 'shoulders'] });
      }
      if (hasDumbbell) {
        list.push({ name: 'Dumbbell Bench Press', eq: 'dumbbell', notes: 'Neutral grip is safer on wrists and shoulders', strains: [] });
        list.push({ name: 'Incline Dumbbell Bench Press', eq: 'dumbbell', notes: 'Focus on upper chest contraction', strains: [] });
        list.push({ name: 'Dumbbell Chest Fly', eq: 'dumbbell', notes: 'Maintain slight elbow bend and stretch', strains: ['shoulders'] });
      }
      if (hasCable && !hasInjury('shoulders')) {
        list.push({ name: 'Cable Crossover', eq: 'cable', notes: 'Squeeze chest hard at contraction peak', strains: ['shoulders'] });
        list.push({ name: 'Low Cable Chest Fly', eq: 'cable', notes: 'Scoop upward for upper chest focus', strains: ['shoulders'] });
      }
      if (hasMachine) {
        list.push({ name: 'Chest Press Machine', eq: 'machine', notes: 'Fixed path gives great stability for safe overload', strains: [] });
        list.push({ name: 'Pec Deck Fly', eq: 'machine', notes: 'Full stretch and peak contraction', strains: [] });
      }
      if (hasBodyweight && !hasInjury('wrists') && !hasInjury('shoulders')) {
        list.push({ name: 'Push-Up', eq: 'body only', notes: 'Keep core tight and body in a straight line', strains: ['wrists', 'shoulders'] });
        list.push({ name: 'Dips', eq: 'body only', notes: 'Lean slightly forward to bias chest over triceps', strains: ['shoulders', 'elbows'] });
      }
    }

    if (muscle === 'Back') {
      if (hasBarbell && !hasInjury('lower back') && !hasInjury('wrists')) {
        list.push({ name: 'Barbell Deadlift', eq: 'barbell', notes: 'Keep spine neutral, hinge hips back', strains: ['lower back', 'wrists'] });
        list.push({ name: 'Bent-Over Barbell Row', eq: 'barbell', notes: 'Pull bar towards lower abdomen with flat back', strains: ['lower back', 'wrists'] });
        list.push({ name: 'Barbell Shrug', eq: 'barbell', notes: 'Elevate traps straight up', strains: ['wrists'] });
      }
      if (hasDumbbell && !hasInjury('lower back')) {
        list.push({ name: 'One-Arm Dumbbell Row', eq: 'dumbbell', notes: 'Support body on bench to protect lower back', strains: [] });
        list.push({ name: 'Chest-Supported Dumbbell Row', eq: 'dumbbell', notes: 'Eliminates lower back strain, strict back focus', strains: [] });
        list.push({ name: 'Dumbbell Pullover', eq: 'dumbbell', notes: 'Stretch lats over bench with soft elbows', strains: ['shoulders'] });
      }
      if (hasCable) {
        list.push({ name: 'Lat Pulldown', eq: 'cable', notes: 'Pull down to upper collarbone with wide grip', strains: [] });
        list.push({ name: 'Seated Cable Row', eq: 'cable', notes: 'Sit upright, pull into belly with chest up', strains: [] });
        list.push({ name: 'Straight-Arm Cable Pushdown', eq: 'cable', notes: 'Isolate lats without arm fatigue', strains: [] });
      }
      if (hasMachine) {
        list.push({ name: 'Chest-Supported Row Machine', eq: 'machine', notes: 'Safe row alternative for lower back health', strains: [] });
        list.push({ name: 'Lat Pulldown Machine', eq: 'machine', notes: 'Smooth guided pull for lat width', strains: [] });
      }
      if (hasBodyweight && !hasInjury('elbows')) {
        list.push({ name: 'Pull-Up', eq: 'body only', notes: 'Full range of motion, drive elbows down', strains: ['elbows'] });
        list.push({ name: 'Inverted Row', eq: 'body only', notes: 'Horizontal pull using bodyweight bar', strains: [] });
      }
    }

    if (muscle === 'Legs') {
      if (hasBarbell && !hasInjury('knees') && !hasInjury('lower back')) {
        list.push({ name: 'Barbell Back Squat', eq: 'barbell', notes: 'Sit back, keep chest up, brace core', strains: ['knees', 'lower back'] });
        list.push({ name: 'Barbell Romanian Deadlift', eq: 'barbell', notes: 'Feel deep stretch in hamstrings with soft knees', strains: ['lower back'] });
        list.push({ name: 'Barbell Front Squat', eq: 'barbell', notes: 'Upright torso quad emphasis', strains: ['knees', 'wrists'] });
      }
      if (hasDumbbell && !hasInjury('knees')) {
        list.push({ name: 'Dumbbell Goblet Squat', eq: 'dumbbell', notes: 'Hold close to chest, keep heels firmly down', strains: [] });
        list.push({ name: 'Dumbbell Romanian Deadlift', eq: 'dumbbell', notes: 'Hinge hips back, keep back flat', strains: [] });
        list.push({ name: 'Dumbbell Bulgarian Split Squat', eq: 'dumbbell', notes: 'Rear foot elevated for deep quad/glute work', strains: ['knees'] });
        list.push({ name: 'Dumbbell Walking Lunge', eq: 'dumbbell', notes: 'Step forward smoothly with tall posture', strains: ['knees'] });
      }
      if (hasMachine) {
        if (!hasInjury('knees')) {
          list.push({ name: 'Leg Press', eq: 'machine', notes: 'Adjust foot placement to protect knees', strains: ['knees'] });
          list.push({ name: 'Leg Extension', eq: 'machine', notes: 'Strict quad extension and top squeeze', strains: ['knees'] });
        }
        list.push({ name: 'Lying Leg Curl', eq: 'machine', notes: 'Squeeze hamstrings at top of motion', strains: [] });
        list.push({ name: 'Standing Calf Raise Machine', eq: 'machine', notes: 'Full calf stretch and heel drive', strains: [] });
      }
      if (hasBodyweight) {
        list.push({ name: 'Glute Bridge', eq: 'body only', notes: 'Drive through heels, squeeze glutes at top', strains: [] });
        if (!hasInjury('knees')) {
          list.push({ name: 'Bodyweight Squat', eq: 'body only', notes: 'Keep chest tall, push knees outward', strains: ['knees'] });
          list.push({ name: 'Bodyweight Lunges', eq: 'body only', notes: 'Alternating step forward lunges', strains: ['knees'] });
        }
        list.push({ name: 'Standing Bodyweight Calf Raise', eq: 'body only', notes: 'Slow tempo on stairs or flat floor', strains: [] });
      }
    }

    if (muscle === 'Shoulders') {
      if (hasBarbell && !hasInjury('shoulders') && !hasInjury('wrists')) {
        list.push({ name: 'Barbell Overhead Press', eq: 'barbell', notes: 'Strict vertical press, brace glutes and core', strains: ['shoulders', 'wrists'] });
        list.push({ name: 'Barbell Upright Row', eq: 'barbell', notes: 'Pull elbows high to side delts', strains: ['shoulders', 'wrists'] });
      }
      if (hasDumbbell) {
        list.push({ name: 'Dumbbell Lateral Raise', eq: 'dumbbell', notes: 'Raise to shoulder level with pinkies slightly up', strains: [] });
        if (!hasInjury('shoulders')) {
          list.push({ name: 'Dumbbell Shoulder Press', eq: 'dumbbell', notes: 'Press up smoothly with palms inward', strains: ['shoulders'] });
          list.push({ name: 'Arnold Press', eq: 'dumbbell', notes: 'Rotate wrists smoothly during overhead press', strains: ['shoulders'] });
        }
        list.push({ name: 'Dumbbell Rear Delt Fly', eq: 'dumbbell', notes: 'Hinge forward and flare elbows back', strains: [] });
      }
      if (hasCable) {
        list.push({ name: 'Cable Face Pull', eq: 'cable', notes: 'Pull rope to eye level, squeeze rear delts', strains: [] });
        list.push({ name: 'Cable Lateral Raise', eq: 'cable', notes: 'Continuous tension on side delts', strains: [] });
      }
      if (hasMachine) {
        list.push({ name: 'Shoulder Press Machine', eq: 'machine', notes: 'Fixed guided path offers maximum shoulder safety', strains: ['shoulders'] });
        list.push({ name: 'Reverse Pec Deck Machine', eq: 'machine', notes: 'Isolate rear deltoids safely', strains: [] });
      }
    }

    if (muscle === 'Arms') {
      if (hasBarbell && !hasInjury('wrists')) {
        list.push({ name: 'Barbell Bicep Curl', eq: 'barbell', notes: 'Do not swing hips, isolate biceps', strains: ['wrists'] });
        list.push({ name: 'EZ-Bar Skull Crusher', eq: 'barbell', notes: 'Lower bar towards forehead, extend triceps', strains: ['elbows', 'wrists'] });
      }
      if (hasDumbbell) {
        list.push({ name: 'Dumbbell Hammer Curl', eq: 'dumbbell', notes: 'Neutral grip is very safe on wrists and builds forearms', strains: [] });
        list.push({ name: 'Incline Dumbbell Bicep Curl', eq: 'dumbbell', notes: 'Stretch bicep at bottom with elbow back', strains: [] });
        list.push({ name: 'Dumbbell Overhead Tricep Extension', eq: 'dumbbell', notes: 'Keep elbows tucked overhead', strains: ['elbows'] });
        list.push({ name: 'Dumbbell Concentration Curl', eq: 'dumbbell', notes: 'Elbow resting against inner thigh for strict peak', strains: [] });
      }
      if (hasCable && !hasInjury('elbows')) {
        list.push({ name: 'Triceps Rope Pushdown', eq: 'cable', notes: 'Flare rope out at bottom contraction', strains: ['elbows'] });
        list.push({ name: 'Straight-Bar Cable Curl', eq: 'cable', notes: 'Constant cable tension on biceps', strains: [] });
        list.push({ name: 'Cable Overhead Tricep Extension', eq: 'cable', notes: 'Long head tricep stretch', strains: [] });
      }
      if (hasMachine) {
        list.push({ name: 'Preacher Curl Machine', eq: 'machine', notes: 'Locked arm angle prevents momentum', strains: [] });
        list.push({ name: 'Triceps Dip Machine', eq: 'machine', notes: 'Controlled pressing down for tricep burnout', strains: [] });
      }
      if (hasBands) {
        list.push({ name: 'Bicep Band Curl', eq: 'bands', notes: 'Keep constant tension throughout movement', strains: [] });
        list.push({ name: 'Band Tricep Pushdown', eq: 'bands', notes: 'High rep pump finisher', strains: [] });
      }
      if (hasBodyweight) {
        list.push({ name: 'Bench Dips', eq: 'body only', notes: 'Hands on bench, lower body with arms', strains: ['shoulders', 'elbows'] });
        list.push({ name: 'Diamond Push-Up', eq: 'body only', notes: 'Close hand placement for triceps', strains: ['wrists', 'elbows'] });
      }
    }

    if (muscle === 'Core') {
      list.push({ name: 'Plank', eq: 'body only', notes: 'Brace core tightly, body completely straight', strains: [] });
      list.push({ name: 'Abdominal Crunch', eq: 'body only', notes: 'Contract abs, do not pull behind neck', strains: [] });
      list.push({ name: 'Hanging Leg Raise', eq: 'body only', notes: 'Raise knees or legs to hip height', strains: [] });
      list.push({ name: 'Russian Twist', eq: 'body only', notes: 'Rotate torso side to side under control', strains: [] });
      if (hasCable) {
        list.push({ name: 'Cable Woodchopper', eq: 'cable', notes: 'Rotational core power and obliques', strains: [] });
      }
    }

    if (muscle === 'Glutes') {
      if (hasDumbbell) {
        list.push({ name: 'Dumbbell Hip Thrust', eq: 'dumbbell', notes: 'Drive hips up, pause and squeeze glutes', strains: [] });
      } else if (hasBarbell && !hasInjury('lower back')) {
        list.push({ name: 'Barbell Hip Thrust', eq: 'barbell', notes: 'Hold top squeeze for 1 second', strains: ['lower back'] });
      } else {
        list.push({ name: 'Bodyweight Hip Thrust', eq: 'body only', notes: 'High volume glute pump', strains: [] });
      }
      if (hasCable) {
        list.push({ name: 'Cable Glute Kickback', eq: 'cable', notes: 'Kick leg back under control', strains: [] });
      }
      if (hasMachine) {
        list.push({ name: 'Seated Hip Abduction Machine', eq: 'machine', notes: 'Push knees outward to hit upper glutes', strains: [] });
      }
    }

    if (list.length === 0) {
      list.push({ name: `${muscle} Motion`, eq: 'body only', notes: 'Standard form and control', strains: [] });
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
        muscleGroupsPerDay.push(['Back', 'Arms', 'Core']);
      } else {
        names.push(`Pass ${d}: Legs (Ben/Rumpa/Mage)`);
        muscleGroupsPerDay.push(['Legs', 'Glutes', 'Core']);
      }
    }
  } else {
    if (daysPerWeek === 1) {
      names.push('Helkropp Express');
      muscleGroupsPerDay.push(['Legs', 'Chest', 'Back', 'Shoulders', 'Core']);
    } else if (daysPerWeek === 2) {
      names.push('Pass A: Överkropp');
      muscleGroupsPerDay.push(['Chest', 'Back', 'Shoulders', 'Arms']);
      names.push('Pass B: Underkropp');
      muscleGroupsPerDay.push(['Legs', 'Glutes', 'Core']);
    } else if (daysPerWeek === 3) {
      names.push('Pass 1: Bröst, Rygg & Armar');
      muscleGroupsPerDay.push(['Chest', 'Back', 'Arms']);
      names.push('Pass 2: Ben & Rumpa');
      muscleGroupsPerDay.push(['Legs', 'Glutes', 'Core']);
      names.push('Pass 3: Axlar, Armar & Mage');
      muscleGroupsPerDay.push(['Shoulders', 'Arms', 'Core']);
    } else {
      for (let d = 1; d <= daysPerWeek; d++) {
        const idx = (d - 1) % 4;
        if (idx === 0) {
          names.push(`Pass ${d}: Bröst & Triceps`);
          muscleGroupsPerDay.push(['Chest', 'Arms', 'Shoulders']);
        } else if (idx === 1) {
          names.push(`Pass ${d}: Rygg & Biceps`);
          muscleGroupsPerDay.push(['Back', 'Arms', 'Core']);
        } else if (idx === 2) {
          names.push(`Pass ${d}: Ben & Glutes`);
          muscleGroupsPerDay.push(['Legs', 'Glutes', 'Core']);
        } else {
          names.push(`Pass ${d}: Axlar & Mage`);
          muscleGroupsPerDay.push(['Shoulders', 'Core', 'Arms']);
        }
      }
    }
  }

  for (let i = 0; i < daysPerWeek; i++) {
    const dayName = names[i] || `Pass ${i + 1}`;
    const muscles = muscleGroupsPerDay[i] || ['Legs', 'Chest', 'Back'];
    const exercisesList: any[] = [];
    const usedNames = new Set<string>();

    // Round-robin pull from each muscle pool until targetExerciseCount is reached
    let round = 0;
    while (exercisesList.length < targetExerciseCount && round < 6) {
      let addedInThisRound = 0;
      for (const muscle of muscles) {
        if (exercisesList.length >= targetExerciseCount) break;

        const pool = getExercisePool(muscle);
        const candidate = pool.find(ex => !usedNames.has(ex.name));
        if (candidate) {
          usedNames.add(candidate.name);
          exercisesList.push({
            exerciseName: candidate.name,
            targetMuscle: muscle,
            equipment: candidate.eq,
            sets: sets,
            reps: reps,
            restSeconds: rest,
            notes: candidate.notes
          });
          addedInThisRound++;
        }
      }
      if (addedInThisRound === 0) {
        // If pools are exhausted, fill from Core or secondary muscles
        const fallbackPool = getExercisePool('Core');
        const fallbackCandidate = fallbackPool.find(ex => !usedNames.has(ex.name));
        if (fallbackCandidate) {
          usedNames.add(fallbackCandidate.name);
          exercisesList.push({
            exerciseName: fallbackCandidate.name,
            targetMuscle: 'Core',
            equipment: fallbackCandidate.eq,
            sets: sets,
            reps: reps,
            restSeconds: rest,
            notes: fallbackCandidate.notes
          });
        } else {
          break;
        }
      }
      round++;
    }

    workouts.push({
      dayName: dayName,
      targetFocus: muscles.join(', '),
      estimatedDurationMinutes: durNum,
      exercises: exercisesList
    });
  }

  return {
    programName: `AI-Program: ${fitnessGoal.split(' ')[0]} (${splitType.split(' ')[0]})`,
    description: `Ett skräddarsytt ${daysPerWeek}-dagars program optimerat för ${goalDesc} (~${durNum} min/pass). Anpassat för ${location} och din tillgängliga utrustning.`,
    daysPerWeek: daysPerWeek,
    workouts: workouts
  };
}


