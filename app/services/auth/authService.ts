import { authApi } from '../../api';
import { ApiError } from '../../api/api';
import { LoginResponse } from '../../api/auth';
import { saveAccessToken, saveRefreshToken, getAccessToken, getRefreshToken, saveActiveUser, clearAuthData } from './authStorage';
import { refreshAccessToken } from './refreshTokens';

/**
 * Loguje użytkownika i zapisuje tokeny
 * @param username Nazwa użytkownika lub email
 * @param password Hasło
 * @returns Obiekt zawierający informacje o sukcesie logowania i ewentualny komunikat błędu
 */
export const login = async (
  username: string, 
  password: string
): Promise<{ success: boolean; message?: string; }> => {
  try {
    const response = await authApi.login({ username, password });
    
    if (response?.access && response?.refresh) {
      // Zapisz tokeny
      await Promise.all([
        saveAccessToken(response.access),
        saveRefreshToken(response.refresh)
      ]);
      
      // Zapisz dane użytkownika
      await saveActiveUser({ username: response.username });
      
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

/**
 * Wylogowuje użytkownika usuwając tokeny
 * @returns Obiekt zawierający informacje o sukcesie wylogowania
 */
export const logout = async (): Promise<{ success: boolean; message?: string; }> => {
  try {
    // Pobierz tokeny
    const [accessToken, refreshToken] = await Promise.all([
      getAccessToken(),
      getRefreshToken()
    ]);
    
    // Wywołaj API do wylogowania, jeśli mamy oba tokeny
    if (refreshToken && accessToken) {
      try {
        await authApi.logout(refreshToken, accessToken);
      } catch (error) {
        console.warn('Błąd podczas wylogowywania na serwerze:', error);
        // Ignorujemy błędy z API - zawsze wylogowujemy lokalnie
      }
    }

    // Wyczyść wszystkie dane uwierzytelniania
    await clearAuthData();
    
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

/**
 * Rejestruje nowego użytkownika
 * @param username Nazwa użytkownika
 * @param email Email
 * @param password Hasło
 * @returns Obiekt zawierający informacje o sukcesie rejestracji i ewentualny komunikat błędu
 */
export const register = async (
  username: string,
  email: string,
  password: string
): Promise<{ success: boolean; message?: string; fieldErrors?: Record<string, string[]>; }> => {
  try {
    const response = await authApi.register({
      username,
      email,
      password,
      password2: password
    });
    
    if (response?.username && response?.email) {
      return { 
        success: true, 
        message: 'Rejestracja zakończona sukcesem. Możesz się teraz zalogować.' 
      };
    }
    
    return { 
      success: false, 
      message: 'Nieprawidłowa odpowiedź z serwera' 
    };
  } catch (error) {
    console.error('Błąd podczas rejestracji:', error);
    
    if (error instanceof ApiError) {
      if (error.status === 400) {
        const fieldErrors: Record<string, string[]> = {};
        
        if (error.data) {
          ['username', 'email', 'password', 'password2', 'non_field_errors'].forEach(field => {
            if (error.data[field] && Array.isArray(error.data[field])) {
              fieldErrors[field] = error.data[field];
            }
          });
        }
        
        return { 
          success: false, 
          message: error.message,
          fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined
        };
      }
      
      return { 
        success: false, 
        message: error.message 
      };
    }
    
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Wystąpił nieznany błąd podczas rejestracji' 
    };
  }
};

/**
 * Wysyła link do resetowania hasła
 * @param email Email użytkownika
 * @returns Obiekt zawierający informacje o sukcesie wysłania linku i ewentualny komunikat błędu
 */
export const resetPassword = async (
  email: string
): Promise<{ success: boolean; message?: string; fieldErrors?: Record<string, string[]>; }> => {
  try {
    const response = await authApi.resetPassword({ email });
    
    if (response?.detail) {
      return { 
        success: true, 
        message: response.detail 
      };
    }
    
    return { 
      success: true, 
      message: 'Link do resetowania hasła został wysłany' 
    };
  } catch (error) {
    console.error('Błąd podczas wysyłania linku resetującego hasło:', error);
    
    if (error instanceof ApiError) {
      if (error.status === 404) {
        const fieldErrors: Record<string, string[]> = {};
        
        if (error.data?.email && Array.isArray(error.data.email)) {
          fieldErrors.email = error.data.email;
          return { 
            success: false, 
            message: 'Nie znaleziono użytkownika z podanym adresem email',
            fieldErrors
          };
        }
        
        return { 
          success: false, 
          message: 'Nie znaleziono użytkownika z podanym adresem email' 
        };
      }
      
      if (error.status === 400 && error.data) {
        const fieldErrors: Record<string, string[]> = {};
        
        if (error.data.email && Array.isArray(error.data.email)) {
          fieldErrors.email = error.data.email;
        }
        
        if (Object.keys(fieldErrors).length > 0) {
          return {
            success: false,
            message: error.message,
            fieldErrors
          };
        }
      }
      
      return { 
        success: false, 
        message: error.message 
      };
    }
    
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Wystąpił nieznany błąd podczas wysyłania linku resetującego hasło' 
    };
  }
};

export default {
  login,
  logout,
  register,
  resetPassword,
  refreshAccessToken
}; 