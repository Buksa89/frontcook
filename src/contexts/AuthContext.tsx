import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { View, Text } from 'react-native';

interface AuthContextType {
  userId: string | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true); // Start with loading true

  // Placeholder functions - implement later using authService and authApi
  const login = useCallback(async (u: string, p: string) => { console.warn("Login not implemented"); setIsLoading(false); /* TODO */ }, []);
  const logout = useCallback(async () => { console.warn("Logout not implemented"); setUserId(null); setAccessToken(null); /* TODO */ }, []);
  const register = useCallback(async (u: string, e: string, p1: string, p2: string) => { console.warn("Register not implemented"); /* TODO */ }, []);
  const resetPassword = useCallback(async (e: string) => { console.warn("Reset password not implemented"); /* TODO */ }, []);

   // Simulate initial auth check
   useEffect(() => {
     const checkAuth = async () => {
        // TODO: Implement actual check using authService/authStorage
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
        setIsLoading(false);
     }
     checkAuth();
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

// Simple loading indicator component
const LoadingIndicator = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Loading...</Text>
  </View>
);


export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};