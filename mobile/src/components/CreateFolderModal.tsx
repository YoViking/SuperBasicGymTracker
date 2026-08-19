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
  Image,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImageIcon } from 'lucide-react-native';

interface CreateFolderModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, imageBase64: string | null) => void;
}

export default function CreateFolderModal({ visible, onClose, onCreate }: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('');
  const [description, setDescription] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const handleCreate = () => {
    if (folderName.trim()) {
      Keyboard.dismiss();
      onCreate(folderName.trim(), description.trim(), imageBase64);
      setFolderName('');
      setDescription('');
      setImageBase64(null);
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();
    setFolderName('');
    setDescription('');
    setImageBase64(null);
    onClose();
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square images match the UI design
      quality: 0.5,
      base64: true, // We need base64 to upload to Supabase storage easily without file path issues
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageBase64(result.assets[0].base64);
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
            <Text style={styles.title}>Skapa ett program</Text>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Namn"
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
                placeholder="Kort beskrivning"
                placeholderTextColor="#94A3B8"
                value={description}
                onChangeText={setDescription}
                selectionColor="#A3E635"
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
            </View>

            <View style={styles.imagePickerRow}>
              {imageBase64 ? (
                <TouchableOpacity onPress={pickImage} style={styles.imagePreviewContainer}>
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${imageBase64}` }} 
                    style={styles.imagePreview} 
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                  <ImageIcon size={20} color="#F8FAFC" style={{ marginRight: 8 }} />
                  <Text style={styles.imagePickerText}>Lägg till bild</Text>
                </TouchableOpacity>
              )}
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity onPress={handleClose} style={styles.button}>
                  <Text style={styles.cancelButtonText}>AVBRYT</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleCreate} 
                  style={styles.button}
                  disabled={!folderName.trim()}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.createButtonText, !folderName.trim() && styles.disabledButtonText]}>
                    SKAPA
                  </Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#27272A',
    zIndex: 10,
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
  imagePickerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
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
  createButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButtonText: {
    color: '#3F3F46',
  },
});
