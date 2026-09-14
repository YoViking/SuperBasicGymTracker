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
 * Relies on local cache and the relational 'bookmarks' table.
 * Avoids storing arrays in auth user_metadata to prevent JWT Token Bloat (HTTP 431).
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

    // 2. Sync with database 'bookmarks' table for logged-in users
    if (user?.id) {
      try {
        const { data: tableData, error: tableErr } = await supabase
          .from('bookmarks')
          .select('exercise_id')
          .eq('user_id', user.id);

        if (!tableErr && tableData) {
          const dbIds = tableData.map((b: any) => b.exercise_id);
          bookmarkedIds = Array.from(new Set([...bookmarkedIds, ...dbIds]));
          await AsyncStorage.setItem(storageKey, JSON.stringify(bookmarkedIds));
        }

        // 3. One-time migration & cleanup of legacy user_metadata if present
        const legacyMetadataIds = user?.user_metadata?.bookmarked_exercise_ids;
        if (Array.isArray(legacyMetadataIds) && legacyMetadataIds.length > 0) {
          // If table was empty, backfill from legacy metadata
          if (!tableData || tableData.length === 0) {
            const toInsert = legacyMetadataIds.map((exId: string) => ({
              user_id: user.id,
              exercise_id: exId,
            }));
            await supabase.from('bookmarks').insert(toInsert);
            bookmarkedIds = Array.from(new Set([...bookmarkedIds, ...legacyMetadataIds]));
            await AsyncStorage.setItem(storageKey, JSON.stringify(bookmarkedIds));
          }

          // Clear bloated array from JWT user_metadata to keep tokens lightweight
          await supabase.auth.updateUser({
            data: { bookmarked_exercise_ids: null },
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('[BookmarkService] Error syncing bookmarks from database:', err);
      }
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
 * Persists to local AsyncStorage and the Supabase 'bookmarks' table.
 * Does NOT write large arrays to auth user_metadata, protecting JWT headers.
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

    // 1. Update in-memory cache and notify UI immediately (0ms response)
    memoryBookmarks = new Set(updatedBookmarks);
    notifyListeners(updatedBookmarks);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 2. Persist to local storage
    const storageKey = getStorageKey(user?.id);
    await AsyncStorage.setItem(storageKey, JSON.stringify(updatedBookmarks));

    // 3. Persist to relational 'bookmarks' table in Supabase
    if (user?.id) {
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
      } catch (dbErr) {
        console.error('[BookmarkService] Database error toggling bookmark:', dbErr);
      }
    }

    return !isCurrentlyBookmarked;
  } catch (error) {
    console.error('[BookmarkService] Error toggling bookmark:', error);
    return false;
  }
}

