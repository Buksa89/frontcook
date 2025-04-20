import React from 'react';
import { Stack } from 'expo-router/stack';

export default function AuthLayout() {
  // Ten layout będzie obowiązywał dla wszystkich ekranów w grupie (auth)
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Nie pokazujemy domyślnego nagłówka dla ekranów logowania/rejestracji */}
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      {/* Można tu dodać inne ekrany auth, np. reset hasła */}
    </Stack>
  );
}