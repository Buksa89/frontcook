import { storeTokens, getTokens } from './authStorage';
import { authApi } from '../../api';
import { ApiError } from '../../api/api';

/**
 * Odświeża token dostępu przy użyciu refresh tokena
 * @returns Nowy token dostępu
 */
export const refreshAccessToken = async (): Promise<string | null> => {
  try {
    // Pobierz aktualny refresh token
    const { refreshToken } = await getTokens();
    
    if (!refreshToken) {
      console.error('Brak refresh tokena do odświeżenia tokenu dostępu');
      return null;
    }
    
    // Wywołaj API, aby odświeżyć token
    const response = await authApi.refreshToken(refreshToken);
    
    if (response && response.access) {
      // Zapisz nowy token dostępu (zachowując istniejący refresh token)
      await storeTokens(response.access, refreshToken);
      
      return response.access;
    }
    
    return null;
  } catch (error) {
    if (error instanceof ApiError) {
      // Obsługa konkretnych kodów błędów
      if (error.status === 401) {
        console.error('Refresh token wygasł lub jest nieprawidłowy. Wymagane ponowne logowanie.');
      } else {
        console.error(`Błąd podczas odświeżania tokenu: ${error.message}`);
      }
    } else {
      console.error('Błąd podczas odświeżania tokenu:', error);
    }
    
    return null;
  }
};

export default {
  refreshAccessToken
}; 