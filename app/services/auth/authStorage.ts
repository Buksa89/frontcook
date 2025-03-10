import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-secure-storage';
import { DEBUG } from '../../constants/env';

// Interfejs dla magazynu przechowywania
interface StorageInterface {
  setItem: (key: string, value: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
}

// Wybór odpowiedniego mechanizmu przechowywania w zależności od środowiska
const secureStorage: StorageInterface = DEBUG ? AsyncStorage : EncryptedStorage;

// Klucze używane do przechowywania tokenów
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

const maskToken = (token: string): string => {
  if (!token) return '';
  if (token.length <= 8) return '*'.repeat(token.length);
  return token.substring(0, 4) + '*'.repeat(token.length - 8) + token.substring(token.length - 4);
};

/**
 * Przechowuje tokeny uwierzytelniania w magazynie
 * @param accessToken Token dostępu
 * @param refreshToken Token odświeżania
 */
export const storeTokens = async (accessToken: string, refreshToken: string): Promise<void> => {
  try {
    // Access token zawsze w AsyncStorage
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    // Refresh token w secure storage
    await secureStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    console.log('[Auth Storage] Zapisano tokeny:', {
      accessToken: maskToken(accessToken),
      refreshToken: maskToken(refreshToken),
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('[Auth Storage] Błąd podczas zapisywania tokenów:', {
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw e;
  }
};

/**
 * Pobiera tylko access token z magazynu
 * @returns Access token lub null jeśli nie istnieje
 */
export const getAccessToken = async (): Promise<string | null> => {
  try {
    const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    console.log('[Auth Storage] Pobrano access token:', {
      accessToken: accessToken ? maskToken(accessToken) : null,
      timestamp: new Date().toISOString()
    });
    return accessToken;
  } catch (e) {
    console.error('[Auth Storage] Błąd podczas pobierania access tokenu:', {
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    return null;
  }
};

/**
 * Pobiera tylko token odświeżania z magazynu
 * @returns Token odświeżania lub null jeśli nie istnieje
 */
export const getRefreshToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await secureStorage.getItem(REFRESH_TOKEN_KEY);
    console.log('[Auth Storage] Pobrano refresh token:', {
      refreshToken: refreshToken ? maskToken(refreshToken) : null,
      timestamp: new Date().toISOString()
    });
    return refreshToken;
  } catch (e) {
    console.error('[Auth Storage] Błąd podczas pobierania refresh tokenu:', {
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    return null;
  }
};

/**
 * Usuwa tokeny uwierzytelniania z magazynu (np. przy wylogowaniu)
 */
export const removeTokens = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    await secureStorage.removeItem(REFRESH_TOKEN_KEY);
    console.log('[Auth Storage] Usunięto tokeny:', {
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('[Auth Storage] Błąd podczas usuwania tokenów:', {
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw e;
  }
};

/**
 * Sprawdza, czy użytkownik jest zalogowany (czy istnieje accessToken)
 * @returns true jeśli użytkownik jest zalogowany, false w przeciwnym razie
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    console.log('[Auth Storage] Sprawdzono stan uwierzytelnienia:', {
      isAuthenticated: accessToken !== null,
      timestamp: new Date().toISOString()
    });
    return accessToken !== null;
  } catch (e) {
    console.error('[Auth Storage] Błąd podczas sprawdzania uwierzytelnienia:', {
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    return false;
  }
};

export default {
  storeTokens,
  removeTokens,
  isAuthenticated,
  getAccessToken,
  getRefreshToken
};