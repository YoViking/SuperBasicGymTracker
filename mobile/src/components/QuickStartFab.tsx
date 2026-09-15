import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  View,
} from 'react-native';
import { Play } from 'lucide-react-native';

interface QuickStartFabProps {
  onPress: () => void;
  translateY?: Animated.Value;
  visible?: boolean;
}

const BUTTON_SIZE = 94;
const CENTER = BUTTON_SIZE / 2; // 47
const TEXT_RADIUS = 34.5; // Perfectly centered between inner circle (r=22) and outer border (r=47)

// Optically balanced kerning angles:
// 'GET': 3 letters centered at top arc with balanced spacing and curvature
const GET_ANGLES = [-20, 0, 20];

// 'STRONG': 6 letters with wider spacing (17° step) along bottom arc for better breathing room
const STRONG_ANGLES = [-42.5, -25.5, -8.5, 8.5, 25.5, 42.5];

interface CurvedTextProps {
  text: string;
  radius: number;
  center: number;
  direction: 'top' | 'bottom';
  angles?: number[];
  letterSpacingDeg?: number;
}

function CurvedText({
  text,
  radius,
  center,
  direction,
  angles,
  letterSpacingDeg = 14,
}: CurvedTextProps) {
  const characters = text.split('');
  const mid = (characters.length - 1) / 2;
  const charWidth = 14;
  const charHeight = 16;

  return (
    <>
      {characters.map((char, index) => {
        const angleDeg = angles ? angles[index] : (index - mid) * letterSpacingDeg;
        const angleRad = (angleDeg * Math.PI) / 180;

        const x = center + radius * Math.sin(angleRad);
        let y: number;
        let rotation: number;

        if (direction === 'top') {
          y = center - radius * Math.cos(angleRad);
          rotation = angleDeg;
        } else {
          y = center + radius * Math.cos(angleRad);
          rotation = -angleDeg;
        }

        return (
          <View
            key={index}
            style={[
              styles.charContainer,
              {
                left: x - charWidth / 2,
                top: y - charHeight / 2,
                width: charWidth,
                height: charHeight,
                transform: [{ rotate: `${rotation}deg` }],
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.charText}>{char}</Text>
          </View>
        );
      })}
    </>
  );
}

export default function QuickStartFab({
  onPress,
  translateY,
  visible = true,
}: QuickStartFabProps) {
  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        translateY && {
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.fabButton}
        activeOpacity={0.85}
        onPress={onPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {/* GET: Optically balanced kerning around top arc */}
        <CurvedText
          text="GET"
          radius={TEXT_RADIUS}
          center={CENTER}
          direction="top"
          angles={GET_ANGLES}
        />

        {/* Center Circle with Larger Play Icon */}
        <View style={styles.centerCircle}>
          <Play
            size={26}
            color="#0A0A0A"
            fill="#0A0A0A"
            style={styles.playIcon}
          />
        </View>

        {/* STRONG: Optically balanced kerning around bottom arc */}
        <CurvedText
          text="STRONG"
          radius={TEXT_RADIUS}
          center={CENTER}
          direction="bottom"
          angles={STRONG_ANGLES}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    zIndex: 90,
    elevation: 8,
  },
  fabButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#A3E635', // Lime / neon green matching app design
    alignItems: 'center',
    justifyContent: 'center',
    // Modern deep shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  charContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  charText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#0A0A0A',
    textAlign: 'center',
    includeFontPadding: false,
  },
  centerCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  playIcon: {
    marginLeft: 3.5, // Optical center alignment for play triangle
  },
});

