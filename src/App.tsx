// src/App.tsx
import 'react-native-get-random-values'; // <-- Polyfill dla crypto.getRandomValues
import React, { useEffect, useState, ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SyncStatusProvider } from './contexts/SyncStatusContext';
import ToastComponent from './components/Toast';
import { initializeDatabase } from './database';
import { initializeSyncService, getSyncService, SyncStatus } from './services/sync/syncService';
import { initializeImageService, getImageService } from './services/image/imageService';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type SyncService from './services/sync/syncService';
import type ImageService from './services/image/imageService';

// Hook do inicjalizacji bazy danych
const useInitialization = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        console.log("[useInitialization] Initializing database...");
        await initializeDatabase();
        console.log("[useInitialization] Database initialized.");
        const imageServiceInstance = initializeImageService();
        await imageServiceInstance.cleanupOrphanedImageFiles();
        initializeSyncService();

        if (isMounted) setIsInitialized(true);
      } catch (err: any) {
        console.error("[useInitialization] Critical initialization error:", err);
        if (isMounted) setError(err);
      }
    };
    init();
    return () => { isMounted = false; };
  }, []);

  return { isInitialized, error };
};

interface AppRootProps { children: ReactNode; }

// Komponent do zarządzania serwisami zależnymi od stanu autoryzacji i sesji
const AppServicesController: React.FC<{ children: ReactNode }> = ({ children }) => {
   // Dodano sessionExpired do zależności
   const { isAuthenticated, isAuthCheckLoading, userId, sessionExpired } = useAuth();

   useEffect(() => {
      if (isAuthCheckLoading) return;

      let syncService: SyncService | null = null;
      let imageService: ImageService | null = null;

      try {
        syncService = getSyncService();
        imageService = getImageService();

        // Uruchamiaj serwisy tylko gdy użytkownik jest zalogowany ORAZ sesja NIE wygasła
        if (isAuthenticated && userId && !sessionExpired) {
            console.log("[AppServicesController] Starting services...");
            const currentSyncStatus = syncService.getStatus();
            if (currentSyncStatus === SyncStatus.Idle || currentSyncStatus === SyncStatus.Stopped || currentSyncStatus === SyncStatus.Error || currentSyncStatus === SyncStatus.Offline) {
                syncService.start();
            } else {
                 console.log(`[AppServicesController] SyncService already active (status: ${currentSyncStatus}), not starting again.`);
            }
             imageService.startObservingRecipes();

        } else {
            // Zatrzymuj serwisy, gdy użytkownik nie jest zalogowany LUB sesja wygasła
            if (sessionExpired) {
                 console.log("[AppServicesController] Session expired, stopping services...");
            } else if (!isAuthenticated || !userId) {
                 console.log("[AppServicesController] User not authenticated, stopping services...");
            }
            if (syncService) syncService.stop();
            if (imageService) imageService.stopObservingRecipes();
        }
      } catch (error) {
          console.error("[AppServicesController] Error managing services:", error);
      }

   // Dodano sessionExpired jako zależność useEffect
   }, [isAuthenticated, userId, isAuthCheckLoading, sessionExpired]);

   return <SyncStatusProvider>{children}</SyncStatusProvider>;
}

// --- Główny Komponent Aplikacji ---
export default function AppRoot({ children }: AppRootProps) {
  const { isInitialized, error: initError } = useInitialization();

  if (initError) {
    return <ErrorIndicator text={`Błąd krytyczny inicjalizacji: ${initError.message}`} />;
  }

  if (!isInitialized) {
    return <LoadingIndicator text="Inicjalizacja aplikacji..." />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
           <AppServicesController>
              {children}
           </AppServicesController>
           <ToastComponent />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// --- Komponenty Pomocnicze ---
const LoadingIndicator = ({ text }: { text: string }) => (
  <View style={styles.containerCenter}>
    <ActivityIndicator size="large" color="#5c7ba9" />
    <Text style={styles.textCenter}>{text}</Text>
  </View>
);
const ErrorIndicator = ({ text }: { text: string }) => (
   <View style={styles.containerCenter}>
      <MaterialIcons name="error-outline" size={48} color="red" />
      <Text style={[styles.textCenter, styles.errorText]}>{text}</Text>
   </View>
);

// --- Style ---
const styles = StyleSheet.create({
    containerCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 20, },
    textCenter: { marginTop: 15, color: '#666', fontSize: 16, textAlign: 'center', },
    errorText: { color: 'red', fontSize: 16, textAlign: 'center', fontWeight: 'bold', marginTop: 15, }
});