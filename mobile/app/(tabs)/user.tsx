import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { supabase } from '../../src/lib/supabase';

export default function UserScreen() {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>User Profile</Text>
      <Button title="Sign Out" onPress={handleSignOut} color="#A3E635" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#F8FAFC',
    fontSize: 18,
    marginBottom: 20,
  },
});
