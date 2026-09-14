import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const CHUNK_SIZE = 1800; // Under the 2048 byte limit for iOS Keychain items

/**
 * Encrypted and chunked SecureStore adapter for Supabase Auth.
 * Includes fallback to AsyncStorage on Web and automatic migration
 * of legacy plain-text sessions.
 */
const SecureStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }

    try {
      // 1. Check if item was stored in chunks
      const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunk_count`);
      if (chunkCountStr) {
        const count = parseInt(chunkCountStr, 10);
        if (!isNaN(count) && count > 0) {
          const chunkPromises: Promise<string | null>[] = [];
          for (let i = 0; i < count; i++) {
            chunkPromises.push(SecureStore.getItemAsync(`${key}_chunk_${i}`));
          }
          const chunks = await Promise.all(chunkPromises);
          if (chunks.every(c => c !== null)) {
            return chunks.join('');
          }
        }
      }

      // 2. Read single-entry value
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue !== null) {
        return secureValue;
      }

      // 3. Fallback & migration from legacy AsyncStorage
      const legacyValue = await AsyncStorage.getItem(key);
      if (legacyValue !== null) {
        // Migrate legacy session to SecureStore asynchronously
        await this.setItem(key, legacyValue);
        await AsyncStorage.removeItem(key);
        return legacyValue;
      }

      return null;
    } catch (error) {
      console.warn('[Supabase Storage] Error reading from SecureStore, falling back to AsyncStorage:', error);
      return AsyncStorage.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      return AsyncStorage.setItem(key, value);
    }

    try {
      if (value.length > CHUNK_SIZE) {
        // Multi-chunk storage for large sessions on iOS
        const chunks = Math.ceil(value.length / CHUNK_SIZE);
        await SecureStore.setItemAsync(`${key}_chunk_count`, chunks.toString());
        for (let i = 0; i < chunks; i++) {
          const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
        }
        // Remove single-entry value if previously saved
        await SecureStore.deleteItemAsync(key).catch(() => {});
      } else {
        // Single item storage
        await SecureStore.setItemAsync(key, value);
        // Clean up any old chunks if previously chunked
        const oldChunkCount = await SecureStore.getItemAsync(`${key}_chunk_count`).catch(() => null);
        if (oldChunkCount) {
          const count = parseInt(oldChunkCount, 10);
          for (let i = 0; i < count; i++) {
            await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
          }
          await SecureStore.deleteItemAsync(`${key}_chunk_count`).catch(() => {});
        }
      }
    } catch (error) {
      console.warn('[Supabase Storage] Error writing to SecureStore, falling back to AsyncStorage:', error);
      await AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      return AsyncStorage.removeItem(key);
    }

    try {
      const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunk_count`).catch(() => null);
      if (chunkCountStr) {
        const count = parseInt(chunkCountStr, 10);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
        }
        await SecureStore.deleteItemAsync(`${key}_chunk_count`).catch(() => {});
      }
      await SecureStore.deleteItemAsync(key).catch(() => {});
    } catch (error) {
      console.warn('[Supabase Storage] Error deleting from SecureStore:', error);
    } finally {
      // Ensure any legacy AsyncStorage copy is also removed
      await AsyncStorage.removeItem(key).catch(() => {});
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

