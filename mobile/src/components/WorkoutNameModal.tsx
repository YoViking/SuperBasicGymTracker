import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Check, X, Dumbbell } from 'lucide-react-native';

interface WorkoutNameModalProps {
  visible: boolean;
  defaultName?: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

export default function WorkoutNameModal({
  visible,
  defaultName,
  onSave,
  onClose,
}: WorkoutNameModalProps) {
  const getFallbackDateName = () => {
    const today = new Date();
    const datePart = today.toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'short',
    });
    return `Pass ${datePart}`;
  };

  const [name, setName] = useState('');

  useEffect(() => {
    if (visible) {
      setName(defaultName || getFallbackDateName());
    }
  }, [visible, defaultName]);

  const handleConfirm = () => {
    const finalName = name.trim() || defaultName || getFallbackDateName();
    onSave(finalName);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Dumbbell size={20} color="#A3E635" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Namnge ditt träningspass</Text>
              <Text style={styles.subtitle}>
                Ge passet ett namn eller spara med datum som förval.
              </Text>
            </View>
          </View>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={getFallbackDateName()}
            placeholderTextColor="#64748B"
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
            selectionColor="#A3E635"
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Avbryt</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Check size={18} color="#0A0A0A" strokeWidth={3} />
              <Text style={styles.saveText}>Spara pass</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 999,
  },
  content: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#27272A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#A3E635',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  saveText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '700',
  },
});
