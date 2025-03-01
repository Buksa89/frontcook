import React, { createContext, useState, useEffect, useContext } from 'react';
import authService from '../services/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<{ success: boolean; message?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Sprawdź, czy użytkownik jest zalogowany przy starcie aplikacji
    const checkAuthStatus = async () => {
      try {
        const isAuth = await authService.isAuthenticated();
        setIsAuthenticated(isAuth);
      } catch (error) {
        console.error('Błąd podczas sprawdzania statusu uwierzytelnienia:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const result = await authService.login(username, password);
      if (result.success) {
        setIsAuthenticated(true);
      }
      return result;
    } catch (error) {
      console.error('Błąd podczas logowania:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Wystąpił nieznany błąd podczas logowania' 
      };
    }
  };

  const logout = async () => {
    try {
      const result = await authService.logout();
      if (result.success) {
        setIsAuthenticated(false);
      }
      return result;
    } catch (error) {
      console.error('Błąd podczas wylogowywania:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Wystąpił nieznany błąd podczas wylogowywania' 
      };
    }
  };

  const register = async (username: string, email: string, password: string) => {
    return authService.register(username, email, password);
  };

  const resetPassword = async (email: string) => {
    return authService.resetPassword(email);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        login,
        logout,
        register,
        resetPassword
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