import React, { useEffect } from 'react';
import { StatusBar, View } from 'expo-status-bar';
import RecipeListScreen from './app/(screens)/RecipeListScreen/RecipeListScreen';
import { AuthProvider } from './app/context';
import { initializeSyncService, getSyncService } from './app/services';
import AuthService from './app/services/auth/authService';

export default function App() {
  useEffect(() => {
    // Initialize SyncService and check if there's a logged-in user
    const initSync = async () => {
      try {
        // Initialize sync service
        initializeSyncService();
        
        const activeUser = await AuthService.getActiveUser();
        if (activeUser) {
          console.log('[App] Starting initial sync for user:', activeUser);
          // Start sync service with the new method
          getSyncService().start();
        }
      } catch (error) {
        console.error('[App] Error starting initial sync:', error);
      }
    };

    initSync();

    // Cleanup when app is closed
    return () => {
      try {
        getSyncService().stop();
      } catch (error) {
        console.error('[App] Error stopping sync service:', error);
      }
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