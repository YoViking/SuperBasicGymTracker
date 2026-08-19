import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Dumbbell, Folder as FolderIcon } from 'lucide-react-native';
import { Folder } from '../types';

interface CreateWorkoutModalProps {
  visible: boolean;
  folders?: Folder[];
  onClose: () => void;
  onCreate: (name: string, folderId: string | null) => void;
}

export default function CreateWorkoutModal({
  visible,
  folders = [],
  onClose,
  onCreate,
}: CreateWorkoutModalProps) {
  const [workoutName, setWorkoutName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const handleCreate = () => {
    if (workoutName.trim()) {
      Keyboard.dismiss();
      onCreate(workoutName.trim(), selectedFolderId);
      setWorkoutName('');
      setSelectedFolderId(null);
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();
    setWorkoutName('');
    setSelectedFolderId(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="always"
          bounces={false}
        >
          <TouchableWithoutFeedback onPress={handleClose}>
            <View style={styles.modalOverlayDismiss} />
          </TouchableWithoutFeedback>

          <View style={styles.modalContent}>
            <View style={styles.headerRow}>
              <View style={styles.iconCircle}>
                <Dumbbell size={20} color="#A3E635" />
              </View>
              <Text style={styles.title}>Skapa ny workout</Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Namn på passet (t.ex. Överkropp)"
                placeholderTextColor="#94A3B8"
                value={workoutName}
                onChangeText={setWorkoutName}
                selectionColor="#A3E635"
                autoFocus={true}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
            </View>

            {/* Optional Program/Folder Selector */}
            {folders.length > 0 && (
              <View style={styles.folderSection}>
                <Text style={styles.folderSectionTitle}>Tillhör program (valfritt):</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  contentContainerStyle={styles.folderChipsContainer}
                >
                  <TouchableOpacity
                    style={[
                      styles.folderChip,
                      selectedFolderId === null && styles.folderChipActive,
                    ]}
                    onPress={() => setSelectedFolderId(null)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.folderChipText,
                        selectedFolderId === null && styles.folderChipTextActive,
                      ]}
                    >
                      Fristående
                    </Text>
                  </TouchableOpacity>

                  {folders.map((f) => {
                    const isSelected = selectedFolderId === f.id;
                    return (
                      <TouchableOpacity
                        key={f.id}
                        style={[
                          styles.folderChip,
                          isSelected && styles.folderChipActive,
                        ]}
                        onPress={() => setSelectedFolderId(isSelected ? null : f.id)}
                        activeOpacity={0.7}
                      >
                        <FolderIcon
                          size={14}
                          color={isSelected ? '#0A0A0A' : '#94A3B8'}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.folderChipText,
                            isSelected && styles.folderChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {f.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity onPress={handleClose} style={styles.button}>
                <Text style={styles.cancelButtonText}>AVBRYT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreate}
                style={[styles.button, styles.createBtn]}
                disabled={!workoutName.trim()}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.createButtonText,
                    !workoutName.trim() && styles.disabledButtonText,
                  ]}
                >
                  SKAPA
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalOverlayDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#27272A',
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  inputContainer: {
    backgroundColor: '#0A0A0A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3F3F46',
    marginBottom: 18,
    paddingHorizontal: 14,
  },
  input: {
    color: '#F8FAFC',
    fontSize: 15,
    paddingVertical: 12,
  },
  folderSection: {
    marginBottom: 20,
  },
  folderSectionTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  folderChipsContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  folderChipActive: {
    backgroundColor: '#A3E635',
    borderColor: '#A3E635',
  },
  folderChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  folderChipTextActive: {
    color: '#0A0A0A',
    fontWeight: '700',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  createBtn: {
    backgroundColor: '#A3E635',
    borderRadius: 8,
    paddingHorizontal: 18,
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  createButtonText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '800',
  },
  disabledButtonText: {
    color: 'rgba(10,10,10,0.4)',
  },
});
