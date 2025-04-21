// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import authService from '../services/auth/authService';
import authApi from '../services/api/authApi';
import { showToast, ToastMessage } from '../components/Toast';
// --- ZMIANA: Poprawny import ApiError ---
import { ApiError } from '../services/api/apiClient';
// ---------------------------------------
import { router } from 'expo-router';

// Mapowanie błędów API na polski
const specificApiErrorTranslations: Record<string, string> = {
  'No active account found with the given credentials': 'Nieprawidłowa nazwa użytkownika lub hasło.',
  'Unable to log in with provided credentials.': 'Nie można zalogować używając podanych danych.',
  'No user found with this email address.': 'Nie znaleziono użytkownika z tym adresem email.',
  'User with this username already exists.': 'Użytkownik o tej nazwie już istnieje.',
  'User with this email already exists.': 'Użytkownik z tym adresem email już istnieje.',
  // Dodaj więcej tłumaczeń specyficznych dla Twojego API
};

// Funkcja pomocnicza do tłumaczenia błędu API
const translateApiError = (error: any): string => {
  if (error instanceof ApiError) {
    if (error.message && specificApiErrorTranslations[error.message]) {
      return specificApiErrorTranslations[error.message];
    }
    if (error.data && typeof error.data === 'object') {
      const fieldErrors: string[] = [];
      for (const field in error.data) {
        const messages = error.data[field];
        if (Array.isArray(messages)) {
          messages.forEach(msg => {
            const translated = specificApiErrorTranslations[msg] || msg;
            fieldErrors.push(translated);
          });
        } else if (typeof messages === 'string') {
           const translated = specificApiErrorTranslations[messages] || messages;
           fieldErrors.push(translated);
        }
      }
      if (fieldErrors.length > 0) {
        return [...new Set(fieldErrors)].join(' ');
      }
    }
    // Zwróć oryginalną wiadomość, jeśli istnieje i nie jest pusta
    if (error.message) { return error.message; }
  }
  // Fallback dla innych typów błędów lub braku wiadomości w ApiError
  return 'Wystąpił nieoczekiwany błąd.';
};


