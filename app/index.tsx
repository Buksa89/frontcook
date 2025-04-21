// app/index.tsx
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function RootIndexScreen() {
  // --- ZMIANA: Użyj isAuthCheckLoading ---

  return <Redirect href="/(tabs)/recipes" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});