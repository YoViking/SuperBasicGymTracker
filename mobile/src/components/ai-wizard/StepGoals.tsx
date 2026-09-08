import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { GOAL_OPTIONS } from './wizardConstants';
import { wizardStyles } from './wizardStyles';

interface StepGoalsProps {
  fitnessGoal: string;
  onSelectGoal: (goalId: string) => void;
}

export default function StepGoals({ fitnessGoal, onSelectGoal }: StepGoalsProps) {
  return (
    <View style={wizardStyles.stepContainer}>
      <Text style={wizardStyles.stepTitle}>Vad är ditt huvudsakliga träningsmål?</Text>

      <View style={wizardStyles.goalsContainer}>
        {GOAL_OPTIONS.map((goal) => {
          const isActive = fitnessGoal === goal.id;
          return (
            <TouchableOpacity
              key={goal.id}
              style={[wizardStyles.goalCard, isActive && wizardStyles.activeGoalCard]}
              onPress={() => onSelectGoal(goal.id)}
              activeOpacity={0.8}
            >
              <View style={wizardStyles.goalInfo}>
                <Text
                  style={[
                    wizardStyles.goalLabel,
                    isActive && wizardStyles.activeGoalLabel,
                  ]}
                >
                  {goal.label}
                </Text>
                <Text style={wizardStyles.goalDesc}>{goal.desc}</Text>
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
