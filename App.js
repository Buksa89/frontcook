import React, { useEffect } from 'react';
import { StatusBar, View } from 'expo-status-bar';
import RecipeListScreen from './app/(screens)/RecipeListScreen/RecipeListScreen';
import { AuthProvider } from './app/context';
import syncService from './app/services/sync/syncService';
import AuthService from './app/services/auth/authService';

export default function App() {
  useEffect(() => {
    // Sprawdź czy jest zalogowany użytkownik i rozpocznij synchronizację
    const initSync = async () => {
      try {
        const activeUser = await AuthService.getActiveUser();
        if (activeUser) {
          console.log('[App] Starting initial sync for user:', activeUser);
          syncService.startBackgroundSync(activeUser);
        }
      } catch (error) {
        console.error('[App] Error starting initial sync:', error);
      }
    };

    initSync();

    // Cleanup przy zamknięciu aplikacji
    return () => {
      syncService.stopBackgroundSync();
    };
  }, []);

  return (
    <AuthProvider>
      <View style={{ flex: 1 }}>
        <StatusBar style="auto" />
        <RecipeListScreen />
      </View>
    </AuthProvider>
  );
} 