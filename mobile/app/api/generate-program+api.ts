export async function POST(request: Request) {
  let requestBody: any = {};
  try {
    requestBody = await request.json();
  } catch (e) {
    console.warn('Failed to parse request body:', e);
  }

  const {
    location = 'Gym',
    equipment = [],
    daysPerWeek = 3,
    duration = '60m',
    splitType = 'Auto/AI Recommendation',
    injuries = [],
    exclusions = '',
    fitnessGoal = 'Muscle Growth (Hypertrophy)'
  } = requestBody;

  try {
    const apiKey = process.env.OPENCODE_API_KEY;

    // Determine target model (deepseek-v4-flash-free as default free model on OpenCode)
    const modelName = process.env.OPENCODE_MODEL || 'deepseek-v4-flash-free';

    if (!apiKey || apiKey === 'your_opencode_api_key_here') {
      console.log('No OpenCode API key found. Using mock generator fallback.');
      const mockProgram = generateMockProgram(location, equipment, daysPerWeek, duration, splitType, injuries, exclusions, fitnessGoal);
      return Response.json(mockProgram);
    }

    // System prompt for the expert coach
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

    console.log(`Calling OpenCode Zen API with model ${modelName}...`);

    const apiResponse = await fetch('https://opencode.ai/zen/v1/chat/completions', {
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

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.warn(`OpenCode Zen API returned error status ${apiResponse.status}: ${errText}. Falling back to mock generator.`);
      const mockProgram = generateMockProgram(location, equipment, daysPerWeek, duration, splitType, injuries, exclusions, fitnessGoal);
      return Response.json(mockProgram);
    }

    const apiData = await apiResponse.json();
    const content = apiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content returned from OpenCode Zen API');
    }

    // Extract and parse returned JSON robustly
    let cleanJson;
    try {
      let cleanText = content.trim();
      // Remove markdown code fences if present
      if (cleanText.startsWith('```')) {
        const firstNewline = cleanText.indexOf('\n');
        const lastBackticks = cleanText.lastIndexOf('```');
        if (firstNewline !== -1 && lastBackticks !== -1 && lastBackticks > firstNewline) {
          cleanText = cleanText.substring(firstNewline + 1, lastBackticks).trim();
        }
      }
      cleanJson = JSON.parse(cleanText);
    } catch (e) {
      console.warn('Failed to parse content as JSON, content was:', content);
      throw new Error('AI returned invalid JSON formatting');
    }

    // 1. Lift top-level "program" object if AI nested the response
    if (cleanJson.program && typeof cleanJson.program === 'object' && !Array.isArray(cleanJson.program)) {
      cleanJson = {
        ...cleanJson.program,
        ...cleanJson
      };
    }

    // 2. Map "days" to "workouts" if name mismatch
    if (!cleanJson.workouts && cleanJson.days && Array.isArray(cleanJson.days)) {
      cleanJson.workouts = cleanJson.days;
    }

    // 3. Ensure workouts array exists
    if (!cleanJson.workouts || !Array.isArray(cleanJson.workouts)) {
      throw new Error('AI response missing workouts array');
    }

    // 4. Sanitize workouts and exercises to enforce schema conformance
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

    return Response.json(cleanJson);

  } catch (error: any) {
    console.error('Error in API Route:', error);
    try {
      const mockProgram = generateMockProgram(location, equipment, daysPerWeek, duration, splitType, injuries, exclusions, fitnessGoal);
      return Response.json(mockProgram);
    } catch (fallbackError) {
      return new Response(JSON.stringify({ error: 'Failed to generate program' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

// -------------------------------------------------------------
// High-Fidelity Local Mock Program Generator
// Used as a fallback when API keys are not supplied or requests fail.
// -------------------------------------------------------------
function generateMockProgram(
  location: string,
  equipment: string[],
  daysPerWeek: number,
  duration: string,
  splitType: string,
  injuries: string[],
  exclusions: string,
  fitnessGoal: string
): any {
  // Normalize equipment list
  const hasBarbell = equipment.includes('Barbell') || equipment.length === 0;
  const hasDumbbell = equipment.includes('Dumbbell') || equipment.length === 0;
  const hasCable = equipment.includes('Cable') || equipment.length === 0;
  const hasMachine = equipment.includes('Machine') || equipment.length === 0;
  const hasKettlebell = equipment.includes('Kettlebell') || equipment.length === 0;
  const hasBands = equipment.includes('Resistance Bands') || equipment.length === 0;
  const hasBodyweight = equipment.includes('Bodyweight') || equipment.length === 0 || equipment.length === 0;

  const hasInjury = (part: string) => injuries.map(i => i.toLowerCase()).includes(part.toLowerCase());

  // Determine sets/reps based on goal
  let sets = 3;
  let reps = '8-12';
  let rest = 90;
  let goalDesc = 'hypertrophy';

  if (fitnessGoal.includes('Strength')) {
    sets = 4;
    reps = '5';
    rest = 120;
    goalDesc = 'maximal strength';
  } else if (fitnessGoal.includes('Endurance')) {
    sets = 3;
    reps = '15-20';
    rest = 60;
    goalDesc = 'muscular endurance';
  } else if (fitnessGoal.includes('General')) {
    sets = 3;
    reps = '10-12';
    rest = 75;
    goalDesc = 'general fitness';
  }

  // Create exercises pool by muscle group, filtering out based on injuries and equipment
  const getExercisePool = (muscle: string): Array<{ name: string; eq: string; notes: string }> => {
    const list: Array<{ name: string; eq: string; notes: string; strains: string[] }> = [];

    // Chest
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

    // Back
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

    // Legs
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

    // Shoulders
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

    // Arms
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

    // Core
    if (muscle === 'Core') {
      list.push({ name: 'Plank', eq: 'body only', notes: 'Keep core tight, body level', strains: [] });
      list.push({ name: 'Abdominal Crunch', eq: 'body only', notes: 'Contract abs, do not pull neck', strains: [] });
    }

    // Glutes
    if (muscle === 'Glutes') {
      if (hasDumbbell) {
        list.push({ name: 'Dumbbell Hip Thrust', eq: 'dumbbell', notes: 'Drive hips up, squeeze glutes', strains: [] });
      } else if (hasBarbell && !hasInjury('lower back')) {
        list.push({ name: 'Barbell Hip Thrust', eq: 'barbell', notes: 'Hold at top for 1s', strains: ['lower back'] });
      } else {
        list.push({ name: 'Bodyweight Hip Thrust', eq: 'body only', notes: 'High volume squeeze', strains: [] });
      }
    }

    // Fallbacks
    if (list.length === 0) {
      list.push({ name: `${muscle} Exercise`, eq: 'body only', notes: 'Do standard movement', strains: [] });
    }

    // Filter list based on injuries
    return list.filter(ex => {
      const strainsInjury = ex.strains?.some(str => hasInjury(str));
      return !strainsInjury;
    });
  };

  // Compile workouts
  const workouts: any[] = [];
  
  // Decide workout names based on daysPerWeek and splitType
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
    // Default / Split / Auto recommendation
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

  // Build the program
  for (let i = 0; i < daysPerWeek; i++) {
    const dayName = names[i] || `Day ${i + 1}`;
    const muscles = muscleGroupsPerDay[i] || ['Legs', 'Chest', 'Back'];
    const exercisesList: any[] = [];

    // Select exercises
    for (const muscle of muscles) {
      const pool = getExercisePool(muscle);
      if (pool.length > 0) {
        // Pick up to 2 exercises per muscle group to build a balanced day
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
      exercises: exercisesList.slice(0, 6) // limit to 6 exercises max per day
    });
  }

  return {
    programName: `AI-Program: ${fitnessGoal.split(' ')[0]} (${splitType.split(' ')[0]})`,
    description: `A custom generated ${daysPerWeek}-day program optimized for ${goalDesc}. Adapted for ${location} workouts with your equipment. Safe on ${injuries.join(', ') || 'all joints'}.`,
    daysPerWeek: daysPerWeek,
    workouts: workouts
  };
}
