import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // Dla przyszłego D&D
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './contexts/AuthContext'; // Import z contexts
// import ToastComponent from './components/Toast'; // Załóżmy, że komponent Toast jest w src/components

interface AppRootProps {
  children: React.ReactNode;
}

// Ten komponent będzie głównym miejscem na dodawanie Providerów
export default function AppRoot({ children }: AppRootProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          {/* Tutaj dodamy inne globalne providery, np. SyncStatusProvider */}
          {children}
          {/* <ToastComponent /> */}
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}