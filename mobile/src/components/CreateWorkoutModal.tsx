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
  ToastAndroid,
} from 'react-native';
import { Dumbbell, Folder as FolderIcon, Plus } from 'lucide-react-native';
import { Folder } from '../types';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

interface CreateWorkoutModalProps {
  visible: boolean;
  folders?: Folder[];
  onClose: () => void;
  onCreate?: (name: string, folderId: string | null) => void;
}

export default function CreateWorkoutModal({
  visible,
  folders = [],
  onClose,
  onCreate,
}: CreateWorkoutModalProps) {
  const router = useRouter();
  const [workoutName, setWorkoutName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    Keyboard.dismiss();
    setWorkoutName('');
    setSelectedFolderId(null);
    setLoading(false);
    onClose();
  };

  const handleAddExercise = async () => {
    if (loading) return;

    try {
      setLoading(true);
      Keyboard.dismiss();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const todayStr = new Date().toLocaleDateString('sv-SE', {
        day: 'numeric',
        month: 'short',
      });
      const finalName = workoutName.trim() || `Pass ${todayStr}`;

      const { data, error } = await supabase
        .from('workouts')
        .insert([{
          name: finalName,
          folder_id: selectedFolderId || null,
          user_id: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      if (onCreate) {
        onCreate(finalName, selectedFolderId);
      }

      setWorkoutName('');
      setSelectedFolderId(null);
      setLoading(false);
      onClose();

      // Navigate to exercise library in 'add_to_template' mode
      router.push({
        pathname: '/(tabs)/exercises',
        params: {
          mode: 'add_to_template',
          target_workout_id: data.id,
          t: Date.now().toString(),
        },
      });
    } catch (err: any) {
      console.error('Error creating workout:', err);
      setLoading(false);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Kunde inte skapa pass', ToastAndroid.SHORT);
      }
    }
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
              <Text style={styles.title}>Nytt träningspass</Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Namn på passet (valfritt)"
                placeholderTextColor="#64748B"
                value={workoutName}
                onChangeText={setWorkoutName}
                selectionColor="#A3E635"
                autoFocus={false}
                returnKeyType="done"
                onSubmitEditing={handleAddExercise}
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

            {/* Bottom Actions */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity onPress={handleClose} style={styles.button}>
                <Text style={styles.cancelButtonText}>AVBRYT</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAddExercise}
                style={[styles.button, styles.addExerciseBtn]}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#0A0A0A" style={{ marginRight: 6 }} strokeWidth={3} />
                <Text style={styles.addExerciseBtnText}>Lägg till övning</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalOverlayDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#18181B',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
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
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
  },
  folderSection: {
    marginBottom: 16,
  },
  folderSectionTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  folderChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
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
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  addExerciseBtn: {
    backgroundColor: '#A3E635',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  addExerciseBtnText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '800',
  },
});
