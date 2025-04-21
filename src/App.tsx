// src/App.tsx
import 'react-native-get-random-values';
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

// Hook inicjalizacji bazy (bez zmian)
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
        initializeImageService();
        initializeSyncService();
        await getImageService().cleanupOrphanedImageFiles();
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

const AppServicesController: React.FC<{ children: ReactNode }> = ({ children }) => {
   // --- POPRAWKA: Dodano isLoggedIn do destrukturyzacji ---
   const { isAuthenticated, isLoggedIn, isAuthCheckLoading, sessionExpired } = useAuth();
   // -----------------------------------------------------

   useEffect(() => {
      if (isAuthCheckLoading) return;

      let syncService: SyncService | null = null;
      let imageService: ImageService | null = null;

      try {
        syncService = getSyncService();
        imageService = getImageService();

        // Aktualizuj stan sesji w SyncService
        syncService.updateSessionStatus(sessionExpired);

        // --- POPRAWKA: Warunek używa teraz poprawnie pobranego isLoggedIn ---
        const shouldServicesBeActive = isLoggedIn && !sessionExpired;
        // ------------------------------------------------------------------

        if (shouldServicesBeActive) {
            console.log("[AppServicesController] Warunki spełnione (zalogowany, sesja ważna). Startowanie serwisów...");
            const currentSyncStatus = syncService.getStatus();
             if (![SyncStatus.Syncing, SyncStatus.Checking, SyncStatus.Waiting].includes(currentSyncStatus)) {
                syncService.start();
             } else {
                 console.log(`[AppServicesController] SyncService już aktywny (status: ${currentSyncStatus}), nie startuję ponownie.`);
             }
            imageService.startObservingRecipes();

        } else {
            if (sessionExpired) {
                 console.log("[AppServicesController] Sesja wygasła, zatrzymywanie serwisów...");
            } else if (!isLoggedIn) {
                 console.log("[AppServicesController] Użytkownik niezalogowany, zatrzymywanie serwisów...");
            } else {
                 console.log("[AppServicesController] Nieznany powód niespełnienia warunków, zatrzymywanie serwisów...");
            }
            if (syncService.getStatus() !== SyncStatus.Stopped) {
                 syncService.stop();
            }
            imageService.stopObservingRecipes();
        }
      } catch (error) {
          console.error("[AppServicesController] Błąd zarządzania serwisami:", error);
      }

   // --- POPRAWKA: Dodano isLoggedIn do zależności ---
   }, [isLoggedIn, isAuthenticated, sessionExpired, isAuthCheckLoading]);
   // ---------------------------------------------

   return <SyncStatusProvider>{children}</SyncStatusProvider>;
}

// Główny komponent AppRoot (bez zmian)
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

// Komponenty pomocnicze (bez zmian)
const LoadingIndicator = ({ text }: { text: string }) => ( <View style={styles.containerCenter}><ActivityIndicator size="large" color="#5c7ba9" /><Text style={styles.textCenter}>{text}</Text></View> );
const ErrorIndicator = ({ text }: { text: string }) => ( <View style={styles.containerCenter}><MaterialIcons name="error-outline" size={48} color="red" /><Text style={[styles.textCenter, styles.errorText]}>{text}</Text></View> );
const styles = StyleSheet.create({ containerCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 20, }, textCenter: { marginTop: 15, color: '#666', fontSize: 16, textAlign: 'center', }, errorText: { color: 'red', fontSize: 16, textAlign: 'center', fontWeight: 'bold', marginTop: 15, } });