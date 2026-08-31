import { Platform } from 'react-native';

/**
 * Calculates responsive bottom navigation height and bottom padding
 * based on device safe area insets (e.g. Android 3-button navigation,
 * gesture navigation bars, iOS Home indicators, or devices without bottom insets).
 */
export function getBottomNavLayout(insetsBottom: number) {
  const isIos = Platform.OS === 'ios';
  const fallbackBottom = isIos ? 28 : 14;
  const bottomPadding = insetsBottom > 0 ? insetsBottom : fallbackBottom;
  const baseHeight = isIos ? 62 : 60;
  const height = baseHeight + bottomPadding;

  return {
    height,
    bottomPadding,
  };
}
