/**
 * SessionScreen - Active coaching session screen
 * Displays camera preview, status banner, and timer
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const SessionScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coaching Session</Text>
      {/* TODO: Implement camera preview and status banner */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
