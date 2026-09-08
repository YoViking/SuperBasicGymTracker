import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { LOADING_MESSAGES } from './wizardConstants';
import { wizardStyles } from './wizardStyles';

interface WizardLoadingProps {
  title?: string;
  messages?: string[];
}

export default function WizardLoading({
  title = 'Genererar...',
  messages = LOADING_MESSAGES,
}: WizardLoadingProps) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [messages]);

  return (
    <View style={wizardStyles.loadingContainer}>
      <ActivityIndicator size="large" color="#A3E635" style={{ marginBottom: 24 }} />
      <Text style={wizardStyles.loadingTitle}>{title}</Text>
      <Text style={wizardStyles.loadingSubtitle}>{messages[msgIdx]}</Text>
    </View>
  );
}