interface AuthContextType {
  userId: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoggedIn: boolean;
  isAuthCheckLoading: boolean;
  sessionExpired: boolean;
  login: (loginValue: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string, password2: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resetSessionExpired: () => void;
  // --- Usunięto błędne callApiAuthenticated z interfejsu ---
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// --- POPRAWKA: Dodano `React.FC` i `return` ---
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
// ---------------------------------------------
  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthCheckLoading, setIsAuthCheckLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const handleSessionExpiredError = useCallback(() => {
      if (sessionExpired) return;
      console.log("[AuthContext] Obsługa błędu wygaśnięcia sesji.");
      setAccessToken(null);
      setSessionExpired(true);
      showToast({
          type: 'error',
          text1: 'Sesja wygasła',
          text2: 'Zaloguj się ponownie, aby kontynuować.',
          visibilityTime: 6000,
          position: 'bottom',
      });
      // Opcjonalna nawigacja
      // router.replace('/login');
  }, [sessionExpired]);

  useEffect(() => {
    const checkAuthState = async () => {
      console.log('[AuthContext] Sprawdzanie stanu autentykacji...');
      setIsAuthCheckLoading(true);
      setSessionExpired(false);
      try {
        const storedToken = await authService.getAccessToken();
        const storedUserId = await authService.getActiveUserId();
        const storedRefreshToken = await authService.getRefreshToken();

        if (storedUserId && !storedToken && !storedRefreshToken) {
             console.log('[AuthContext] Wykryto userId bez tokenów - oznaczanie sesji jako wygasłej.');
             setUserId(storedUserId);
             setAccessToken(null);
             setSessionExpired(true);
        } else if (storedToken && storedUserId) {
          console.log('[AuthContext] Znaleziono dane uwierzytelniające.');
          setAccessToken(storedToken);
          setUserId(storedUserId);
          setSessionExpired(false);
        } else {
          console.log('[AuthContext] Brak danych uwierzytelniających.');
          setAccessToken(null);
          setUserId(null);
          setSessionExpired(false);
        }
      } catch (error) {
        console.error('[AuthContext] Błąd podczas sprawdzania stanu uwierzytelnienia:', error);
        setAccessToken(null);
        setUserId(null);
        setSessionExpired(false);
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
      setUserId(String(response.user_id));
      setSessionExpired(false);
      showToast({ type: 'success', text1: 'Zalogowano pomyślnie!' });
    } catch (error: any) {
      console.error('[AuthContext] Błąd logowania:', error);
      if (error instanceof ApiError && error.isRefreshError) {
          handleSessionExpiredError();
      } else {
          const translatedMessage = translateApiError(error);
          showToast({ type: 'error', text1: 'Błąd logowania', text2: translatedMessage });
          setAccessToken(null);
          setUserId(null);
          setSessionExpired(false);
      }
      throw error;
    }
  }, [handleSessionExpiredError]);

  const logout = useCallback(async () => {
    console.log('[AuthContext] Rozpoczynanie procesu wylogowania w kontekście...');
    try {
      await authService.logout();
      setAccessToken(null);
      setUserId(null);
      setSessionExpired(false);
      console.log('[AuthContext] Wylogowano pomyślnie (stan kontekstu zresetowany).');
      showToast({ type: 'info', text1: 'Wylogowano'});
      router.replace('/login');
    } catch (error) {
      console.error('[AuthContext] Błąd podczas wywoływania authService.logout:', error);
      setAccessToken(null);
      setUserId(null);
      setSessionExpired(false);
      showToast({ type: 'error', text1: 'Błąd', text2: 'Wystąpił błąd podczas wylogowywania.' });
      router.replace('/login');
    }
  }, []);

  const resetSessionExpired = useCallback(() => {
      console.log('[AuthContext] Resetowanie flagi sessionExpired.');
      setSessionExpired(false);
  }, []);

  // --- POPRAWKA: Usunięto async i T, poprawiono logikę catch ---
  const register = useCallback(async (username: string, email: string, password: string, password2: string) => {
    try {
      if (password !== password2) throw new Error('Hasła nie są identyczne.');
      await authApi.register({ username, email, password, password2 });
      showToast({
        type: 'success',
        text1: 'Rejestracja udana',
        text2: 'Link aktywacyjny został wysłany na Twój email.',
        visibilityTime: 5000,
      });
    } catch (error: any) {
      // Sprawdź błąd sesji (chociaż mało prawdopodobne przy rejestracji)
      if (error instanceof ApiError && error.isRefreshError) {
          handleSessionExpiredError();
      } else {
          // Normalna obsługa błędu rejestracji
          console.error('[AuthContext] Błąd rejestracji:', error);
          const translatedMessage = translateApiError(error);
          showToast({ type: 'error', text1: 'Błąd rejestracji', text2: translatedMessage });
      }
      // --- POPRAWKA: Przenieś throw na koniec catch ---
      throw error; // Rzuć błąd dalej, aby komponent UI wiedział
      // --------------------------------------------
    }
  }, [handleSessionExpiredError]);

  // --- POPRAWKA: Usunięto async i T, poprawiono logikę catch ---
  const resetPassword = useCallback(async (email: string) => {
    try {
      await authApi.resetPassword({ email });
      showToast({ type: 'success', text1: 'Sprawdź email', text2: 'Link do resetowania hasła został wysłany.' });
    } catch (error: any) {
       // Sprawdź błąd sesji (mało prawdopodobne przy resecie hasła)
       if (error instanceof ApiError && error.isRefreshError) {
           handleSessionExpiredError();
       } else {
           // Normalna obsługa błędu resetu
           console.error('[AuthContext] Błąd resetowania hasła:', error);
           const translatedMessage = translateApiError(error);
           showToast({ type: 'error', text1: 'Błąd resetu hasła', text2: translatedMessage });
       }
       // --- POPRAWKA: Przenieś throw na koniec catch ---
      throw error; // Rzuć błąd dalej
      // --------------------------------------------
    }
  }, [handleSessionExpiredError]);

  // --- Usunięto błędną funkcję callApiAuthenticated ---

  const authContextValue: AuthContextType = {
    // --- POPRAWKA: Użyj jawnego przypisania `key: value` ---
    userId: userId,
    accessToken: accessToken,
    isAuthenticated: !!accessToken && !!userId && !sessionExpired,
    isLoggedIn: !!userId,
    isAuthCheckLoading: isAuthCheckLoading,
    sessionExpired: sessionExpired,
    login: login,
    logout: logout,
    register: register,
    resetPassword: resetPassword,
    resetSessionExpired: resetSessionExpired,
    // --------------------------------------------------
  };

  // --- POPRAWKA: Dodano return ---
  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
  // -----------------------------
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth musi być używane wewnątrz AuthProvider');
  }
  return context;
};