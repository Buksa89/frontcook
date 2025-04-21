// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import authService from '../services/auth/authService';
import authApi from '../services/api/authApi';
import { showToast, ToastMessage } from '../components/Toast';
import { ApiError } from '../services/api/apiClient'; // Importujemy nasz ApiError
import { router } from 'expo-router';
import AuthStorage from '../services/auth/authStorage'; // Potrzebne do czyszczenia tokenów

// Tłumaczenia błędów (bez zmian)
const specificApiErrorTranslations: Record<string, string> = {
  'No active account found with the given credentials': 'Nieprawidłowa nazwa użytkownika lub hasło.',
  'Unable to log in with provided credentials.': 'Nie można zalogować używając podanych danych.',
  'No user found with this email address.': 'Nie znaleziono użytkownika z tym adresem email.',
  'User with this username already exists.': 'Użytkownik o tej nazwie już istnieje.',
  'User with this email already exists.': 'Użytkownik z tym adresem email już istnieje.',
  'Sesja wygasła lub token jest nieprawidłowy.': 'Sesja wygasła. Zaloguj się ponownie.',
};
const translateApiError = (error: any): string => {
  if (error instanceof ApiError) {
    if (error.isRefreshError) { // Specjalny komunikat dla błędu sesji
        return 'Sesja wygasła. Zaloguj się ponownie.';
    }
    if (error.message && specificApiErrorTranslations[error.message]) { return specificApiErrorTranslations[error.message]; }
    if (error.data && typeof error.data === 'object') {
      const fieldErrors: string[] = [];
      for (const field in error.data) {
        const messages = error.data[field];
        if (Array.isArray(messages)) { messages.forEach(msg => { const translated = specificApiErrorTranslations[msg] || msg; fieldErrors.push(translated); }); }
        else if (typeof messages === 'string') { const translated = specificApiErrorTranslations[messages] || messages; fieldErrors.push(translated); }
      }
      if (fieldErrors.length > 0) { return [...new Set(fieldErrors)].join(' '); }
    }
    if (error.message) { return error.message; }
  }
  return 'Wystąpił nieoczekiwany błąd.';
};


// Zaktualizowany interfejs kontekstu
interface AuthContextType {
  userId: string | null;           // ID użytkownika (zachowane nawet po wygaśnięciu sesji)
  accessToken: string | null;      // Token dostępu (null gdy sesja wygasła)
  isAuthenticated: boolean;        // Czy ma ważny accessToken I userId (nie wygasła sesja)
  isLoggedIn: boolean;             // Czy ma userId (nawet jeśli sesja wygasła)
  isAuthCheckLoading: boolean;     // Czy trwa inicjalne sprawdzanie stanu
  sessionExpired: boolean;         // Czy sesja wygasła (refresh token nie działa)
  login: (loginValue: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string, password2: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resetSessionExpired: () => void; // Funkcja do resetowania flagi wygaśnięcia (np. po wylogowaniu)
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps { children: ReactNode; }

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthCheckLoading, setIsAuthCheckLoading] = useState(true);
  // --- NOWY STAN ---
  const [sessionExpired, setSessionExpired] = useState(false);
  // ---------------

  // Funkcja obsługująca błąd wygaśnięcia sesji
  const handleSessionExpiredError = useCallback(async () => {
    if (sessionExpired) return; // Już obsłużone
    console.log("[AuthContext] Obsługa błędu wygaśnięcia sesji.");
    setAccessToken(null); // Usuń tylko access token
    setSessionExpired(true); // Ustaw flagę wygaśnięcia
    // Czyść tylko tokeny, zostaw userId
    await AuthStorage.clearAccessToken();
    await AuthStorage.clearRefreshToken();
    console.log("[AuthContext] Tokeny wyczyszczone, userId zachowane.");
    showToast({
      type: 'error',
      text1: 'Sesja wygasła',
      text2: 'Zaloguj się ponownie, aby synchronizować dane.',
      visibilityTime: 6000, // Dłuższy czas widoczności
      position: 'bottom',
    });
    // Nie nawigujemy automatycznie, użytkownik może pracować offline
  }, [sessionExpired]); // Zależność od sessionExpired

