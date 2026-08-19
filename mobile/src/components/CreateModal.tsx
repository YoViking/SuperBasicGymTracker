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
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Dumbbell, Folder as FolderIcon, Sparkles, ArrowLeft, Image as ImageIcon } from 'lucide-react-native';
import { Folder } from '../types';

export type CreateModalMode = 'SELECT' | 'WORKOUT' | 'FOLDER';

interface CreateModalProps {
  visible: boolean;
  folders: Folder[];
  onClose: () => void;
  onCreateWorkout: (name: string, folderId: string | null) => Promise<void> | void;
  onCreateFolder: (name: string, description: string, imageBase64: string | null) => Promise<void> | void;
  onOpenAiWizard: () => void;
}

export default function CreateModal({
  visible,
  folders = [],
  onClose,
  onCreateWorkout,
  onCreateFolder,
  onOpenAiWizard,
}: CreateModalProps) {
  const [mode, setMode] = useState<CreateModalMode>('SELECT');
  const [loading, setLoading] = useState(false);

  // Workout state
  const [workoutName, setWorkoutName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Folder state
  const [folderName, setFolderName] = useState('');
  const [folderDesc, setFolderDesc] = useState('');
  const [folderImageBase64, setFolderImageBase64] = useState<string | null>(null);

  const resetAll = () => {
    Keyboard.dismiss();
    setMode('SELECT');
    setWorkoutName('');
    setSelectedFolderId(null);
    setFolderName('');
    setFolderDesc('');
    setFolderImageBase64(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleCreateWorkoutSubmit = async () => {
    const trimmed = workoutName.trim();
    if (!trimmed || loading) return;

    try {
      setLoading(true);
      Keyboard.dismiss();
      await onCreateWorkout(trimmed, selectedFolderId);
      resetAll();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleCreateFolderSubmit = async () => {
    const trimmed = folderName.trim();
    if (!trimmed || loading) return;

    try {
      setLoading(true);
      Keyboard.dismiss();
      await onCreateFolder(trimmed, folderDesc.trim(), folderImageBase64);
      resetAll();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const pickFolderImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setFolderImageBase64(result.assets[0].base64);
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
            {/* 1. SELECTION SCREEN */}
            {mode === 'SELECT' && (
              <View>
                <Text style={styles.optionsModalTitle}>Vad vill du skapa?</Text>

                {/* Option 1: Ny Workout */}
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => setMode('WORKOUT')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIconBg, { backgroundColor: 'rgba(163, 230, 53, 0.12)' }]}>
                    <Dumbbell size={22} color="#A3E635" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Nytt träningspass</Text>
                    <Text style={styles.optionDesc}>Skapa ett tomt pass och välj övningar</Text>
                  </View>
                </TouchableOpacity>

                {/* Option 2: Nytt Program (Mapp) */}
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => setMode('FOLDER')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIconBg, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
                    <FolderIcon size={22} color="#38BDF8" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Nytt program (Mapp)</Text>
                    <Text style={styles.optionDesc}>Skapa en samling för att gruppera dina pass</Text>
                  </View>
                </TouchableOpacity>

                {/* Option 3: Skapa med AI */}
                <TouchableOpacity
                  style={[styles.optionItem, styles.optionItemAi]}
                  onPress={() => {
                    handleClose();
                    onOpenAiWizard();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIconBg, styles.optionIconBgAi]}>
                    <Sparkles size={22} color="#0A0A0A" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, styles.optionTitleAi]}>Skapa med AI ✨</Text>
                    <Text style={styles.optionDesc}>Få ett komplett schema anpassat efter dina mål</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* 2. WORKOUT CREATION SCREEN */}
            {mode === 'WORKOUT' && (
              <View>
                <View style={styles.headerRow}>
                  <TouchableOpacity
                    onPress={() => setMode('SELECT')}
                    style={styles.backButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <ArrowLeft size={20} color="#94A3B8" />
                  </TouchableOpacity>
                  <View style={styles.iconCircle}>
                    <Dumbbell size={18} color="#A3E635" />
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
                    onSubmitEditing={handleCreateWorkoutSubmit}
                  />
                </View>

                {/* Program/Folder Selector */}
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
                    onPress={handleCreateWorkoutSubmit}
                    style={[styles.button, styles.createBtn]}
                    disabled={!workoutName.trim() || loading}
                    activeOpacity={0.7}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#0A0A0A" />
                    ) : (
                      <Text
                        style={[
                          styles.createButtonText,
                          !workoutName.trim() && styles.disabledButtonText,
                        ]}
                      >
                        SKAPA
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 3. FOLDER / PROGRAM CREATION SCREEN */}
            {mode === 'FOLDER' && (
              <View>
                <View style={styles.headerRow}>
                  <TouchableOpacity
                    onPress={() => setMode('SELECT')}
                    style={styles.backButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <ArrowLeft size={20} color="#94A3B8" />
                  </TouchableOpacity>
                  <View style={[styles.iconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
                    <FolderIcon size={18} color="#38BDF8" />
                  </View>
                  <Text style={styles.title}>Skapa nytt program</Text>
                </View>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Programnamn (t.ex. PPL 6 Dagar)"
                    placeholderTextColor="#94A3B8"
                    value={folderName}
                    onChangeText={setFolderName}
                    selectionColor="#A3E635"
                    autoFocus={true}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Kort beskrivning (valfritt)"
                    placeholderTextColor="#94A3B8"
                    value={folderDesc}
                    onChangeText={setFolderDesc}
                    selectionColor="#A3E635"
                    returnKeyType="done"
                    onSubmitEditing={handleCreateFolderSubmit}
                  />
                </View>

                <View style={styles.imagePickerRow}>
                  {folderImageBase64 ? (
                    <TouchableOpacity onPress={pickFolderImage} style={styles.imagePreviewContainer}>
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${folderImageBase64}` }}
                        style={styles.imagePreview}
                      />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.imagePickerButton} onPress={pickFolderImage}>
                      <ImageIcon size={18} color="#F8FAFC" style={{ marginRight: 6 }} />
                      <Text style={styles.imagePickerText}>Omslagsbild</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity onPress={handleClose} style={styles.button}>
                      <Text style={styles.cancelButtonText}>AVBRYT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleCreateFolderSubmit}
                      style={[styles.button, styles.createBtn]}
                      disabled={!folderName.trim() || loading}
                      activeOpacity={0.7}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#0A0A0A" />
                      ) : (
                        <Text
                          style={[
                            styles.createButtonText,
                            !folderName.trim() && styles.disabledButtonText,
                          ]}
                        >
                          SKAPA
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
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
    backgroundColor: '#141417',
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1.5,
    borderColor: '#27272A',
    zIndex: 10,
  },
  optionsModalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#2D2D35',
  },
  optionItemAi: {
    borderColor: '#A3E635',
    backgroundColor: 'rgba(163, 230, 53, 0.03)',
  },
  optionIconBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionIconBgAi: {
    backgroundColor: '#A3E635',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  optionTitleAi: {
    color: '#A3E635',
  },
  optionDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  backButton: {
    padding: 4,
    marginRight: 2,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
  },
  inputContainer: {
    backgroundColor: '#0A0A0A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3F3F46',
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  input: {
    color: '#F8FAFC',
    fontSize: 15,
    paddingVertical: 12,
  },
  folderSection: {
    marginBottom: 16,
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
  imagePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderStyle: 'dashed',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  imagePickerText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    width: 44,
    height: 44,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  button: {
    paddingVertical: 9,
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
    color: 'rgba(10,10,10,0.3)',
  },
});
