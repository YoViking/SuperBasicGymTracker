import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Check } from 'lucide-react-native';
import { LOCATIONS, EQUIPMENT_OPTIONS } from './wizardConstants';
import { wizardStyles } from './wizardStyles';

interface StepEquipmentProps {
  location: string;
  onSelectLocation: (loc: string) => void;
  selectedEquipment: string[];
  onToggleEquipment: (eq: string) => void;
  onSelectAllEquipment: () => void;
}

export default function StepEquipment({
  location,
  onSelectLocation,
  selectedEquipment,
  onToggleEquipment,
  onSelectAllEquipment,
}: StepEquipmentProps) {
  const isAllSelected = selectedEquipment.length === EQUIPMENT_OPTIONS.length;

  return (
    <View style={wizardStyles.stepContainer}>
      <Text style={wizardStyles.stepTitle}>Var tränar du och vad har du tillgång till?</Text>

      {/* Location selector */}
      <Text style={wizardStyles.sectionLabel}>Träningsplats</Text>
      <View style={wizardStyles.locationRow}>
        {LOCATIONS.map((loc) => {
          const isActive = location === loc;
          return (
            <TouchableOpacity
              key={loc}
              style={[wizardStyles.locationCard, isActive && wizardStyles.activeLocationCard]}
              onPress={() => onSelectLocation(loc)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  wizardStyles.locationCardText,
                  isActive && wizardStyles.activeLocationCardText,
                ]}
              >
                {loc}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Equipment checkboxes */}
      <View style={wizardStyles.sectionHeaderRow}>
        <Text style={wizardStyles.sectionLabel}>Utrustning</Text>
        <TouchableOpacity onPress={onSelectAllEquipment} style={wizardStyles.selectAllBtn}>
          <Text style={wizardStyles.selectAllBtnText}>
            {isAllSelected ? 'Avmarkera alla' : 'Välj alla'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={wizardStyles.equipmentScroll} showsVerticalScrollIndicator={false}>
        {EQUIPMENT_OPTIONS.map((eq) => {
          const isSelected = selectedEquipment.includes(eq);
          return (
            <TouchableOpacity
              key={eq}
              style={[
                wizardStyles.checkboxCard,
                isSelected && wizardStyles.activeCheckboxCard,
              ]}
              onPress={() => onToggleEquipment(eq)}
              activeOpacity={0.7}
            >
              <View style={[wizardStyles.checkbox, isSelected && wizardStyles.checkboxChecked]}>
                {isSelected && <Check size={12} color="#0A0A0A" strokeWidth={3} />}
              </View>
              <Text style={wizardStyles.checkboxText}>{eq}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
