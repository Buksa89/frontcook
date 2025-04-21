import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '../../src/config/theme';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function AuthLayout() {
  const router = useRouter();

  const navigateToRecipes = () => {
    router.replace('/(tabs)/recipes');
  };

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: styles.headerStyle,
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: Colors.textPrimary,
        },
        headerTitleAlign: 'center',
        headerTintColor: Colors.textSecondary, // Kolor tytułu i domyślnej strzałki (jeśli by była)
        // ZMIANA: Usunięto headerBackTitleVisible i ustawiono headerBackTitle na pusty string
        headerBackTitle: ' ', // Ustaw na spację lub pusty string, aby ukryć tekst obok domyślnej strzałki (iOS)
        // --- KONIEC ZMIANY ---
        headerLeft: () => (
          <TouchableOpacity
            onPress={navigateToRecipes}
            style={styles.headerLeftButton}
          >
            <MaterialIcons name="arrow-back-ios" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        ),
      }}
    >
      {/* Definicje ekranów bez zmian */}
      <Stack.Screen name="login" options={{ title: 'Logowanie' }} />
      <Stack.Screen name="register" options={{ title: 'Rejestracja' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Resetuj Hasło' }}/>
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerStyle: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Platform.select({
      ios: { shadowOpacity: 0, },
      android: { elevation: 0, },
    }),
  },
  headerLeftButton: {
    marginLeft: Platform.OS === 'ios' ? 15 : 0, // iOS potrzebuje marginesu, Android zwykle nie przy niestandardowym headerLeft
    paddingVertical: 5,
    paddingHorizontal: 10, // Daj trochę więcej miejsca na kliknięcie poziomo
  }
});