import { storeTokens, getTokens, removeTokens, isAuthenticated } from './authStorage';
import { refreshAccessToken } from './refreshTokens';
import { authApi } from '../../api';
import { ApiError } from '../../api/api';

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
    
    if (response && response.access && response.refresh) {
      // Zapisz tokeny
      await storeTokens(response.access, response.refresh);
      return { success: true };
    }
    
    return { 
      success: false, 
      message: 'Nieprawidłowa odpowiedź z serwera' 
    };
  } catch (error) {
    console.error('Błąd podczas logowania:', error);
    
    if (error instanceof ApiError) {
      // Obsługa konkretnych kodów błędów
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
    const { accessToken, refreshToken } = await getTokens();
    
    // Wywołaj API do wylogowania, jeśli mamy oba tokeny
    if (refreshToken && accessToken) {
      try {
        await authApi.logout(refreshToken, accessToken);
        // Ignorujemy ewentualne błędy z API - zawsze wylogowujemy lokalnie
      } catch (error) {
        console.warn('Błąd podczas wylogowywania na serwerze:', error);
        // Kontynuujemy wylogowanie lokalne nawet jeśli API zwróciło błąd
      }
    }
    
    // Usuń tokeny lokalnie
    await removeTokens();
    
    // Zawsze zwracamy sukces, niezależnie od odpowiedzi API
    return { success: true };
  } catch (error) {
    console.error('Błąd podczas wylogowywania lokalnie:', error);
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
      password2: password // Potwierdzenie hasła
    });
    
    if (response && response.username && response.email) {
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
      // Obsługa konkretnych kodów błędów
      if (error.status === 400) {
        // Próba wyodrębnienia błędów pól formularza
        const fieldErrors: Record<string, string[]> = {};
        
        if (error.data) {
          // Sprawdź typowe pola błędów rejestracji
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
    
    if (response && response.detail) {
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
      // Obsługa konkretnych kodów błędów
      if (error.status === 404) {
        const fieldErrors: Record<string, string[]> = {};
        
        // Sprawdź, czy błąd dotyczy nieznalezionego użytkownika
        if (error.data && error.data.email && Array.isArray(error.data.email)) {
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
      
      // Sprawdź, czy są błędy pól formularza
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
  refreshAccessToken,
  isAuthenticated,
  getTokens
}; 