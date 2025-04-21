// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native'; // Dodano ActivityIndicator
import authService from '../services/auth/authService'; // Poprawny import serwisu
import authApi from '../services/api/authApi'; // Potrzebny tylko do register/resetPassword
import { showToast } from '../components/Toast'; // Upewnij się, że ścieżka jest poprawna
import { ApiError } from '../services/api/apiClient'; // Importuj ApiError, aby go użyć

// Mapowanie znanych błędów API na polskie komunikaty
const apiErrorTranslations: Record<string, string> = {
  'No active account found with the given credentials': 'Nieprawidłowa nazwa użytkownika lub hasło.',
  'Unable to log in with provided credentials.': 'Nie można zalogować używając podanych danych.',
  // Dodaj więcej tłumaczeń dla innych możliwych błędów z Twojego API
};

// Funkcja pomocnicza do tłumaczenia błędu
const translateApiError = (error: any): string => {
  // Sprawdź, czy błąd jest instancją ApiError i ma wiadomość
  if (error instanceof ApiError && error.message) {
    // Spróbuj znaleźć tłumaczenie dla wiadomości błędu
    const translated = apiErrorTranslations[error.message];
    if (translated) {
      return translated;
    }
    // Jeśli nie ma tłumaczenia, zwróć oryginalną wiadomość
    return error.message;
  }
  // Domyślny komunikat dla innych typów błędów lub braku wiadomości
  return 'Wystąpił nieoczekiwany błąd logowania.';
};


interface AuthContextType {
  userId: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (loginValue: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string, password2: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
     const checkAuthState = async () => {
        console.log('[AuthContext] Sprawdzanie stanu autentykacji...');
        setIsLoading(true);
        try {
          const storedToken = await authService.getAccessToken();
          const storedUserId = await authService.getActiveUserId();

          if (storedToken && storedUserId) {
            console.log('[AuthContext] Znaleziono dane uwierzytelniające.');
            setAccessToken(storedToken);
            setUserId(storedUserId);
            // Uruchomienie SyncService lepiej przenieść do AppInitializer
          } else {
            console.log('[AuthContext] Brak danych uwierzytelniających.');
            setAccessToken(null);
            setUserId(null);
          }
        } catch (error) {
          console.error('[AuthContext] Błąd podczas sprawdzania stanu uwierzytelnienia:', error);
          setAccessToken(null);
          setUserId(null);
        } finally {
          setIsLoading(false);
          console.log('[AuthContext] Sprawdzanie stanu autentykacji zakończone.');
        }
      };
      checkAuthState();
  }, []);

  const login = useCallback(async (loginValue: string, password: string) => {
    // setIsLoading(true); // Można odkomentować, jeśli chcesz loader w trakcie logowania
    try {
      const response = await authService.login(loginValue, password);
      setAccessToken(response.access);
      // Upewnij się, że user_id jest konwertowane na string, jeśli API zwraca number
      setUserId(String(response.user_id));
      showToast({ type: 'success', text1: 'Zalogowano pomyślnie!' });
      // Uruchomienie SyncService lepiej przenieść do AppInitializer, który reaguje na zmianę isAuthenticated
    } catch (error: any) {
      console.error('[AuthContext] Błąd logowania:', error);
      const translatedMessage = translateApiError(error);
      showToast({
          type: 'error',
          text1: 'Błąd logowania',
          text2: translatedMessage,
      });
      // Wyczyść stan w razie błędu
      setAccessToken(null);
      setUserId(null);
      throw error; // Rzuć błąd, aby LoginScreen wiedział o niepowodzeniu
    } finally {
       // setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // setIsLoading(true); // Można odkomentować
    console.log('[AuthContext] Rozpoczynanie procesu wylogowania w kontekście...');
    try {
      // Wywołaj metodę logout z serwisu, która zajmie się wszystkim (API + Storage)
      await authService.logout(); // <<< POPRAWIONE WYWOŁANIE

      // Serwis sam wyczyścił dane w Storage, teraz wyczyść stan w kontekście
      setAccessToken(null);
      setUserId(null);
      console.log('[AuthContext] Wylogowano pomyślnie (stan kontekstu zresetowany).');
      // Toast sukcesu jest już w authService/authApi (lub można go dodać w authService)

    } catch (error) {
      console.error('[AuthContext] Błąd podczas wywoływania authService.logout:', error);
      // Na wszelki wypadek wyczyść stan lokalny, nawet jeśli serwis zawiódł
      setAccessToken(null);
      setUserId(null);
      // Pokaż ogólny błąd, jeśli wystąpił w serwisie (choć serwis powinien już pokazać toast)
      showToast({ type: 'error', text1: 'Błąd', text2: 'Wystąpił błąd podczas wylogowywania.' });
      // Nie rzucaj błędu dalej, aby nie przerywać przepływu w UI po kliknięciu wyloguj
    } finally {
       // setIsLoading(false);
    }
  }, []); // Pusta tablica zależności

  const register = useCallback(async (username: string, email: string, password: string, password2: string) => {
    setIsLoading(true);
    try {
      if (password !== password2) throw new Error('Hasła nie są identyczne');
      await authApi.register({ username, email, password, password2 });
      showToast({
        type: 'success',
        text1: 'Rejestracja udana',
        text2: 'Link aktywacyjny został wysłany na Twój email.',
        visibilityTime: 5000,
      });
    } catch (error: any) {
      console.error('[AuthContext] Błąd rejestracji:', error);
       const translatedMessage = translateApiError(error); // Spróbuj przetłumaczyć błąd z API
      showToast({
          type: 'error',
          text1: 'Błąd rejestracji',
          text2: translatedMessage, // Pokaż przetłumaczony lub oryginalny błąd
          visibilityTime: 5000,
      });
      throw error; // Rzuć błąd dalej
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setIsLoading(true);
    try {
      await authApi.resetPassword({ email });
      showToast({ type: 'success', text1: 'Sprawdź email', text2: 'Link do resetowania hasła został wysłany.' });
    } catch (error: any) {
      console.error('[AuthContext] Błąd resetowania hasła:', error);
      const translatedMessage = translateApiError(error); // Spróbuj przetłumaczyć
      showToast({
          type: 'error',
          text1: 'Błąd resetu hasła',
          text2: translatedMessage, // Pokaż przetłumaczony lub oryginalny błąd
      });
      throw error; // Rzuć błąd dalej
    } finally {
      setIsLoading(false);
    }
  }, []);


  const authContextValue: AuthContextType = {
    userId,
    accessToken,
    isAuthenticated: !!accessToken && !!userId,
    isLoading,
    login,
    logout,
    register,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {/* Główny loader aplikacji jest teraz w AppInitializer */}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth musi być używane wewnątrz AuthProvider');
  }
  return context;
};