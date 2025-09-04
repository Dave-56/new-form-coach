/**
 * StatusBanner - Traffic light system for coaching status
 * Displays current status and last cue
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const StatusBanner: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Status: Ready</Text>
      {/* TODO: Implement traffic light system */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f0f0f0',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
  },
});
