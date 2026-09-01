import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OnboardingProfile {
  fitnessGoal: string;
  location: string;
  daysPerWeek: number;
  duration?: string;
  equipment: string[];
  completedAt?: string;
}

const ONBOARDING_COMPLETED_KEY_PREFIX = '@superbasic_onboarding_completed_';
const ONBOARDING_PROFILE_KEY_PREFIX = '@superbasic_onboarding_profile_';

export const onboardingService = {
  /**
   * Check if a specific user has completed onboarding.
   */
  async getHasCompletedOnboarding(userId: string): Promise<boolean> {
    if (!userId) return false;
    try {
      const value = await AsyncStorage.getItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`);
      return value === 'true';
    } catch (error) {
      console.error('Error reading onboarding status:', error);
      return false;
    }
  },

  /**
   * Set the onboarding completion status for a user.
   */
  async setHasCompletedOnboarding(userId: string, completed: boolean): Promise<void> {
    if (!userId) return;
    try {
      await AsyncStorage.setItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`, completed ? 'true' : 'false');
    } catch (error) {
      console.error('Error setting onboarding status:', error);
    }
  },

  /**
   * Save user onboarding preferences profile.
   */
  async saveOnboardingProfile(userId: string, profile: OnboardingProfile): Promise<void> {
    if (!userId) return;
    try {
      const dataToSave = {
        ...profile,
        completedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(`${ONBOARDING_PROFILE_KEY_PREFIX}${userId}`, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Error saving onboarding profile:', error);
    }
  },

  /**
   * Retrieve the saved onboarding preferences profile.
   */
  async getOnboardingProfile(userId: string): Promise<OnboardingProfile | null> {
    if (!userId) return null;
    try {
      const data = await AsyncStorage.getItem(`${ONBOARDING_PROFILE_KEY_PREFIX}${userId}`);
      if (!data) return null;
      return JSON.parse(data) as OnboardingProfile;
    } catch (error) {
      console.error('Error reading onboarding profile:', error);
      return null;
    }
  },

  /**
   * Reset onboarding for testing or when user wants to redo it.
   */
  async resetOnboarding(userId: string): Promise<void> {
    if (!userId) return;
    try {
      await AsyncStorage.removeItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`);
    } catch (error) {
      console.error('Error resetting onboarding status:', error);
    }
  }
};
