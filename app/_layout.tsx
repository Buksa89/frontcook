import React from 'react';
import { Stack } from 'expo-router/stack';
import AppRoot from '../src/App'; // Importuj z src

export default function RootLayout() {
  // Tutaj później dodamy globalne layouty, nagłówki itp.
  // Na razie tylko renderujemy główny komponent z src/App.tsx
  // Stack.Screen będzie potrzebny do nawigacji
  return (
    <AppRoot>
       <Stack screenOptions={{ headerShown: false }}/>
    </AppRoot>
  );
}