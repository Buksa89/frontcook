// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import authService from '../services/auth/authService';
import authApi from '../services/api/authApi';
import { showToast, ToastMessage } from '../components/Toast'; // Importuj również typ ToastMessage
import { ApiError } from '../services/api/apiClient'; // Importuj ApiError

// Mapowanie *specyficznych* komunikatów błędów na polski
const specificApiErrorTranslations: Record<string, string> = {
  'No active account found with the given credentials': 'Nieprawidłowa nazwa użytkownika lub hasło.',
  'Unable to log in with provided credentials.': 'Nie można zalogować używając podanych danych.',
  'No user found with this email address.': 'Nie znaleziono użytkownika z tym adresem email.',
  // --- Dodaj tutaj więcej specyficznych tłumaczeń dla błędów zwracanych przez Twoje API ---
  // np. 'User with this email already exists.': 'Użytkownik z tym adresem email już istnieje.',
  // np. 'Password must contain at least 8 characters.': 'Hasło musi zawierać co najmniej 8 znaków.',
};

// Funkcja pomocnicza do tłumaczenia błędu API
const translateApiError = (error: any): string => {
  // Sprawdź, czy to nasz ApiError
  if (error instanceof ApiError) {
    // 1. Spróbuj przetłumaczyć główną wiadomość błędu
    if (error.message && specificApiErrorTranslations[error.message]) {
      return specificApiErrorTranslations[error.message];
    }

    // 2. Sprawdź, czy błąd zawiera dane z polami (typowe dla DRF)
    if (error.data && typeof error.data === 'object') {
      const fieldErrors: string[] = [];
      // Iteruj po polach błędów (np. 'email', 'password', 'non_field_errors')
      for (const field in error.data) {
        const messages = error.data[field];
        if (Array.isArray(messages)) {
          // Spróbuj przetłumaczyć każdą wiadomość dla pola
          messages.forEach(msg => {
            const translated = specificApiErrorTranslations[msg];
            fieldErrors.push(translated || msg); // Dodaj przetłumaczoną lub oryginalną
          });
        } else if (typeof messages === 'string') {
          // Jeśli wiadomość dla pola jest stringiem
           const translated = specificApiErrorTranslations[messages];
           fieldErrors.push(translated || messages);
        }
      }
      // Jeśli znaleziono błędy pól, połącz je
      if (fieldErrors.length > 0) {
        // Usuń duplikaty, jeśli API zwraca ten sam błąd dla wielu pól
        return [...new Set(fieldErrors)].join(' '); // Połącz spacją lub \n
      }
    }

    // 3. Jeśli nie znaleziono tłumaczenia ani błędów pól, zwróć oryginalną wiadomość (jeśli istnieje)
    if (error.message) {
      return error.message;
    }
  }

  // 4. Domyślny komunikat dla innych typów błędów
  return 'Wystąpił nieoczekiwany błąd.';
};


interface AuthContextType {
  userId: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isAuthCheckLoading: boolean; // Tylko dla początkowego sprawdzenia
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
  const [isAuthCheckLoading, setIsAuthCheckLoading] = useState(true);

  useEffect(() => {
    const checkAuthState = async () => {
      console.log('[AuthContext] Sprawdzanie stanu autentykacji...');
      setIsAuthCheckLoading(true);
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
        setIsAuthCheckLoading(false);
        console.log('[AuthContext] Sprawdzanie stanu autentykacji zakończone.');
      }
    };
    checkAuthState();
  }, []);

  const login = useCallback(async (loginValue: string, password: string) => {
    try {
      const response = await authService.login(loginValue, password);
      setAccessToken(response.access);
      setUserId(String(response.user_id)); // Konwersja na string
      showToast({ type: 'success', text1: 'Zalogowano pomyślnie!' });
    } catch (error: any) {
      console.error('[AuthContext] Błąd logowania:', error);
      const translatedMessage = translateApiError(error);
      showToast({
          type: 'error',
          text1: 'Błąd logowania',
          text2: translatedMessage,
      });
      setAccessToken(null);
      setUserId(null);
      throw error; // Rzuć błąd, aby komponent UI wiedział o niepowodzeniu
    }
  }, []);

  const logout = useCallback(async () => {
    console.log('[AuthContext] Rozpoczynanie procesu wylogowania w kontekście...');
    try {
      await authService.logout();
      setAccessToken(null);
      setUserId(null);
      console.log('[AuthContext] Wylogowano pomyślnie (stan kontekstu zresetowany).');
      // Toast sukcesu jest teraz w authService/authApi
    } catch (error) {
      console.error('[AuthContext] Błąd podczas wywoływania authService.logout:', error);
      setAccessToken(null);
      setUserId(null);
      showToast({ type: 'error', text1: 'Błąd', text2: 'Wystąpił błąd podczas wylogowywania.' });
    }
  }, []);

  const register = useCallback(async (username: string, email: string, password: string, password2: string) => {
    try {
      if (password !== password2) throw new Error('Hasła nie są identyczne');
      await authApi.register({ username, email, password, password2 });
      // Toast sukcesu dla rejestracji jest nadal tutaj
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
      throw error; // Rzuć błąd dalej, aby RegisterScreen wiedział o niepowodzeniu
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await authApi.resetPassword({ email });
      showToast({ type: 'success', text1: 'Sprawdź email', text2: 'Link do resetowania hasła został wysłany.' });
    } catch (error: any) {
      console.error('[AuthContext] Błąd resetowania hasła:', error);
      // Użyj nowej funkcji tłumaczącej
      const translatedMessage = translateApiError(error);
      showToast({
          type: 'error',
          text1: 'Błąd resetu hasła',
          text2: translatedMessage, // Wyświetl przetłumaczony komunikat
      });
      throw error; // Rzuć błąd dalej, aby ForgotPasswordScreen wiedział o niepowodzeniu
    }
  }, []);


  const authContextValue: AuthContextType = {
    userId,
    accessToken,
    isAuthenticated: !!accessToken && !!userId,
    isAuthCheckLoading, // Przekaż poprawny stan
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

// Usunięto komponent LoadingIndicator - jest teraz w App.tsx