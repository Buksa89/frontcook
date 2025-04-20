// src/context/authContext.tsx

import React, { createContext, useState, useEffect, ReactNode, useContext, useCallback } from 'react';
// Importuj INSTANCJE serwisów
import authService from '../services/auth/authService';
import authApi from '../api/auth'; // Importuj obiekt authApi
// Importuj instancję SyncService, jeśli jest globalna
import { syncService } from '../services'; // Zakładając, że jest eksportowana z głównego index.ts serwisów
// Usuwamy AuthApi, bo używamy instancji authApi
// Usuwamy AuthStorage, bo zarządza nim authService
// Usunięto import api, bo jest używany wewnętrznie przez inne serwisy
// Usunięto LocalSyncService - zakładamy, że ta logika jest teraz częścią standardowej synchronizacji lub nie jest potrzebna
import { Alert } from 'react-native';
import Toast, { showToast } from '../components/Toast'; // Upewnij się, że ścieżka jest poprawna

// Interfejs kontekstu
interface AuthContextType {
  // Zmieniono active_user na userId dla spójności
  userId: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean; // Dodano stan ładowania
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // refreshToken nie jest już potrzebne w kontekście, ApiClient robi to automatycznie
  register: (username: string, email: string, password: string, password2: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

// Tworzenie kontekstu
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Interfejs propsów Providera
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null); // Zmieniono nazwę stanu
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Stan do śledzenia początkowego ładowania

  // --- Efekt do Weryfikacji Stanu Logowania Przy Starcie ---
  useEffect(() => {
    const checkAuthState = async () => {
      setIsLoading(true); // Rozpocznij ładowanie
      try {
        // Pobierz dane bezpośrednio z authService
        const storedToken = await authService.getAccessToken();
        const storedUserId = await authService.getActiveUserId();

        if (storedToken && storedUserId) {
          console.log('[AuthContext] Znaleziono dane uwierzytelniające w storage.');
          setAccessToken(storedToken);
          setUserId(storedUserId);
          // Rozpocznij synchronizację w tle, jeśli użytkownik jest zalogowany
          try {
            syncService.start(); // Użyj bezpośrednio zaimportowanej instancji
            console.log('[AuthContext] Background sync started on initial load.');
          } catch (syncError) {
            console.error('[AuthContext] Nie udało się uruchomić SyncService przy starcie:', syncError);
          }
        } else {
          console.log('[AuthContext] Brak danych uwierzytelniających w storage.');
          // Upewnij się, że stany są null, jeśli nie ma danych
          setAccessToken(null);
          setUserId(null);
        }
      } catch (error) {
        console.error('[AuthContext] Błąd podczas sprawdzania stanu uwierzytelnienia:', error);
        // W razie błędu odczytu, załóż, że użytkownik nie jest zalogowany
        setAccessToken(null);
        setUserId(null);
      } finally {
        setIsLoading(false); // Zakończ ładowanie
      }
    };

    checkAuthState();
  }, []); // Uruchom tylko raz przy montowaniu

  // --- Funkcja Logowania (NOWA IMPLEMENTACJA) ---
  const login = useCallback(async (username: string, password: string) => {
    // setIsLoading(true); // Opcjonalnie, pokaż loader podczas logowania
    try {
      // Wywołaj metodę logowania z instancji authApi
      const response = await authApi.login({ username, password });
      // authApi.login samo wywołuje authService.login do zapisania danych

      // Zaktualizuj stan kontekstu na podstawie ODPOWIEDZI API (userId zamiast username)
      setAccessToken(response.access);
      setUserId(response.userId); // Użyj userId z odpowiedzi
      console.log('[AuthContext] Logowanie pomyślne, userId:', response.userId);

      // Uruchom SyncService po udanym logowaniu
      try {
        syncService.start();
        console.log('[AuthContext] Background sync started after login.');
      } catch (syncError) {
        console.error('[AuthContext] Nie udało się uruchomić SyncService po logowaniu:', syncError);
      }

      // Usunięto logikę LocalSyncService - zakładamy, że nie jest już potrzebna
      // lub jest obsługiwana inaczej

    } catch (error) {
      console.error('[AuthContext] Błąd logowania:', error);
      // Wyczyść stan w razie błędu logowania
      setAccessToken(null);
      setUserId(null);
      throw error; // Rzuć błąd dalej, aby komponent UI mógł go obsłużyć
    } finally {
        // setIsLoading(false); // Wyłącz loader
    }
  }, []); // Pusta tablica zależności, bo używa funkcji/obiektów zdefiniowanych poza

