// app/index.tsx (Nowa zawartość - logika przekierowania)
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext'; // Ścieżka jest poprawna, bo app/ jest na tym samym poziomie co src/
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function RootIndexScreen() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // Pokaż wskaźnik ładowania, gdy sprawdzany jest stan auth
    return (
       <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5c7ba9" />
       </View>
    );
  }

  // Jeśli załadowano i użytkownik jest zalogowany, przekieruj do listy przepisów
  if (isAuthenticated) {
    // Główny ekran po zalogowaniu to lista przepisów w zakładkach
    return <Redirect href="/(tabs)/recipes" />;
  } else {
    // Jeśli nie jest zalogowany, przekieruj do ekranu logowania
    // Zakładamy, że ekran logowania jest pod ścieżką '/login' (zdefiniowany w app/(auth)/login.tsx)
    return <Redirect href="/login" />;
  }
}

// Style dla wskaźnika ładowania (przeniesione)
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff', // Możesz dostosować tło
  },
});