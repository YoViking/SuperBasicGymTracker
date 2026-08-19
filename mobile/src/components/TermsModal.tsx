import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { X, Check } from 'lucide-react-native';
import LegalTermsContent from './LegalTermsContent';

interface TermsModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export default function TermsModal({
  visible,
  onClose,
  onAccept,
  showAcceptButton = false,
}: TermsModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Villkor & Integritet</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <X size={22} color="#F8FAFC" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <LegalTermsContent />
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          {showAcceptButton && onAccept ? (
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => {
                onAccept();
                onClose();
              }}
              activeOpacity={0.85}
            >
              <Check size={18} color="#0A0A0A" style={{ marginRight: 6 }} />
              <Text style={styles.acceptButtonText}>Jag godkänner villkoren</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.closeBottomButton}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.closeBottomButtonText}>Stäng</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
    backgroundColor: '#0A0A0A',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  content: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    padding: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    backgroundColor: '#121215',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A3E635',
    paddingVertical: 14,
    borderRadius: 12,
  },
  acceptButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBottomButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181B',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  closeBottomButtonText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
});
