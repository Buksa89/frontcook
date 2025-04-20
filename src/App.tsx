import React, { useEffect, useState } from 'react'; // Dodano useState
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext'; // Importuj useAuth
import { SyncStatusProvider } from './contexts/SyncStatusContext'; // Importuj SyncStatusProvider
import ToastComponent from './components/Toast';
import { initializeDatabase } from './database'; // Importuj funkcję inicjalizującą bazę
import { initializeSyncService, getSyncService } from './services/sync/syncService'; // Importuj inicjalizację SyncService
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'; // Do wskaźnika ładowania bazy

interface AppRootProps {
  children: React.ReactNode;
}

// Komponent wewnętrzny do zarządzania inicjalizacją
const AppInitializer: React.FC<AppRootProps> = ({ children }) => {
  const { isAuthenticated, isLoading: isAuthLoading, userId } = useAuth();
  const [isDbInitialized, setIsDbInitialized] = useState(false);
  const [isSyncInitialized, setIsSyncInitialized] = useState(false);

  // Inicjalizacja Bazy Danych
  useEffect(() => {
    const initDb = async () => {
      console.log("[AppInitializer] Inicjalizacja Bazy Danych...");
      try {
        await initializeDatabase(); // Wywołaj inicjalizację
        setIsDbInitialized(true);
        console.log("[AppInitializer] Baza Danych zainicjalizowana.");
      } catch (error) {
        console.error("[AppInitializer] Krytyczny błąd inicjalizacji Bazy Danych!", error);
        // Można tu pokazać ekran błędu krytycznego
      }
    };
    initDb();
  }, []); // Tylko raz przy montowaniu

  // Inicjalizacja i start/stop SyncService w zależności od stanu Auth i Bazy
  useEffect(() => {
    if (!isDbInitialized || isAuthLoading) {
      // Nie rób nic, jeśli baza nie jest gotowa lub autentykacja się ładuje
      return;
    }

    try {
      // Zawsze inicjalizuj (lub pobierz) instancję po inicjalizacji bazy
      const syncService = initializeSyncService();
      setIsSyncInitialized(true);
      console.log("[AppInitializer] SyncService zainicjalizowany/pobrany.");

      if (isAuthenticated && userId) {
        console.log("[AppInitializer] Użytkownik zalogowany. Uruchamianie SyncService...");
        syncService.start();
      } else {
        console.log("[AppInitializer] Użytkownik niezalogowany. Zatrzymywanie SyncService...");
        syncService.stop();
      }

      // Funkcja cleanup, która zatrzyma serwis przy odmontowywaniu komponentu lub zmianie stanu auth
      return () => {
        if (syncService) {
           console.log("[AppInitializer Cleanup] Zatrzymywanie SyncService...");
           syncService.stop();
        }
      };

    } catch (error) {
        console.error("[AppInitializer] Błąd podczas inicjalizacji/zarządzania SyncService:", error);
        setIsSyncInitialized(false); // Oznacz jako nieudane
    }

  // Zależności: stan inicjalizacji bazy, stan ładowania auth, status logowania, ID użytkownika
  }, [isDbInitialized, isAuthLoading, isAuthenticated, userId]);

  // Pokaż globalny wskaźnik ładowania, dopóki baza i stan auth nie są gotowe
  if (!isDbInitialized || isAuthLoading) {
    return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5c7ba9" />
            <Text style={styles.loadingText}>Inicjalizacja aplikacji...</Text>
        </View>
    );
  }
  // Jeśli sync nie został zainicjalizowany (błąd), można pokazać stan błędu
   if (!isSyncInitialized && isAuthenticated) { // Pokaż błąd tylko jeśli zalogowany, bo sync jest wtedy ważny
      return (
          <View style={styles.loadingContainer}>
              <Text style={styles.errorText}>Błąd inicjalizacji synchronizacji!</Text>
              {/* Można dodać przycisk ponownej próby */}
          </View>
      );
   }


  // Jeśli wszystko jest gotowe, renderuj dzieci (czyli Stack Navigator z app/_layout.tsx)
  return <>{children}</>;
};


export default function AppRoot({ children }: AppRootProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          {/* Używamy AppInitializer do zarządzania logiką inicjalizacji */}
          <AppInitializer>
             {/* SyncStatusProvider dodajemy WEWNĄTRZ AppInitializer,
                 aby mieć pewność, że SyncService jest gotowy */}
             <SyncStatusProvider>
                 {children}
             </SyncStatusProvider>
          </AppInitializer>
          <ToastComponent />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Style dla wskaźnika ładowania i błędu
const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    errorText: {
        color: 'red',
        fontSize: 16,
        textAlign: 'center',
        padding: 20,
    }
});