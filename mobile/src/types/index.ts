export interface Workout {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  completed_at?: string; // Optional if not yet completed
  is_archived?: boolean;
  is_deleted?: boolean;
  folder_id?: string | null;
  is_ai?: boolean;
  image_url?: string;
  workout_exercises?: Array<{
    order_index?: number;
    created_at?: string;
    exercise?: {
      gifUrl?: string;
      muscle_group?: string;
    } | null;
  }>;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  image_url?: string;
  is_ai?: boolean;
  created_at: string;
}

// Represents an exercise in a user's workout
export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  sets: number;
  reps: number;
  weight: number;
  isDone: boolean; // mapped from is_done
  custom_name?: string;
  notes?: string;
  created_at?: string;
  order_index?: number;
}

export interface ExerciseLibrary {
  id: string;
  name: string;
  muscle_group?: string;
  link?: string;
  gifUrl?: string;
  completions_count?: number;
  equipment?: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  exercise_id: string;
  created_at: string;
}

export interface WorkoutLog {
  id: string;
  workout_id: string;
  user_id: string;
  workout_name: string;
  duration_seconds: number;
  total_volume: number;
  created_at: string;
}

