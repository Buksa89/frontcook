import { storeTokens, getTokens, removeTokens } from './authStorage';
import { authApi } from '../../api';
import { ApiError } from '../../api/api';
import { Alert } from 'react-native';

/**
 * Odświeża tokeny dostępu i odświeżania
 * @returns Nowy token dostępu lub null w przypadku błędu
 */
export const refreshAccessToken = async (): Promise<string | null> => {
  try {
    // Pobierz aktualny refresh token
    const { refreshToken } = await getTokens();
    
    if (!refreshToken) {
      console.error('Brak refresh tokena do odświeżenia tokenu dostępu');
      return null;
    }
    
    // Wywołaj API, aby odświeżyć tokeny
    const response = await authApi.refreshToken(refreshToken);
    
    if (response && response.access && response.refresh) {
      // Zapisz nowe tokeny (access i refresh)
      await storeTokens(response.access, response.refresh);
      
      return response.access;
    }
    
    return null;
  } catch (error) {
    if (error instanceof ApiError) {
      // Jeśli refresh token jest nieważny
      if (error.status === 401) {
        // Usuń tokeny
        await removeTokens();
        
        // Wyświetl alert o wygaśnięciu sesji
        Alert.alert(
          'Sesja wygasła',
          'Twoja sesja wygasła. Zaloguj się ponownie, aby kontynuować.',
          [{ text: 'OK' }]
        );
        
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