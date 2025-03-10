import React, { createContext, useState, useEffect, useContext } from 'react';
import { saveAccessToken, saveRefreshToken, getAccessToken, getRefreshToken, saveActiveUser, getActiveUser, clearAuthData } from '../services/auth/authStorage';
import { authApi } from '../api';
import { refreshAccessToken } from '../services/auth/refreshTokens';
import { ApiError } from '../api/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  activeUser: string | null;
  accessToken: string | null;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signOut: () => Promise<{ success: boolean; message?: string }>;
  refreshToken: () => Promise<string | null>;
  getUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Inicjalizacja kontekstu
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const [token, username] = await Promise.all([
          getAccessToken(),
          getActiveUser()
        ]);

        if (token && username) {
          setAccessToken(token);
          setActiveUser(username.username);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Błąd podczas inicjalizacji auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ username: email, password });
      
      if (response?.access && response?.refresh) {
        // Zapisz tokeny
        await Promise.all([
          saveAccessToken(response.access),
          saveRefreshToken(response.refresh)
        ]);

        // Zapisz dane użytkownika
        await saveActiveUser({ username: response.username });

        // Zaktualizuj stan kontekstu
        setAccessToken(response.access);
        setActiveUser(response.username);
        setIsAuthenticated(true);

        return { success: true };
      }
      
      return { 
        success: false, 
        message: 'Nieprawidłowa odpowiedź z serwera' 
      };
    } catch (error) {
      console.error('Błąd podczas logowania:', error);
      
      if (error instanceof ApiError) {
        if (error.status === 401) {
          return { 
            success: false, 
            message: 'Nieprawidłowa nazwa użytkownika lub hasło' 
          };
        }
        
        return { 
          success: false, 
          message: error.message 
        };
      }
      
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Wystąpił nieznany błąd podczas logowania' 
      };
    }
  };

  const signOut = async () => {
    try {
      // Pobierz tokeny
      const [currentAccessToken, refreshToken] = await Promise.all([
        getAccessToken(),
        getRefreshToken()
      ]);
      
      // Wywołaj API do wylogowania, jeśli mamy oba tokeny
      if (refreshToken && currentAccessToken) {
        try {
          await authApi.logout(refreshToken, currentAccessToken);
        } catch (error) {
          console.warn('Błąd podczas wylogowywania na serwerze:', error);
          // Ignorujemy błędy z API - zawsze wylogowujemy lokalnie
        }
      }

      // Wyczyść wszystkie dane uwierzytelniania
      await clearAuthData();
      
      // Wyczyść stan kontekstu
      setAccessToken(null);
      setActiveUser(null);
      setIsAuthenticated(false);

      return {
        success: true,
        message: 'Wylogowano pomyślnie'
      };
    } catch (error) {
      console.error('Błąd podczas wylogowywania:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Wystąpił nieznany błąd podczas wylogowywania'
      };
    }
  };

  const refreshToken = async () => {
    const newToken = await refreshAccessToken();
    if (newToken) {
      setAccessToken(newToken);
      return newToken;
    }
    return null;
  };

  const getUser = async () => {
    try {
      const userData = await getActiveUser();
      if (userData?.username) {
        setActiveUser(userData.username);
      }
    } catch (error) {
      console.error('Błąd podczas pobierania danych użytkownika:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        activeUser,
        accessToken,
        signIn,
        signOut,
        refreshToken,
        getUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 