  // Sprawdzanie stanu przy starcie aplikacji
  useEffect(() => {
    const checkAuthState = async () => {
      console.log('[AuthContext] Sprawdzanie stanu autentykacji...');
      setIsAuthCheckLoading(true);
      setSessionExpired(false); // Resetuj na początku
      try {
        const storedUserId = await authService.getActiveUserId();
        const storedToken = await authService.getAccessToken(); // Sprawdź access token
        const storedRefreshToken = await authService.getRefreshToken(); // Sprawdź refresh token

        if (storedUserId) {
          setUserId(storedUserId); // Mamy ID użytkownika - jest zalogowany lokalnie
          if (storedToken) {
            // Mamy access token - zakładamy, że sesja jest ważna (apiClient zweryfikuje przy pierwszym zapytaniu)
            setAccessToken(storedToken);
            setSessionExpired(false);
            console.log('[AuthContext] Znaleziono UserId i Access Token. Sesja prawdopodobnie ważna.');
          } else if (storedRefreshToken) {
             // Mamy userId i refresh token, ale nie access token - spróbujmy odświeżyć od razu?
             // Alternatywnie, poczekajmy na pierwsze zapytanie API. Na razie oznaczmy jako OK.
             console.warn('[AuthContext] Znaleziono UserId i Refresh Token, brak Access Tokena. Odświeżenie nastąpi przy zapytaniu API.');
             setAccessToken(null);
             setSessionExpired(false); // Zakładamy, że refresh zadziała
          } else {
            // Mamy userId, ale brak jakichkolwiek tokenów - sesja wygasła
            console.log('[AuthContext] Znaleziono UserId, ale brak tokenów. Sesja wygasła.');
            setAccessToken(null);
            setSessionExpired(true);
          }
        } else {
          // Brak userId - użytkownik wylogowany
          console.log('[AuthContext] Brak danych uwierzytelniających (brak UserId).');
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
  }, []); // Wykonaj tylko raz

  // Logowanie
  const login = useCallback(async (loginValue: string, password: string) => {
    try {
      const response = await authService.login(loginValue, password);
      setAccessToken(response.access);
      setUserId(String(response.user_id));
      setSessionExpired(false); // Sesja jest teraz na pewno ważna
      showToast({ type: 'success', text1: 'Zalogowano pomyślnie!' });
      // Nawigacja powinna być obsłużona w komponencie LoginScreen po sukcesie
    } catch (error: any) {
      console.error('[AuthContext] Błąd logowania:', error);
      // Sprawdź czy to błąd sesji (chociaż przy login() to mniej prawdopodobne)
      if (error instanceof ApiError && error.isRefreshError) {
          await handleSessionExpiredError(); // Obsłuż wygaśnięcie (choć tu dziwne)
      } else {
          const translatedMessage = translateApiError(error);
          showToast({ type: 'error', text1: 'Błąd logowania', text2: translatedMessage });
          // Nie czyścimy userId tutaj, jeśli logowanie się nie powiodło
      }
      throw error; // Rzuć błąd dalej, aby komponent wiedział
    }
  }, [handleSessionExpiredError]);

  // Wylogowanie
  const logout = useCallback(async () => {
    console.log('[AuthContext] Rozpoczynanie procesu wylogowania w kontekście...');
    try {
      await authService.logout(); // Wywołaj serwis, który próbuje sync, API logout i czyści storage
      setAccessToken(null);
      setUserId(null);
      setSessionExpired(false); // Po pełnym wylogowaniu sesja nie jest "wygasła", tylko jej nie ma
      console.log('[AuthContext] Wylogowano pomyślnie (stan kontekstu zresetowany).');
      showToast({ type: 'info', text1: 'Wylogowano'});
      router.replace('/login'); // Przekieruj na logowanie
    } catch (error) {
      // Błędy z authService (np. błąd API logout) są już tam obsłużone (ostrzeżenia)
      // Tutaj upewniamy się, że stan lokalny jest czysty
      console.error('[AuthContext] Błąd podczas pełnego procesu wylogowania (stan lokalny wyczyszczony):', error);
      setAccessToken(null);
      setUserId(null);
      setSessionExpired(false);
      showToast({ type: 'error', text1: 'Błąd', text2: 'Wystąpił błąd podczas wylogowywania.' });
      router.replace('/login');
    }
  }, []);

  // Rejestracja
  const register = useCallback(async (username: string, email: string, password: string, password2: string) => {
    try {
      if (password !== password2) throw new Error('Hasła nie są identyczne.');
      await authApi.register({ username, email, password, password2 });
      showToast({ type: 'success', text1: 'Rejestracja udana', text2: 'Link aktywacyjny został wysłany na Twój email.', visibilityTime: 5000, });
    } catch (error: any) {
      if (error instanceof ApiError && error.isRefreshError) {
          await handleSessionExpiredError(); // Mało prawdopodobne, ale obsłuż
      } else {
          console.error('[AuthContext] Błąd rejestracji:', error);
          const translatedMessage = translateApiError(error);
          showToast({ type: 'error', text1: 'Błąd rejestracji', text2: translatedMessage });
      }
      throw error;
    }
  }, [handleSessionExpiredError]);

  // Reset hasła
  const resetPassword = useCallback(async (email: string) => {
    try {
      await authApi.resetPassword({ email });
      showToast({ type: 'success', text1: 'Sprawdź email', text2: 'Link do resetowania hasła został wysłany.' });
    } catch (error: any) {
       if (error instanceof ApiError && error.isRefreshError) {
           await handleSessionExpiredError(); // Mało prawdopodobne, ale obsłuż
       } else {
           console.error('[AuthContext] Błąd resetowania hasła:', error);
           const translatedMessage = translateApiError(error);
           showToast({ type: 'error', text1: 'Błąd resetu hasła', text2: translatedMessage });
       }
      throw error;
    }
  }, [handleSessionExpiredError]);

  // Resetowanie flagi wygaśnięcia sesji
  const resetSessionExpired = useCallback(() => {
      console.log('[AuthContext] Resetowanie flagi sessionExpired.');
      if(sessionExpired) {
        setSessionExpired(false);
      }
  }, [sessionExpired]);

  // Wartość kontekstu
  const authContextValue: AuthContextType = {
    userId: userId,
    accessToken: accessToken,
    isAuthenticated: !!accessToken && !!userId && !sessionExpired, // Musi być token, ID i sesja NIE wygasła
    isLoggedIn: !!userId, // Wystarczy ID użytkownika
    isAuthCheckLoading: isAuthCheckLoading,
    sessionExpired: sessionExpired,
    login: login,
    logout: logout,
    register: register,
    resetPassword: resetPassword,
    resetSessionExpired: resetSessionExpired,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook useAuth bez zmian
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth musi być używane wewnątrz AuthProvider');
  }
  return context;
};