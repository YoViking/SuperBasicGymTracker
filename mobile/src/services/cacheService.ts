import AsyncStorage from '@react-native-async-storage/async-storage';

export type CacheCategory =
  | 'home'
  | 'workouts'
  | 'weekly_stats'
  | 'monthly_stats'
  | 'yearly_stats'
  | 'exercise_stats'
  | 'user_profile'
  | 'all';

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

// In-memory memory map for 0ms synchronous read
const memoryCache = new Map<string, CacheItem<any>>();

// Set of invalidated cache keys
const invalidatedKeys = new Set<string>();

// Listeners for cache invalidation events
const listeners = new Set<(category: CacheCategory) => void>();

const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds

export const cacheService = {
  /**
   * Get cached data synchronously from memory, or null if expired / not loaded
   */
  get<T>(key: string, userId: string, ttlMs: number = DEFAULT_TTL_MS): T | null {
    const fullKey = `${userId}:${key}`;
    if (invalidatedKeys.has(fullKey) || invalidatedKeys.has(`${userId}:all`)) {
      return null;
    }

    const item = memoryCache.get(fullKey);
    if (!item) return null;

    const isExpired = Date.now() - item.timestamp > ttlMs;
    if (isExpired) return null;

    return item.data as T;
  },

  /**
   * Get cached data asynchronously (reads AsyncStorage if not in memory yet)
   */
  async getAsync<T>(key: string, userId: string, ttlMs: number = DEFAULT_TTL_MS): Promise<T | null> {
    const fullKey = `${userId}:${key}`;
    if (invalidatedKeys.has(fullKey) || invalidatedKeys.has(`${userId}:all`)) {
      return null;
    }

    // 1. Try memory cache
    const memItem = memoryCache.get(fullKey);
    if (memItem) {
      if (Date.now() - memItem.timestamp <= ttlMs) {
        return memItem.data as T;
      }
    }

    // 2. Try AsyncStorage
    try {
      const storageKey = `@app_cache_${fullKey}`;
      const json = await AsyncStorage.getItem(storageKey);
      if (!json) return null;

      const parsed: CacheItem<T> = JSON.parse(json);
      if (Date.now() - parsed.timestamp <= ttlMs) {
        memoryCache.set(fullKey, parsed);
        return parsed.data;
      }
    } catch {
      return null;
    }

    return null;
  },

  /**
   * Save data into memory cache and AsyncStorage
   */
  async set<T>(key: string, userId: string, data: T): Promise<void> {
    const fullKey = `${userId}:${key}`;
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
    };

    memoryCache.set(fullKey, item);
    invalidatedKeys.delete(fullKey);
    invalidatedKeys.delete(`${userId}:all`);

    try {
      const storageKey = `@app_cache_${fullKey}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(item));
    } catch (e) {
      console.warn('[CacheService] Failed to write to AsyncStorage', e);
    }
  },

  /**
   * Invalidate specific cache category or 'all' to force fresh network fetch
   */
  invalidate(category: CacheCategory, userId?: string): void {
    if (userId) {
      invalidatedKeys.add(`${userId}:${category}`);
    } else {
      // Invalidate for all user contexts
      for (const key of memoryCache.keys()) {
        if (category === 'all' || key.endsWith(`:${category}`)) {
          invalidatedKeys.add(key);
        }
      }
    }

    // Notify active listeners
    listeners.forEach((listener) => {
      try {
        listener(category);
      } catch (err) {
        console.error('[CacheService] Listener error', err);
      }
    });
  },

  /**
   * Subscribe to cache invalidations to automatically re-fetch when appropriate
   */
  subscribe(listener: (category: CacheCategory) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    memoryCache.clear();
    invalidatedKeys.clear();
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((k) => k.startsWith('@app_cache_'));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (e) {
      console.warn('[CacheService] Failed to clear AsyncStorage cache', e);
    }
  },
};
