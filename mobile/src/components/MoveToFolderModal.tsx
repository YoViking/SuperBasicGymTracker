import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, ScrollView } from 'react-native';
import { Folder, FolderPlus, X } from 'lucide-react-native';
import { Folder as FolderType } from '../types';

interface MoveToFolderModalProps {
  visible: boolean;
  folders: FolderType[];
  onClose: () => void;
  onSelectFolder: (folderId: string) => void;
  onCreateNew: () => void;
}

export default function MoveToFolderModal({
  visible,
  folders,
  onClose,
  onSelectFolder,
  onCreateNew
}: MoveToFolderModalProps) {
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
          
          <View style={styles.titleRow}>
            <Text style={styles.title}>Flytta till program</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.folderList} contentContainerStyle={styles.folderListContent}>
            <TouchableOpacity style={styles.optionRow} onPress={onCreateNew}>
              <FolderPlus size={24} color="#A3E635" />
              <Text style={styles.createNewText}>Skapa program</Text>
            </TouchableOpacity>

            {folders.map((folder) => (
              <TouchableOpacity 
                key={folder.id} 
                style={styles.optionRow} 
                onPress={() => onSelectFolder(folder.id)}
              >
                <Folder size={24} color="#F8FAFC" />
                <Text style={styles.optionTextWhite}>{folder.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
    maxHeight: '80%',
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  folderList: {
    marginTop: 8,
  },
  folderListContent: {
    paddingBottom: 20,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#18181B',
  },
  optionTextWhite: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  createNewText: {
    color: '#A3E635',
    fontSize: 16,
    fontWeight: '600',
  },
});
