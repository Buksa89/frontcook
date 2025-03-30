import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AuthService from '../services/auth/authService';
import { AuthApi } from '../api/auth';
import AuthStorage from '../services/auth/authStorage';
import api from '../api';
import LocalSyncService from '../services/sync/LocalSyncService';
import { Alert } from 'react-native';
import syncService from '../services/sync/syncService';
import Toast, { showToast } from '../components/Toast';

interface AuthContextType {
  active_user: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  register: (username: string, email: string, password: string, password2: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Ustawienie handlera refreshToken i gettera accessToken w API podczas inicjalizacji
  useEffect(() => {
    api.setRefreshTokenHandler(refreshToken);
    const tokenGetter = async () => accessToken;
    const userGetter = async () => activeUser;
    api.setAccessTokenGetter(tokenGetter);
    // Comment out calls to non-existent methods in syncService
    // syncService.setAccessTokenGetter(tokenGetter);
    // syncService.setActiveUserGetter(userGetter);

    // Start sync if we have both token and user
    if (accessToken && activeUser) {
      // Update to match the implementation without parameters
      syncService.startBackgroundSync();
    }
  }, [accessToken, activeUser]);

  // Pobieranie danych autoryzacyjnych z storage przy starcie aplikacji
  useEffect(() => {
    const fetchAuthData = async () => {
      try {
        const { accessToken, activeUser } = await AuthService.getAuthData();
        if (accessToken && activeUser) {
          setAccessToken(accessToken);
          setActiveUser(activeUser);
        }
      } catch (error) {
        console.error('[AuthContext] Błąd podczas pobierania danych logowania:', error);
      }
    };
    fetchAuthData();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      // Wywołanie API logowania
      const response = await AuthApi.login({ username, password });
      
      // Zapisanie danych logowania w storage
      await AuthService.login(response.access, response.refresh, response.username);
      
      // Zapisanie danych w kontekście
      setAccessToken(response.access);
      setActiveUser(response.username);

      // Sprawdzenie, czy istnieją lokalne dane do synchronizacji
      const hasLocalData = await LocalSyncService.isLocalDataToSync();
      
      if (hasLocalData) {
        // Wyświetlenie zapytania użytkownikowi
        Alert.alert(
          'Lokalne dane',
          'Wykryto lokalne dane bez przypisanego użytkownika. Czy chcesz przypisać je do swojego konta?',
          [
            {
              text: 'Nie',
              style: 'cancel'
            },
            {
              text: 'Tak',
              onPress: async () => {
                try {
                  await LocalSyncService.assignLocalDataToUser(response.username);
                  showToast({
                    type: 'success',
                    text1: 'Sukces',
                    text2: 'Lokalne dane zostały przypisane do Twojego konta.',
                    visibilityTime: 3000,
                    position: 'bottom'
                  });
                } catch (error) {
                  console.error('[AuthContext] Błąd podczas przypisywania lokalnych danych:', error);
                  showToast({
                    type: 'error',
                    text1: 'Błąd',
                    text2: 'Nie udało się przypisać lokalnych danych do Twojego konta.',
                    visibilityTime: 4000,
                    position: 'bottom'
                  });
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      // Don't log authentication errors to the console
      // Instead, we just propagate them to the UI component
      throw error; // Przekazujemy błąd dalej, aby komponent mógł go obsłużyć
    }
  };

  const register = async (username: string, email: string, password: string, password2: string) => {
    try {
      // Sprawdzenie czy hasła się zgadzają
      if (password !== password2) {
        throw new Error('Hasła nie są identyczne');
      }

      // Wywołanie API rejestracji
      await AuthApi.register({
        username,
        email,
        password,
        password2
      });

      // Zwracamy informację o konieczności aktywacji konta
      showToast({
        type: 'success',
        text1: 'Rejestracja udana',
        text2: 'Na podany adres email został wysłany link aktywacyjny. Aktywuj konto, aby się zalogować.',
        visibilityTime: 4000,
        position: 'bottom'
      });
    } catch (error) {
      console.error('[AuthContext] Błąd podczas rejestracji:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Stop background sync before logout
      syncService.stopBackgroundSync();
      
      // Pobierz tokeny przed wyczyszczeniem
      const refreshToken = await AuthStorage.retrieveRefreshToken();
      const currentAccessToken = accessToken;

      if (refreshToken && currentAccessToken) {
        // Wywołaj API wylogowania
        await AuthApi.logout(refreshToken, currentAccessToken);
      }

      // Wyczyść dane w storage
      await AuthService.logout();
      
      // Wyczyść stan w kontekście
      setAccessToken(null);
      setActiveUser(null);
    } catch (error) {
      console.error('[AuthContext] Błąd podczas wylogowywania:', error);
      // Nawet jeśli API wylogowania nie powiedzie się, i tak czyścimy lokalne dane
      await AuthService.logout();
      setAccessToken(null);
      setActiveUser(null);
      throw error;
    }
  };

  const refreshToken = async (): Promise<string | null> => {
    try {
      const refreshToken = await AuthStorage.retrieveRefreshToken();
      
      if (!refreshToken) {
        console.warn('[AuthContext] Brak refresh tokena, wymagane ponowne logowanie');
        return null;
      }

      // Wywołaj API odświeżania tokenu
      const response = await AuthApi.refreshToken(refreshToken);
      
      // Zapisz nowe tokeny
      await AuthStorage.storeAccessToken(response.access);
      await AuthStorage.storeRefreshToken(response.refresh);
      
      // Zaktualizuj stan w kontekście
      setAccessToken(response.access);
      
      return response.access;
    } catch (error) {
      console.error('[AuthContext] Błąd podczas odświeżania tokenu:', error);
      // Wyczyść tylko tokeny, bez pełnego wylogowania
      await AuthStorage.clearAccessToken();
      await AuthStorage.clearRefreshToken();
      setAccessToken(null);
      
      showToast({
        type: 'error',
        text1: 'Sesja wygasła',
        text2: 'Twoja sesja wygasła. Zaloguj się ponownie.',
        visibilityTime: 4000,
        position: 'bottom'
      });
      return null;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await AuthApi.resetPassword({ email });
      showToast({
        type: 'success',
        text1: 'Link wysłany',
        text2: 'Link do resetowania hasła został wysłany na podany adres email.',
        visibilityTime: 3000,
        position: 'bottom'
      });
    } catch (error) {
      console.error('[AuthContext] Błąd podczas resetowania hasła:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      active_user: activeUser, 
      accessToken,
      isAuthenticated: !!accessToken, 
      login, 
      logout, 
      refreshToken,
      register,
      resetPassword 
    }}>
      {children}
      <Toast />
    </AuthContext.Provider>
  );
};

// Hook do używania kontekstu w komponentach
export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
