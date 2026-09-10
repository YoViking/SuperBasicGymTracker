import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { EXPERIENCE_LEVELS } from './wizardConstants';
import { wizardStyles } from './wizardStyles';

interface StepLevelProps {
  experienceLevel: string;
  onSelectLevel: (levelId: string) => void;
}

export default function StepLevel({ experienceLevel, onSelectLevel }: StepLevelProps) {
  return (
    <View style={wizardStyles.stepContainer}>
      <Text style={wizardStyles.stepTitle}>Vilken erfarenhetsnivå har du?</Text>

      <View style={wizardStyles.goalsContainer}>
        {EXPERIENCE_LEVELS.map((level) => {
          const isActive = experienceLevel === level.id;
          return (
            <TouchableOpacity
              key={level.id}
              style={[wizardStyles.goalCard, isActive && wizardStyles.activeGoalCard]}
              onPress={() => onSelectLevel(level.id)}
              activeOpacity={0.8}
            >
              <View style={wizardStyles.goalInfo}>
                <View style={localStyles.titleBadgeRow}>
                  <Text
                    style={[
                      wizardStyles.goalLabel,
                      isActive && wizardStyles.activeGoalLabel,
                    ]}
                  >
                    {level.label}
                  </Text>
                  {level.badge ? (
                    <View
                      style={[
                        localStyles.badgeContainer,
                        isActive && localStyles.badgeContainerActive,
                      ]}
                    >
                      <Text
                        style={[
                          localStyles.badgeText,
                          isActive && localStyles.badgeTextActive,
                        ]}
                      >
                        {level.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={wizardStyles.goalDesc}>{level.desc}</Text>
              </View>
              <View
                style={[
                  wizardStyles.goalIndicator,
                  isActive && wizardStyles.activeGoalIndicator,
                ]}
              >
                {isActive && <View style={wizardStyles.goalIndicatorInner} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  badgeContainer: {
    backgroundColor: '#27272A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeContainerActive: {
    backgroundColor: 'rgba(163, 230, 53, 0.2)',
  },
  badgeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeTextActive: {
    color: '#A3E635',
  },
});
