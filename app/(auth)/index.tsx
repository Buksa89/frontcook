// app/(auth)/index.tsx
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function IndexScreen() {
  // ZMIANA: Użyj isAuthCheckLoading
  const { isAuthenticated, isAuthCheckLoading } = useAuth();
  console.log('[IndexScreen] Render:', { isAuthenticated, isAuthCheckLoading }); // Dodaj log dla debugowania

  // ZMIANA: Sprawdź isAuthCheckLoading
  if (isAuthCheckLoading) {
    console.log('[IndexScreen] Showing loading indicator (auth check in progress).');
    return (
       <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5c7ba9" />
       </View>
    );
  }

  // Logika przekierowania (bez zmian)
  if (isAuthenticated) {
    console.log("[IndexScreen] User is authenticated, redirecting to /recipes");
    return <Redirect href="/(tabs)/recipes" />;
  } else {
    console.log("[IndexScreen] User not authenticated, redirecting to /login");
    return <Redirect href="/login" />;
  }
}

// Style dla wskaźnika ładowania
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});