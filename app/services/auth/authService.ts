import { storeTokens, getTokens, removeTokens, isAuthenticated } from './authStorage';
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
    // Tutaj będzie faktyczne zapytanie do API w celu uzyskania tokenów
    // Na razie zwracamy przykładowe tokeny
    
    // Przykładowa implementacja zapytania do API:
    // const response = await fetch('https://api.example.com/login', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ username, password }),
    // });
    // 
    // if (!response.ok) {
    //   const errorData = await response.json();
    //   return { success: false, message: errorData.message || 'Błąd logowania' };
    // }
    // 
    // const data = await response.json();
    // const { accessToken, refreshToken } = data;
    
    // Tymczasowo generujemy przykładowe tokeny
    const accessToken = `access-token-${Date.now()}`;
    const refreshToken = `refresh-token-${Date.now()}`;
    
    // Zapisz tokeny
    await storeTokens(accessToken, refreshToken);
    
    return { success: true };
  } catch (error) {
    console.error('Błąd podczas logowania:', error);
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
    await removeTokens();
    return { success: true };
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
): Promise<{ success: boolean; message?: string; }> => {
  try {
    // Tutaj będzie faktyczne zapytanie do API w celu rejestracji użytkownika
    // Na razie zwracamy przykładowy sukces
    
    // Przykładowa implementacja zapytania do API:
    // const response = await fetch('https://api.example.com/register', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ username, email, password }),
    // });
    // 
    // if (!response.ok) {
    //   const errorData = await response.json();
    //   return { success: false, message: errorData.message || 'Błąd rejestracji' };
    // }
    
    // Tymczasowo zwracamy sukces
    return { success: true, message: 'Rejestracja zakończona sukcesem' };
  } catch (error) {
    console.error('Błąd podczas rejestracji:', error);
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
): Promise<{ success: boolean; message?: string; }> => {
  try {
    // Tutaj będzie faktyczne zapytanie do API w celu wysłania linku resetującego hasło
    // Na razie zwracamy przykładowy sukces
    
    // Przykładowa implementacja zapytania do API:
    // const response = await fetch('https://api.example.com/reset-password', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ email }),
    // });
    // 
    // if (!response.ok) {
    //   const errorData = await response.json();
    //   return { success: false, message: errorData.message || 'Błąd wysyłania linku resetującego' };
    // }
    
    // Tymczasowo zwracamy sukces
    return { success: true, message: 'Link do resetowania hasła został wysłany' };
  } catch (error) {
    console.error('Błąd podczas wysyłania linku resetującego hasło:', error);
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