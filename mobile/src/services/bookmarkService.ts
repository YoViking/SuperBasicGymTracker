import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const getStorageKey = (userId?: string) => (userId ? `@user_bookmarks_${userId}` : '@user_bookmarks');

// In-memory cache for ultra-fast checks and immediate UI response
let memoryBookmarks: Set<string> | null = null;
let currentLoadedUserId: string | null = null;

const listeners = new Set<(bookmarks: string[]) => void>();

export function subscribeToBookmarks(listener: (bookmarks: string[]) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(bookmarks: string[]) {
  listeners.forEach((listener) => listener(bookmarks));
}

/**
 * Fetches all bookmarked exercise IDs for the current user.
 */
export async function getBookmarkedExerciseIds(): Promise<string[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id || 'anonymous';

    // If already in memory for this user, return immediately
    if (memoryBookmarks && currentLoadedUserId === userId) {
      return Array.from(memoryBookmarks);
    }

    const storageKey = getStorageKey(user?.id);
    let bookmarkedIds: string[] = [];

    // 1. Try local cache first for instant load
    const cached = await AsyncStorage.getItem(storageKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          bookmarkedIds = parsed;
        }
      } catch {}
    }

    // 2. Try Supabase user metadata
    if (user?.user_metadata?.bookmarked_exercise_ids && Array.isArray(user.user_metadata.bookmarked_exercise_ids)) {
      bookmarkedIds = user.user_metadata.bookmarked_exercise_ids;
      await AsyncStorage.setItem(storageKey, JSON.stringify(bookmarkedIds));
    } else if (user?.id) {
      // 3. Try bookmarks table in Supabase if exists
      try {
        const { data: tableData, error: tableErr } = await supabase
          .from('bookmarks')
          .select('exercise_id')
          .eq('user_id', user.id);

        if (!tableErr && tableData && tableData.length > 0) {
          bookmarkedIds = Array.from(new Set([...bookmarkedIds, ...tableData.map((b: any) => b.exercise_id)]));
          await AsyncStorage.setItem(storageKey, JSON.stringify(bookmarkedIds));
        }
      } catch {}
    }

    memoryBookmarks = new Set(bookmarkedIds);
    currentLoadedUserId = userId;
    return bookmarkedIds;
  } catch (error) {
    console.error('[BookmarkService] Error fetching bookmarks:', error);
    return memoryBookmarks ? Array.from(memoryBookmarks) : [];
  }
}

/**
 * Checks if a specific exercise is bookmarked.
 */
export async function isExerciseBookmarked(exerciseId: string): Promise<boolean> {
  if (!exerciseId) return false;
  const bookmarks = await getBookmarkedExerciseIds();
  return bookmarks.includes(exerciseId);
}

/**
 * Toggles bookmark status for an exercise.
 * Returns the new bookmarked state (true = bookmarked, false = unbookmarked).
 */
export async function toggleExerciseBookmark(exerciseId: string): Promise<boolean> {
  if (!exerciseId) return false;

  try {
    const currentBookmarks = await getBookmarkedExerciseIds();
    const isCurrentlyBookmarked = currentBookmarks.includes(exerciseId);
    let updatedBookmarks: string[];

    if (isCurrentlyBookmarked) {
      updatedBookmarks = currentBookmarks.filter((id) => id !== exerciseId);
    } else {
      updatedBookmarks = [...currentBookmarks, exerciseId];
    }

    // Update in-memory cache immediately
    memoryBookmarks = new Set(updatedBookmarks);
    notifyListeners(updatedBookmarks);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const storageKey = getStorageKey(user?.id);
    await AsyncStorage.setItem(storageKey, JSON.stringify(updatedBookmarks));

    if (user?.id) {
      // Sync to Supabase user metadata
      await supabase.auth.updateUser({
        data: { bookmarked_exercise_ids: updatedBookmarks },
      });

      // Also sync to bookmarks table if available
      try {
        if (isCurrentlyBookmarked) {
          await supabase
            .from('bookmarks')
            .delete()
            .eq('user_id', user.id)
            .eq('exercise_id', exerciseId);
        } else {
          await supabase
            .from('bookmarks')
            .insert([{ user_id: user.id, exercise_id: exerciseId }]);
        }
      } catch {}
    }

    return !isCurrentlyBookmarked;
  } catch (error) {
    console.error('[BookmarkService] Error toggling bookmark:', error);
    return false;
  }
}
