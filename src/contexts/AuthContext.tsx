import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native'; // Dodano ActivityIndicator
import authService from '../services/auth/authService'; // Importuj instancję AuthService
import authApi from '../services/api/authApi'; // Importuj authApi dla register i resetPassword
import { showToast } from '../components/Toast'; // Import showToast

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
  const [isLoading, setIsLoading] = useState(true); // Zaczynamy z ładowaniem

  // Sprawdzanie stanu autentykacji przy starcie
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
          // TODO: Tutaj można by uruchomić SyncService, jeśli potrzebne od razu
          // syncService.start();
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

  // Logowanie - używa authService
  const login = useCallback(async (loginValue: string, password: string) => {
    setIsLoading(true); // Pokaż loader podczas logowania
    try {
      const response = await authService.login(loginValue, password);
      // AuthService sam zapisuje tokeny, my tylko aktualizujemy stan kontekstu
      setAccessToken(response.access);
      setUserId(response.userId);
      showToast({ type: 'success', text1: 'Zalogowano pomyślnie!' });
      // TODO: Tutaj uruchomić SyncService
      // syncService.start();
    } catch (error: any) {
      console.error('[AuthContext] Błąd logowania:', error);
      // Pokaż błąd użytkownikowi
       showToast({
           type: 'error',
           text1: 'Błąd logowania',
           text2: error?.message || 'Nie udało się zalogować. Spróbuj ponownie.',
       });
      // Rzuć błąd, aby komponent UI mógł na niego zareagować (np. nie przekierować)
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Wylogowanie - używa authService
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: Zatrzymaj SyncService przed wylogowaniem
      // syncService.stop();
      await authService.logout();
      setAccessToken(null);
      setUserId(null);
      showToast({ type: 'info', text1: 'Wylogowano.' });
    } catch (error: any) {
      console.error('[AuthContext] Błąd wylogowania:', error);
       showToast({
           type: 'error',
           text1: 'Błąd wylogowania',
           text2: error?.message || 'Wystąpił problem podczas wylogowywania.',
       });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Rejestracja - używa authApi bezpośrednio (bo AuthService jej nie ma)
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
      showToast({
           type: 'error',
           text1: 'Błąd rejestracji',
           text2: error?.message || 'Nie udało się zarejestrować. Sprawdź dane i spróbuj ponownie.',
           visibilityTime: 5000,
       });
      throw error; // Rzuć błąd dalej
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reset hasła - używa authApi bezpośrednio
  const resetPassword = useCallback(async (email: string) => {
    setIsLoading(true);
    try {
      await authApi.resetPassword({ email });
      showToast({ type: 'success', text1: 'Sprawdź email', text2: 'Link do resetowania hasła został wysłany.' });
    } catch (error: any) {
      console.error('[AuthContext] Błąd resetowania hasła:', error);
      showToast({
           type: 'error',
           text1: 'Błąd resetu hasła',
           text2: error?.message || 'Nie udało się wysłać linku. Sprawdź adres email.',
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
      {isLoading ? <LoadingIndicator /> : children}
    </AuthContext.Provider>
  );
};

// Prosty komponent wskaźnika ładowania
const LoadingIndicator = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
    <ActivityIndicator size="large" color="#5c7ba9" />
    <Text style={{ marginTop: 10, color: '#666' }}>Ładowanie...</Text>
  </View>
);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth musi być używane wewnątrz AuthProvider');
  }
  return context;
};