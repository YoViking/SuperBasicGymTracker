import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { X, Check } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface GuideStepItem {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  iconColor?: string;
  iconBgColor?: string;
  badge?: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
  title: string;
  description: string;
}

export interface GuideModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: GuideStepItem[];
  closeButtonText?: string;
}

export default function GuideModal({
  visible,
  onClose,
  title,
  subtitle,
  items,
  closeButtonText = 'Uppfattat!',
}: GuideModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalOverlayDismiss}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <View style={styles.bottomSheet}>
          {/* Drag Handle Bar */}
          <View style={styles.handleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrapper}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity
              style={styles.closeIconButton}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <X size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Guide Items List */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {items.map((item, index) => {
              const IconComponent = item.icon;
              const iconColor = item.iconColor || '#A3E635';
              const iconBg = item.iconBgColor || 'rgba(163, 230, 53, 0.12)';
              const badgeBg = item.badgeBgColor || 'rgba(163, 230, 53, 0.15)';
              const badgeText = item.badgeTextColor || '#A3E635';

              return (
                <View key={index} style={styles.guideCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
                      <IconComponent size={20} color={iconColor} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {item.badge ? (
                      <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.badgeText, { color: badgeText }]}>
                          {item.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.cardDescription}>{item.description}</Text>
                </View>
              );
            })}
          </ScrollView>

          {/* Bottom Action Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Check size={18} color="#0A0A0A" strokeWidth={3} style={styles.btnIcon} />
              <Text style={styles.actionButtonText}>{closeButtonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  modalOverlayDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomSheet: {
    backgroundColor: '#0F1012',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.88,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 25,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 38,
    height: 4,
    backgroundColor: '#3F3F46',
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2024',
  },
  headerTextWrapper: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E2024',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 12,
  },
  guideCard: {
    backgroundColor: '#18191D',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#26282E',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardDescription: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#94A3B8',
    paddingLeft: 44,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  actionButton: {
    backgroundColor: '#A3E635',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A3E635',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  btnIcon: {
    marginRight: 6,
  },
  actionButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '700',
  },
});
