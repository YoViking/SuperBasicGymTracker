import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { INJURY_OPTIONS, INJURY_LABELS } from './wizardConstants';
import { wizardStyles } from './wizardStyles';

interface StepInjuriesProps {
  selectedInjuries: string[];
  onToggleInjury: (injury: string) => void;
  exclusions: string;
  onChangeExclusions: (text: string) => void;
}

export default function StepInjuries({
  selectedInjuries,
  onToggleInjury,
  exclusions,
  onChangeExclusions,
}: StepInjuriesProps) {
  return (
    <View style={wizardStyles.stepContainer}>
      <Text style={wizardStyles.stepTitle}>Har du några skador eller övningar du vill undvika?</Text>

      {/* Sensitive body parts multi-select */}
      <Text style={wizardStyles.sectionLabel}>Känsliga områden / Leder</Text>
      <View style={wizardStyles.injuriesContainer}>
        {INJURY_OPTIONS.map((injury) => {
          const isSelected = selectedInjuries.includes(injury);
          const label = INJURY_LABELS[injury] || injury;
          return (
            <TouchableOpacity
              key={injury}
              style={[wizardStyles.injuryChip, isSelected && wizardStyles.activeInjuryChip]}
              onPress={() => onToggleInjury(injury)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  wizardStyles.injuryText,
                  isSelected && wizardStyles.activeInjuryText,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Optional exclusions free-text */}
      <Text style={wizardStyles.sectionLabel}>
        Övriga skador eller övningar att undvika (frivilligt)
      </Text>
      <View style={wizardStyles.textAreaContainer}>
        <TextInput
          style={wizardStyles.textArea}
          multiline
          numberOfLines={4}
          placeholder="T.ex: 'Inga bänkpress med skivstång pga axelsmärta, eller undvik knäböj pga meniskskada.'"
          placeholderTextColor="#64748B"
          value={exclusions}
          onChangeText={onChangeExclusions}
          selectionColor="#A3E635"
        />
      </View>
    </View>
  );
}
