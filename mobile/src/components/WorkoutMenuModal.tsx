import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Trash2, Edit2, FolderOutput } from 'lucide-react-native';

interface WorkoutMenuModalProps {
  visible: boolean;
  workoutName: string;
  onClose: () => void;
  onDelete: () => void;
  onMoveToFolder: () => void;
  onEdit: () => void;
}

export default function WorkoutMenuModal({
  visible,
  workoutName,
  onClose,
  onDelete,
  onMoveToFolder,
  onEdit
}: WorkoutMenuModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalOverlayDismiss} activeOpacity={1} onPress={onClose} />
        <View style={styles.bottomSheet}>
          <View style={styles.bottomSheetHeader}>
            <View style={styles.bottomSheetHandle} />
          </View>
          
          {workoutName ? (
            <Text style={styles.workoutTitle}>{workoutName}</Text>
          ) : null}

          <TouchableOpacity style={styles.optionRow} onPress={onDelete}>
            <Trash2 size={24} color="#FF3B3E" />
            <Text style={styles.optionTextRed}>Radera</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionRow} onPress={onMoveToFolder}>
            <FolderOutput size={24} color="#F8FAFC" />
            <Text style={styles.optionTextWhite}>Flytta till program</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionRow} onPress={onEdit}>
            <Edit2 size={24} color="#F8FAFC" />
            <Text style={styles.optionTextWhite}>Redigera</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalOverlayDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomSheet: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },
  bottomSheetHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#3F3F46',
    borderRadius: 2,
  },
  workoutTitle: {
    color: '#A3E635',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  optionTextWhite: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  optionTextRed: {
    color: '#FF3B3E',
    fontSize: 16,
    fontWeight: '600',
  },
});
