import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext'; // Import useAuth z src
import { View, ActivityIndicator, StyleSheet } from 'react-native'; // Importuj potrzebne komponenty

export default function IndexScreen() {
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
    // Załóżmy, że główny ekran to '/', który sam w sobie może być layoutem lub przekierowywać dalej
    // Jeśli główny ekran to np. '/recipes', użyj '/recipes'
    return <Redirect href="/(tabs)/recipes" />; // Przekierowanie do ekranu wewnątrz layoutu zakładek
  } else {
    // Jeśli nie jest zalogowany, przekieruj do ekranu logowania
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