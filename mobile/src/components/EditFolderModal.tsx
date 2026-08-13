import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Platform, KeyboardAvoidingView, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { Folder } from '../types';

interface EditFolderModalProps {
  visible: boolean;
  folder: Folder | null;
  onClose: () => void;
  onSave: (name: string, description: string, imageBase64: string | null, imageDeleted: boolean) => void;
  onDelete?: () => void;
}

export default function EditFolderModal({ visible, folder, onClose, onSave, onDelete }: EditFolderModalProps) {
  const [folderName, setFolderName] = useState('');
  const [description, setDescription] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageDeleted, setImageDeleted] = useState(false);

  useEffect(() => {
    if (visible && folder) {
      setFolderName(folder.name || '');
      setDescription(folder.description || '');
      setImageBase64(null);
      setImagePreviewUrl(folder.image_url || null);
      setImageDeleted(false);
    }
  }, [visible, folder]);

  const handleSave = () => {
    if (folderName.trim()) {
      onSave(folderName.trim(), description.trim(), imageBase64, imageDeleted);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageBase64(result.assets[0].base64);
      setImagePreviewUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
      setImageDeleted(false);
    }
  };

  const removeImage = () => {
    setImageBase64(null);
    setImagePreviewUrl(null);
    setImageDeleted(true);
  };

  const handleDelete = () => {
    Alert.alert(
      'Radera program',
      'Är du säker på att du vill radera detta program? Dina workouts kommer att sparas.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Radera',
          style: 'destructive',
          onPress: () => {
            if (onDelete) {
              onDelete();
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.modalOverlay} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.modalOverlayDismiss} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalContent}>
          <Text style={styles.title}>Redigera program</Text>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Namn"
              placeholderTextColor="#94A3B8"
              value={folderName}
              onChangeText={setFolderName}
              selectionColor="#A3E635"
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Kort beskrivning"
              placeholderTextColor="#94A3B8"
              value={description}
              onChangeText={setDescription}
              selectionColor="#A3E635"
            />
          </View>

          <View style={styles.imageSection}>
            {imagePreviewUrl ? (
              <View style={styles.imageContainer}>
                <TouchableOpacity onPress={pickImage} style={styles.imagePreviewContainer}>
                  <Image 
                    source={{ uri: imagePreviewUrl }} 
                    style={styles.imagePreview} 
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={removeImage}>
                  <Trash2 size={16} color="#FF3B3E" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                <ImageIcon size={20} color="#F8FAFC" style={{ marginRight: 8 }} />
                <Text style={styles.imagePickerText}>Lägg till bild</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.buttonRow}>
            {onDelete && (
              <TouchableOpacity onPress={handleDelete} style={styles.deleteFolderButton}>
                <Text style={styles.deleteFolderText}>RADERA</Text>
              </TouchableOpacity>
            )}
            <View style={styles.rightButtons}>
              <TouchableOpacity onPress={onClose} style={styles.button}>
                <Text style={styles.cancelButtonText}>AVBRYT</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSave} 
                style={styles.button}
                disabled={!folderName.trim()}
              >
                <Text style={[styles.saveButtonText, !folderName.trim() && styles.disabledButtonText]}>
                  SPARA
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlayDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#0A0A0A',
    borderRadius: 8,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 24,
  },
  inputContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#3F3F46',
    marginBottom: 24,
  },
  input: {
    color: '#F8FAFC',
    fontSize: 16,
    paddingVertical: 8,
  },
  imageSection: {
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderStyle: 'dashed',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  imagePickerText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  imageContainer: {
    position: 'relative',
  },
  imagePreviewContainer: {
    width: 48,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#0A0A0A',
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginLeft: 'auto',
  },
  deleteFolderText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteFolderButton: {
    paddingVertical: 8,
    paddingRight: 8,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cancelButtonText: {
    color: '#A3E635',
    fontSize: 14,
    fontWeight: '700',
  },
  saveButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButtonText: {
    color: '#3F3F46',
  },
});
