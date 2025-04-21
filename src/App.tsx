// src/App.tsx
import React, { useEffect, useState, ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SyncStatusProvider } from './contexts/SyncStatusContext';
import ToastComponent from './components/Toast';
import { initializeDatabase } from './database';
import { initializeSyncService, getSyncService, SyncStatus } from './services/sync/syncService'; // Import SyncStatus
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
        // Można tu dodać inne globalne inicjalizacje, np. czyszczenie plików
        const imageServiceInstance = initializeImageService(); // Utwórz instancję wcześnie
        await imageServiceInstance.cleanupOrphanedImageFiles(); // Wyczyść pliki
        // Inicjalizacja SyncService też może być tutaj, ale bez startowania
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

// Komponent do zarządzania serwisami zależnymi od stanu autoryzacji
const AppServicesController: React.FC<{ children: ReactNode }> = ({ children }) => {
   const { isAuthenticated, isAuthCheckLoading, userId } = useAuth();
   // Usunięto stan servicesReady, bo renderujemy children od razu

   // Uruchom/zatrzymaj serwisy w zależności od stanu Auth
   useEffect(() => {
      // Nie rób nic, dopóki sprawdzanie auth się nie zakończy
      if (isAuthCheckLoading) return;

      let syncService: SyncService | null = null;
      let imageService: ImageService | null = null;

      try {
        // Pobierz zainicjalizowane instancje
        syncService = getSyncService();
        imageService = getImageService();

        if (isAuthenticated && userId) {
            console.log("[AppServicesController] Starting services...");
            if (syncService.getStatus() !== SyncStatus.Syncing) { // Unikaj wielokrotnego startu
                syncService.start();
            }
            // ImageService powinien już obserwować od momentu inicjalizacji
        } else {
            console.log("[AppServicesController] Stopping services...");
            if (syncService) syncService.stop();
            if (imageService) imageService.stopObservingRecipes();
        }
      } catch (error) {
          console.error("[AppServicesController] Error managing services:", error);
      }

      // Cleanup nie jest już potrzebny tutaj, bo serwisy żyją dłużej
      // return () => { ... };

   }, [isAuthenticated, userId, isAuthCheckLoading]); // Reaguj na zmiany stanu auth

   // Renderuj dzieci od razu, ale z dostawcą statusu synchronizacji
   return <SyncStatusProvider>{children}</SyncStatusProvider>;
}

// --- Główny Komponent Aplikacji ---
export default function AppRoot({ children }: AppRootProps) {
  const { isInitialized, error: initError } = useInitialization(); // Użyj hooka inicjalizacji

  // Pokaż błąd inicjalizacji, jeśli wystąpił
  if (initError) {
    return <ErrorIndicator text={`Błąd krytyczny inicjalizacji: ${initError.message}`} />;
  }

  // Pokaż loader inicjalizacji, dopóki baza nie jest gotowa
  if (!isInitialized) {
    return <LoadingIndicator text="Inicjalizacja aplikacji..." />;
  }

  // Baza gotowa, renderuj resztę (AuthProvider sam zarządza swoim loaderem)
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
           {/* AuthProvider renderuje swoje dzieci, w tym AuthLoader jeśli trzeba */}
           {/* Następnie renderujemy kontroler serwisów i resztę aplikacji */}
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