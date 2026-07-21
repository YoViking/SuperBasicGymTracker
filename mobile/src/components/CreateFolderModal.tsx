import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Platform, KeyboardAvoidingView } from 'react-native';

interface CreateFolderModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export default function CreateFolderModal({ visible, onClose, onCreate }: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('');

  const handleCreate = () => {
    if (folderName.trim()) {
      onCreate(folderName.trim());
      setFolderName('');
    }
  };

  const handleClose = () => {
    setFolderName('');
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.modalOverlayDismiss} activeOpacity={1} onPress={handleClose} />
        <View style={styles.modalContent}>
          <Text style={styles.title}>Skapa mapp</Text>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Namn"
              placeholderTextColor="#94A3B8"
              value={folderName}
              onChangeText={setFolderName}
              autoFocus
              selectionColor="#A3E635"
            />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={handleClose} style={styles.button}>
              <Text style={styles.cancelButtonText}>AVBRYT</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleCreate} 
              style={styles.button}
              disabled={!folderName.trim()}
            >
              <Text style={[styles.createButtonText, !folderName.trim() && styles.disabledButtonText]}>
                SKAPA
              </Text>
            </TouchableOpacity>
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
    marginBottom: 32,
  },
  input: {
    color: '#F8FAFC',
    fontSize: 16,
    paddingVertical: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
  },
  button: {
    paddingVertical: 8,
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
