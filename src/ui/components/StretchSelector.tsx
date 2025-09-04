/**
 * StretchSelector - Stretch type selection component
 * Provides difficulty levels and instructions preview
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const StretchSelector: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Stretch</Text>
      {/* TODO: Implement stretch selection interface */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});
