// app/(auth)/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router/stack';
import { Colors } from '../../src/config/theme'; // Importuj kolory dla spójności stylu
import { Platform, StyleSheet } from 'react-native'; // Importuj Platform i StyleSheet

export default function AuthLayout() {
  // Layout będzie obowiązywał dla wszystkich ekranów w grupie (auth)
  return (
    <Stack
      screenOptions={{
        headerShown: true, // Pokaż nagłówek
        headerStyle: styles.headerStyle, // Użyj stylów zdefiniowanych poniżej
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: Colors.textPrimary, // Kolor tekstu tytułu
        },
        headerTitleAlign: 'center', // Wyśrodkuj tytuł
        headerTintColor: Colors.textSecondary, // Kolor strzałki wstecz
        headerBackTitle: 'Wróć', // Tekst przycisku wstecz (iOS) lub null/false, aby ukryć
        // headerBackTitleVisible: false, // Alternatywnie, aby ukryć tekst przycisku wstecz
      }}
    >
      {/* Definicje ekranów w tej grupie nawigacji */}
      <Stack.Screen
        name="login" // Odpowiada plikowi login.tsx
        options={{
          title: 'Logowanie', // Tytuł wyświetlany w nagłówku
        }}
      />
      <Stack.Screen
        name="register" // Odpowiada plikowi register.tsx
        options={{
          title: 'Rejestracja', // Tytuł wyświetlany w nagłówku
        }}
      />
      <Stack.Screen
        name="forgot-password" // Odpowiada plikowi forgot-password.tsx
        options={{
          title: 'Resetuj Hasło', // Tytuł wyświetlany w nagłówku
        }}
      />
      {/* Możesz dodać tutaj kolejne ekrany należące do przepływu autoryzacji */}
    </Stack>
  );
}

// Definicja stylów dla nagłówka przy użyciu StyleSheet i Platform.select
const styles = StyleSheet.create({
  headerStyle: {
    backgroundColor: Colors.card, // Używamy koloru tła karty (zwykle biały)
    borderBottomWidth: 1, // Delikatna linia na dole
    borderBottomColor: Colors.border, // Używamy koloru ramki z motywu
    // Warunkowe usunięcie cienia
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