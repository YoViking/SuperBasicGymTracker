import { useState, useEffect, useCallback } from 'react';
import {
  getBookmarkedExerciseIds,
  toggleExerciseBookmark,
  subscribeToBookmarks,
} from '../services/bookmarkService';

export function useBookmarks() {
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getBookmarkedExerciseIds().then((ids) => {
      if (isMounted) {
        setBookmarkedIds(ids);
        setLoading(false);
      }
    });

    const unsubscribe = subscribeToBookmarks((ids) => {
      if (isMounted) {
        setBookmarkedIds(ids);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const toggleBookmark = useCallback(async (exerciseId: string) => {
    const isBookmarked = await toggleExerciseBookmark(exerciseId);
    return isBookmarked;
  }, []);

  const isBookmarked = useCallback(
    (exerciseId: string) => {
      return bookmarkedIds.includes(exerciseId);
    },
    [bookmarkedIds]
  );

  return {
    bookmarkedIds,
    loading,
    toggleBookmark,
    isBookmarked,
  };
}
