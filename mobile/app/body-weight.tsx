import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import Svg, { Line, Circle, Polyline } from 'react-native-svg';
import { BodyWeightEntry, getBodyWeightHistory, addBodyWeightEntry, formatWeightDate, getUserBodyWeight } from '../src/utils/volume';

const { width } = Dimensions.get('window');
const CHART_HEIGHT = 180;
const CARD_MARGIN = 16;
const CARD_PADDING = 14;
const CHART_CARD_WIDTH = width - (CARD_MARGIN * 2) - (CARD_PADDING * 2);
const LABEL_WIDTH = 44;
const PLOT_WIDTH = CHART_CARD_WIDTH - LABEL_WIDTH;

export default function BodyWeightScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<BodyWeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newWeightText, setNewWeightText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getBodyWeightHistory();
      setHistory(data);
      const current = await getUserBodyWeight();
      setNewWeightText(current ? current.toString() : '');
    } catch (error) {
      console.error('Error loading body weight data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    if (history.length > 0) {
      setNewWeightText(history[0].weight.toString());
    }
    setIsModalVisible(true);
  };

  const handleSaveMeasurement = async () => {
    const parsed = parseFloat(newWeightText.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0 && parsed < 400) {
      const updated = await addBodyWeightEntry(parsed);
      setHistory(updated);
      setIsModalVisible(false);
    }
  };

  // Chronological data for chart plotting
  const chronologicalData = useMemo(() => {
    return [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  // Y-axis grid calculation
  const { minVal, maxVal, gridLevels, points } = useMemo(() => {
    if (chronologicalData.length === 0) {
      return { minVal: 70, maxVal: 90, gridLevels: [90, 85, 80, 75, 70], points: [] };
    }

    const weights = chronologicalData.map(d => d.weight);
    let min = Math.min(...weights);
    let max = Math.max(...weights);

    // Ensure there's a range for the chart grid
    if (min === max) {
      min = Math.max(0, min - 2);
      max = max + 2;
    } else {
      const padding = (max - min) * 0.15;
      min = Math.max(0, min - padding);
      max = max + padding;
    }

    const numLevels = 6;
    const step = (max - min) / (numLevels - 1);
    const levels: number[] = [];
    for (let i = 0; i < numLevels; i++) {
      levels.push(parseFloat((max - i * step).toFixed(1)));
    }

    const paddingY = 16;
    const availableHeight = CHART_HEIGHT - paddingY * 2;

    const computedPoints = chronologicalData.map((d, index) => {
      let x = 0;
      if (chronologicalData.length === 1) {
        x = PLOT_WIDTH / 2;
      } else {
        x = (index / (chronologicalData.length - 1)) * (PLOT_WIDTH - 16) + 8;
      }

      const ratio = (d.weight - min) / (max - min);
      const y = paddingY + (1 - ratio) * availableHeight;
      return { x, y, weight: d.weight, date: d.date };
    });

    return {
      minVal: min,
      maxVal: max,
      gridLevels: levels,
      points: computedPoints
    };
  }, [chronologicalData]);

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.headerIconButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={26} color="#F8FAFC" />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleOpenAddModal} 
          style={styles.headerIconButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Plus size={28} color="#F8FAFC" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Kroppsvikt</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A3E635" />
          </View>
        ) : (
          <>
            {/* Chart Area with Grey Background Card */}
            <View style={styles.chartCard}>
              <View style={styles.chartContainer}>
                {/* Horizontal Grid Lines with Labels on the Right */}
                {gridLevels.map((level, i) => {
                  const yPos = (i / (gridLevels.length - 1)) * (CHART_HEIGHT - 32) + 16;
                  return (
                    <View key={i} style={[styles.gridRow, { top: yPos }]}>
                      <View style={styles.gridLine} />
                      <Text style={styles.gridLabel}>{level}</Text>
                    </View>
                  );
                })}

                {/* SVG Curve and Data Dots */}
                <Svg width={PLOT_WIDTH} height={CHART_HEIGHT} style={styles.svgOverlay}>
                  {points.length > 1 && (
                    <Polyline
                      points={polylinePoints}
                      fill="none"
                      stroke="#A3E635"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {points.map((p, idx) => (
                    <Circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r="5"
                      fill="#A3E635"
                    />
                  ))}
                </Svg>
              </View>
            </View>

            {/* History Section */}
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>Historik</Text>

              {history.length === 0 ? (
                <Text style={styles.emptyText}>Ingen mäthistorik än. Tryck på + för att lägga till din vikt.</Text>
              ) : (
                history.map((item) => (
                  <View key={item.id} style={styles.historyItemContainer}>
                    <View style={styles.historyRow}>
                      <Text style={styles.historyDate}>{formatWeightDate(item.date)}</Text>
                      <Text style={styles.historyWeight}>{item.weight} kg</Text>
                    </View>
                    <View style={styles.historyDivider} />
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Add Measurement Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setIsModalVisible(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lägg till mätning</Text>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.inputField}
                value={newWeightText}
                onChangeText={setNewWeightText}
                keyboardType="decimal-pad"
                selectTextOnFocus
                autoFocus
                placeholder="87"
                placeholderTextColor="#64748B"
              />
              <Text style={styles.inputUnit}>kg</Text>
            </View>

            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={handleSaveMeasurement}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>Spara</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setIsModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerIconButton: {
    padding: 4,
  },
  pageTitle: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartCard: {
    backgroundColor: '#2D3039',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 28,
  },
  chartContainer: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#475569',
  },
  gridLabel: {
    width: LABEL_WIDTH,
    color: '#F8FAFC',
    fontSize: 12.5,
    fontWeight: '500',
    textAlign: 'right',
    paddingLeft: 6,
  },
  svgOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  historySection: {
    paddingHorizontal: 16,
    marginTop: 6,
  },
  historyTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
  },
  historyItemContainer: {
    marginBottom: 4,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  historyDate: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '500',
  },
  historyWeight: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  historyDivider: {
    height: 1,
    backgroundColor: '#3F3F46',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#3F3F46',
    padding: 22,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D1D5DB',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#A3E635',
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 20,
  },
  inputField: {
    flex: 1,
    color: '#0A0A0A',
    fontSize: 18,
    fontWeight: '700',
    padding: 0,
  },
  inputUnit: {
    color: '#0A0A0A',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#A3E635',
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
});
