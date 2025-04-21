// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import authService from '../services/auth/authService';
import authApi from '../services/api/authApi';
import { showToast } from '../components/Toast';
import { ApiError } from '../services/api/apiClient'; // Importuj ApiError

// Mapowanie znanych błędów API na polskie komunikaty
const apiErrorTranslations: Record<string, string> = {
  'No active account found with the given credentials': 'Nieprawidłowa nazwa użytkownika lub hasło.',
  'Unable to log in with provided credentials.': 'Nie można zalogować używając podanych danych.',
  // Dodaj więcej tłumaczeń dla innych możliwych błędów z Twojego API
};

// Funkcja pomocnicza do tłumaczenia błędu
const translateApiError = (error: any): string => {
  if (error instanceof ApiError && error.message) {
    // Spróbuj znaleźć tłumaczenie dla wiadomości błędu
    const translated = apiErrorTranslations[error.message];
    if (translated) {
      return translated;
    }
    // Jeśli nie ma tłumaczenia, zwróć oryginalną wiadomość
    // (lub bardziej generyczny komunikat, jeśli wolisz nie pokazywać tech. detali)
    return error.message;
  }
  // Domyślny komunikat dla innych typów błędów
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
    // ... (logika checkAuthState bez zmian) ...
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
    setIsLoading(true);
    try {
      const response = await authService.login(loginValue, password);
      setAccessToken(response.access);
      setUserId(String(response.user_id)); // Pamiętaj o konwersji na string, jeśli user_id z API to number
      showToast({ type: 'success', text1: 'Zalogowano pomyślnie!' });
    } catch (error: any) {
      console.error('[AuthContext] Błąd logowania:', error);
      // --- ZMIANA: Użyj funkcji tłumaczącej ---
      const translatedMessage = translateApiError(error);
      showToast({
          type: 'error',
          text1: 'Błąd logowania',
          text2: translatedMessage, // Wyświetl przetłumaczony komunikat
      });
      // --- KONIEC ZMIANY ---
      throw error; // Rzuć błąd, aby LoginScreen wiedział o niepowodzeniu
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ... (logout, register, resetPassword - bez zmian w logice, ale mogą też skorzystać z translateApiError, jeśli API zwraca błędy)

  const logout = useCallback(async () => { /* ... bez zmian ... */ }, []);
  const register = useCallback(async (username: string, email: string, password: string, password2: string) => { /* ... bez zmian ... */ }, []);
  const resetPassword = useCallback(async (email: string) => { /* ... bez zmian ... */ }, []);

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
      {/* Usunięto warunkowe renderowanie loadera - AppInitializer teraz to robi */}
      {children}
    </AuthContext.Provider>
  );
};

// Komponent LoadingIndicator nie jest już potrzebny tutaj
// const LoadingIndicator = () => ( ... );

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth musi być używane wewnątrz AuthProvider');
  }
  return context;
};