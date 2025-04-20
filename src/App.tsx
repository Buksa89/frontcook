// src/App.tsx

import React, { useEffect, useState, ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SyncStatusProvider } from './contexts/SyncStatusContext';
import ToastComponent from './components/Toast'; // Upewnij się, że ten komponent istnieje
import { initializeDatabase } from './database';
import { initializeSyncService, getSyncService } from './services/sync/syncService';
import { initializeImageService, getImageService } from './services/image/imageService'; // Import ImageService
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import type SyncService from './services/sync/syncService'; // Importuj typy
import type ImageService from './services/image/imageService';

interface AppRootProps {
  children: ReactNode;
}

// Komponent wewnętrzny do zarządzania inicjalizacją
const AppInitializer: React.FC<AppRootProps> = ({ children }) => {
  const { isAuthenticated, isLoading: isAuthLoading, userId } = useAuth();
  const [isDbInitialized, setIsDbInitialized] = useState(false);
  const [isSyncInitialized, setIsSyncInitialized] = useState(false);
  const [isImageServiceInitialized, setIsImageServiceInitialized] = useState(false);

  // Inicjalizacja Bazy Danych
  useEffect(() => {
    let isMounted = true; // Flaga do śledzenia montowania
    const initDb = async () => {
      console.log("[AppInitializer] Inicjalizacja Bazy Danych...");
      try {
        await initializeDatabase();
        if (isMounted) {
            setIsDbInitialized(true);
            console.log("[AppInitializer] Baza Danych zainicjalizowana.");
        }
      } catch (error) {
        console.error("[AppInitializer] Krytyczny błąd inicjalizacji Bazy Danych!", error);
        if (isMounted) {
            // Można tu ustawić stan błędu globalnego
            setIsDbInitialized(false); // Oznacz jako nieudane
        }
      }
    };
    initDb();
    return () => { isMounted = false; }; // Cleanup
  }, []); // Tylko raz przy montowaniu

  // Inicjalizacja i start/stop SyncService oraz ImageService
  useEffect(() => {
    if (!isDbInitialized || isAuthLoading) {
      // Nie rób nic, jeśli baza nie jest gotowa lub autentykacja się ładuje
       // console.log(`[AppInitializer] Oczekiwanie: Baza gotowa=${isDbInitialized}, Auth ładowanie=${isAuthLoading}`);
      return;
    }

    let syncServiceInstanceRef: SyncService | null = null;
    let imageServiceInstanceRef: ImageService | null = null;
    let isActive = true; // Flaga do śledzenia aktywności efektu

    const initializeServices = async () => {
      try {
        // Inicjalizuj SyncService
        syncServiceInstanceRef = initializeSyncService();
        if (isActive) setIsSyncInitialized(true);
        console.log("[AppInitializer] SyncService zainicjalizowany/pobrany.");

        // Inicjalizuj ImageService
        imageServiceInstanceRef = initializeImageService();
        if (isActive) setIsImageServiceInitialized(true);
        console.log("[AppInitializer] ImageService zainicjalizowany/pobrany.");

        // Zarządzanie start/stop na podstawie stanu Auth
        if (isAuthenticated && userId) {
          console.log("[AppInitializer] Użytkownik zalogowany. Uruchamianie serwisów...");
          syncServiceInstanceRef.start();
          // ImageService startuje obserwację przy inicjalizacji, nie ma metody start()
        } else {
          console.log("[AppInitializer] Użytkownik niezalogowany. Zatrzymywanie serwisów...");
          syncServiceInstanceRef.stop();
          imageServiceInstanceRef.stopObservingRecipes(); // Zatrzymaj obserwację obrazków
        }

      } catch (error) {
          console.error("[AppInitializer] Błąd podczas inicjalizacji/zarządzania Sync lub Image Service:", error);
          if (isActive) {
             if (!syncServiceInstanceRef) setIsSyncInitialized(false);
             if (!imageServiceInstanceRef) setIsImageServiceInitialized(false);
          }
      }
    };

    initializeServices();

    // Funkcja cleanup
    return () => {
      isActive = false; // Oznacz jako nieaktywny
      console.log("[AppInitializer Cleanup] Zatrzymywanie serwisów...");
      try {
         // Użyj getSyncService/getImageService, aby upewnić się, że mamy instancję
         const syncService = getSyncService();
         if (syncService) syncService.stop();
      } catch (e) { console.warn("[AppInitializer Cleanup] Błąd przy zatrzymywaniu SyncService:", e)}
      try {
          const imageService = getImageService();
          if (imageService) imageService.stopObservingRecipes();
      } catch(e) { console.warn("[AppInitializer Cleanup] Błąd przy zatrzymywaniu ImageService:", e)}

    };
  // Zależności: gotowość bazy, stan ładowania auth, status logowania, ID użytkownika
  }, [isDbInitialized, isAuthLoading, isAuthenticated, userId]);

  // --- Renderowanie Stanów Ładowania / Błędu ---

  // Główny wskaźnik ładowania, dopóki baza i stan auth nie są gotowe
  if (!isDbInitialized || isAuthLoading) {
    return <LoadingIndicator text="Inicjalizacja aplikacji..." />;
  }

  // Sprawdź błędy inicjalizacji serwisów, jeśli użytkownik jest zalogowany
  if (isAuthenticated && (!isSyncInitialized || !isImageServiceInitialized)) {
      const errorMsg = !isSyncInitialized
          ? "Błąd inicjalizacji synchronizacji!"
          : "Błąd inicjalizacji serwisu obrazków!";
      return <ErrorIndicator text={errorMsg} />;
  }


  // Jeśli wszystko jest gotowe, renderuj dostawców i dzieci
  // SyncStatusProvider powinien być wewnątrz, aby mieć pewność, że SyncService istnieje
  return (
    <SyncStatusProvider>
      {children}
    </SyncStatusProvider>
  );
};


// --- Główny Komponent Aplikacji ---

export default function AppRoot({ children }: AppRootProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppInitializer>
             {/* children (czyli Stack z _layout.tsx) zostanie wyrenderowane przez AppInitializer */}
             {children}
          </AppInitializer>
          {/* Toast jest poza AppInitializer, aby mógł działać nawet podczas ładowania */}
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
      {/* Można dodać przycisk ponownej próby */}
   </View>
);

// --- Style ---

const styles = StyleSheet.create({
    containerCenter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff', // Tło, żeby zakryć potencjalną zawartość
        padding: 20,
    },
    textCenter: {
        marginTop: 15,
        color: '#666',
        fontSize: 16,
        textAlign: 'center',
    },
    errorText: {
        color: 'red',
        fontSize: 16,
        textAlign: 'center',
        fontWeight: 'bold',
        marginTop: 15,
    }
});