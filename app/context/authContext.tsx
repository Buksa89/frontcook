import React, { createContext, useState, useEffect, useContext } from 'react';
import { Alert } from 'react-native';
import authService from '../services/auth';
import { asyncStorageService } from '../services/storage';
import database from '../../database';
import { Q } from '@nozbe/watermelondb';
import syncService from '../services/sync/syncService';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  activeUser: string | null;
  reloadKey: number;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<{ success: boolean; message?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; message?: string; fieldErrors?: Record<string, string[]> }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string; fieldErrors?: Record<string, string[]> }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  // Funkcja do sprawdzania i przypisywania lokalnych danych do użytkownika
  const checkAndAssignLocalDataToUser = async (username: string) => {
    try {
      // Sprawdź czy istnieją lokalne dane bez właściciela
      const tables = ['recipes', 'ingredients', 'tags', 'shopping_items', 'user_settings'];
      let hasLocalData = false;

      for (const table of tables) {
        const localData = await database.get(table).query(
          Q.where('owner', null),
          Q.where('is_deleted', false)
        ).fetch();

        if (localData.length > 0) {
          hasLocalData = true;
          break;
        }
      }

      if (hasLocalData) {
        // Pokaż alert z pytaniem o synchronizację
        return new Promise((resolve) => {
          Alert.alert(
            'Synchronizacja danych',
            'Wykryto lokalne dane. Czy chcesz przypisać je do swojego konta?',
            [
              {
                text: 'Nie',
                style: 'cancel',
                onPress: () => resolve(false)
              },
              {
                text: 'Tak',
                onPress: async () => {
                  // Aktualizuj właściciela dla wszystkich lokalnych danych
                  await database.write(async () => {
                    for (const table of tables) {
                      const localData = await database.get(table).query(
                        Q.where('owner', null),
                        Q.where('is_deleted', false)
                      ).fetch();

                      for (const record of localData) {
                        await record.update(item => {
                          item.owner = username;
                        });
                      }
                    }
                  });
                  resolve(true);
                }
              }
            ]
          );
        });
      }
    } catch (error) {
      console.error('Błąd podczas sprawdzania lokalnych danych:', error);
    }
  };

  useEffect(() => {
    // Sprawdź, czy użytkownik jest zalogowany przy starcie aplikacji
    const checkAuthStatus = async () => {
      try {
        const isAuth = await authService.isAuthenticated();
        setIsAuthenticated(isAuth);
        
        // Pobierz nazwę aktywnego użytkownika
        if (isAuth) {
          const username = await asyncStorageService.getActiveUser();
          setActiveUser(username);
          // Uruchom synchronizację w tle dla zalogowanego użytkownika
          syncService.startBackgroundSync(username);
        }
      } catch (error) {
        console.error('Błąd podczas sprawdzania statusu uwierzytelnienia:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();

    // Cleanup przy odmontowaniu komponentu
    return () => {
      syncService.stopBackgroundSync();
    };
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const result = await authService.login(username, password);
      
      if (result.success) {
        setIsAuthenticated(true);
        
        // Pobierz nazwę aktywnego użytkownika po zalogowaniu
        const activeUsername = await asyncStorageService.getActiveUser();
        setActiveUser(activeUsername);

        // Sprawdź i przypisz lokalne dane do użytkownika
        await checkAndAssignLocalDataToUser(activeUsername);
        
        // Uruchom synchronizację w tle
        syncService.startBackgroundSync(activeUsername);
        
        setReloadKey(prev => prev + 1);
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
        // Zatrzymaj synchronizację w tle
        syncService.stopBackgroundSync();
        
        setIsAuthenticated(false);
        setActiveUser(null);
        setReloadKey(prev => prev + 1);
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
        activeUser,
        reloadKey,
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