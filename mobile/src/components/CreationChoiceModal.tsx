import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Sparkles, PenTool, ChevronRight, X } from 'lucide-react-native';

interface CreationChoiceModalProps {
  visible: boolean;
  type: 'program' | 'workout';
  onClose: () => void;
  onSelectManual: () => void;
  onSelectAiWizard: () => void;
}

export default function CreationChoiceModal({
  visible,
  type,
  onClose,
  onSelectManual,
  onSelectAiWizard,
}: CreationChoiceModalProps) {
  const isProgram = type === 'program';
  const title = isProgram ? 'Nytt program' : 'Nytt pass';
  const subtitle = isProgram
    ? 'Välj hur du vill skapa ditt träningsprogram'
    : 'Välj hur du vill skapa ditt träningspass';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.subtitle}>{subtitle}</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Options */}
              <View style={styles.optionsContainer}>
                {/* Option 1: Manuellt */}
                <TouchableOpacity
                  style={styles.optionCard}
                  activeOpacity={0.75}
                  onPress={() => {
                    onClose();
                    onSelectManual();
                  }}
                >
                  <View style={styles.iconContainerManual}>
                    <PenTool size={22} color="#F8FAFC" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Manuellt</Text>
                    <Text style={styles.optionDesc}>
                      {isProgram
                        ? 'Skapa programmet själv och lägg till pass'
                        : 'Bygg passet själv och välj övningar'}
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#64748B" />
                </TouchableOpacity>

                {/* Option 2: Få hjälp av WP Wizard */}
                <TouchableOpacity
                  style={[styles.optionCard, styles.optionCardAi]}
                  activeOpacity={0.75}
                  onPress={() => {
                    onClose();
                    onSelectAiWizard();
                  }}
                >
                  <View style={styles.iconContainerAi}>
                    <Sparkles size={22} color="#A3E635" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <View style={styles.optionTitleRow}>
                      <Text style={[styles.optionTitle, styles.optionTitleAi]}>
                        Få hjälp av WP Wizard
                      </Text>
                      <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>AI ✨</Text>
                      </View>
                    </View>
                    <Text style={styles.optionDesc}>
                      {isProgram
                        ? 'Låt AI skräddarsy ett komplett schema efter dina mål'
                        : 'Låt AI bygga ett smart pass anpassat för dig'}
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#A3E635" />
                </TouchableOpacity>
              </View>

              {/* Cancel button */}
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>AVBRYT</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1.5,
    borderColor: '#27272A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  closeBtn: {
    padding: 4,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  optionCardAi: {
    borderColor: 'rgba(163, 230, 53, 0.4)',
    backgroundColor: 'rgba(163, 230, 53, 0.04)',
  },
  iconContainerManual: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#22252F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconContainerAi: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.3)',
  },
  optionTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  optionTitleAi: {
    color: '#A3E635',
  },
  aiBadge: {
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  aiBadgeText: {
    color: '#A3E635',
    fontSize: 10,
    fontWeight: '800',
  },
  optionDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