  // --- Funkcja Rejestracji (NOWA IMPLEMENTACJA) ---
  const register = useCallback(async (username: string, email: string, password: string, password2: string) => {
    // setIsLoading(true);
    try {
      if (password !== password2) throw new Error('Hasła nie są identyczne');

      // Wywołaj metodę rejestracji z instancji authApi
      await authApi.register({ username, email, password, password2 });

      showToast({
        type: 'success',
        text1: 'Rejestracja udana',
        text2: 'Link aktywacyjny został wysłany. Aktywuj konto, aby się zalogować.',
        visibilityTime: 5000, // Dłuższy czas wyświetlania
      });
    } catch (error) {
      console.error('[AuthContext] Błąd podczas rejestracji:', error);
      // Rzucamy błąd, aby UI mogło wyświetlić np. komunikat z API
      throw error;
    } finally {
      // setIsLoading(false);
    }
  }, []);

  // --- Funkcja Wylogowania (NOWA IMPLEMENTACJA) ---
  const logout = useCallback(async () => {
    // setIsLoading(true);
    console.log('[AuthContext] Rozpoczynanie procesu wylogowania...');
    try {
      // Zatrzymaj SyncService
      try {
        syncService.stop();
        console.log('[AuthContext] Background sync stopped.');
      } catch (syncError) {
        console.error('[AuthContext] Nie udało się zatrzymać SyncService podczas wylogowania:', syncError);
        // Kontynuuj mimo to
      }

      // Wywołaj metodę wylogowania z instancji authApi
      // Ta metoda sama wywoła authService.logout() do czyszczenia danych
      await authApi.logout();

      // Wyczyść stan w kontekście
      setAccessToken(null);
      setUserId(null);
      console.log('[AuthContext] Wylogowano pomyślnie.');

    } catch (error) {
      console.error('[AuthContext] Błąd podczas wylogowywania:', error);
      // Na wszelki wypadek wyczyść stan lokalny, nawet jeśli API zawiodło
      setAccessToken(null);
      setUserId(null);
      // Nie rzucaj błędu dalej, aby nie przerywać procesu wylogowania w UI
      // Można pokazać Toast
       showToast({ type: 'error', text1: 'Błąd', text2: 'Wystąpił błąd podczas wylogowywania.' });
    } finally {
       // setIsLoading(false);
    }
  }, []);

  // --- Funkcja Resetowania Hasła (NOWA IMPLEMENTACJA) ---
  const resetPassword = useCallback(async (email: string) => {
    // setIsLoading(true);
    try {
      // Wywołaj metodę resetowania hasła z instancji authApi
      await authApi.resetPassword({ email });
      showToast({ type: 'success', text1: 'Sprawdź email', text2: 'Link do resetowania hasła został wysłany.' });
    } catch (error) {
      console.error('[AuthContext] Błąd podczas resetowania hasła:', error);
      throw error; // Rzuć błąd, aby UI mogło pokazać szczegóły
    } finally {
        // setIsLoading(false);
    }
  }, []);

  // Usunięto metodę refreshToken - jest teraz obsługiwana automatycznie przez ApiClient

  // --- Wartość Kontekstu ---
  const authContextValue: AuthContextType = {
    userId: userId, // Zmieniono nazwę klucza
    accessToken: accessToken,
    isAuthenticated: !!accessToken && !!userId, // Sprawdza oba
    isLoading: isLoading, // Dodano stan ładowania
    login,
    logout,
    register,
    resetPassword,
    // Usunięto refreshToken
  };

  // --- Renderowanie Providera ---
  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
      <Toast />
    </AuthContext.Provider>
  );
};

// --- Hook `useAuth` (bez zmian) ---
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth musi być używane wewnątrz AuthProvider');
  }
  return context;
};