import React from 'react';
import { Stack } from 'expo-router/stack';
import { Colors } from '../../src/config/theme'; // Importuj kolory dla spójności stylu
// ZMIANA: Upewnij się, że importujesz StyleSheet i Platform
import { Platform, StyleSheet } from 'react-native';

export default function AuthLayout() {
  // Layout będzie obowiązywał dla wszystkich ekranów w grupie (auth)
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        // Zastosuj style nagłówka zdefiniowane poniżej
        headerStyle: styles.headerStyle,
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: Colors.textPrimary,
        },
        headerTitleAlign: 'center',
        headerTintColor: Colors.textSecondary,
        headerBackTitle: 'Wróć',
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: 'Logowanie',
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: 'Rejestracja',
        }}
      />
      {/* Można tu dodać inne ekrany auth */}
      {/* Przykład:
      <Stack.Screen
        name="forgot-password" // Zakładając, że plik to forgot-password.tsx
        options={{
          title: 'Resetuj Hasło',
        }}
      />
       */}
    </Stack>
  );
}

// Definicja stylów dla nagłówka przy użyciu StyleSheet i Platform.select
const styles = StyleSheet.create({
  headerStyle: {
    backgroundColor: Colors.card, // Wspólne tło
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    // Warunkowe style dla cienia
    ...Platform.select({
      ios: {
        shadowOpacity: 0, // Usuń cień na iOS
      },
      android: {
        elevation: 0, // Usuń cień na Androidzie
      },
    }),
  },
});