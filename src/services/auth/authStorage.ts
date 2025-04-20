import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DEBUG } from '../../config/env'; // Import DEBUG z nowej lokalizacji

// Klucze do przechowywania danych z jednolitym prefixem
const STORAGE_KEYS = {
  ACCESS_TOKEN: '@auth/access_token',
  REFRESH_TOKEN: '@auth/refresh_token',
  ACTIVE_USER_ID: '@auth/active_user_id',
};

const AuthStorage = {
  /**
   * Zapisuje access token w AsyncStorage.
   */
  storeAccessToken: async (token: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
      // console.log('[AuthStorage] Access token zapisany.');
    } catch (error) {
      console.error('[AuthStorage] Błąd zapisu access tokena:', error);
      throw new Error('Nie można zapisać tokenu dostępu.');
    }
  },

  /**
   * Pobiera access token z AsyncStorage.
   */
  retrieveAccessToken: async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      // console.log('[AuthStorage] Pobrano access token:', token ? '***' : null);
      return token;
    } catch (error) {
      console.error('[AuthStorage] Błąd pobierania access tokena:', error);
      throw new Error('Nie można pobrać tokenu dostępu.');
    }
  },

  /**
   * Zapisuje refresh token (SecureStore w produkcji, AsyncStorage w DEBUG).
   */
  storeRefreshToken: async (token: string): Promise<void> => {
    try {
      if (DEBUG) {
        // console.log('[AuthStorage] Zapisywanie refresh tokena w AsyncStorage (DEBUG)');
        await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
      } else {
        if (await SecureStore.isAvailableAsync()) {
          await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, token);
          // console.log('[AuthStorage] Refresh token zapisany w SecureStore.');
        } else {
           console.warn('[AuthStorage] SecureStore niedostępny, zapisuję refresh token w AsyncStorage (fallback).');
           await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
        }
      }
    } catch (error) {
      console.error('[AuthStorage] Błąd zapisu refresh tokena:', error);
      throw new Error('Nie można zapisać tokenu odświeżającego.');
    }
  },

  /**
   * Pobiera refresh token.
   */
  retrieveRefreshToken: async (): Promise<string | null> => {
    try {
      let token: string | null = null;
      if (DEBUG) {
        // console.log('[AuthStorage] Pobieranie refresh tokena z AsyncStorage (DEBUG)');
        token = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      } else {
        if (await SecureStore.isAvailableAsync()) {
          token = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
        } else {
           console.warn('[AuthStorage] SecureStore niedostępny, próbuję pobrać refresh token z AsyncStorage (fallback).');
           token = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        }
      }
      // console.log('[AuthStorage] Pobrano refresh token:', token ? '***' : null);
      return token;
    } catch (error) {
      console.error('[AuthStorage] Błąd pobierania refresh tokena:', error);
      // Nie rzucaj błędu, jeśli token po prostu nie istnieje, ale loguj inne błędy
      if (!(error instanceof Error && error.message.includes('not found'))) {
          throw new Error('Nie można pobrać tokenu odświeżającego.');
      }
      return null; // Token nie istnieje lub SecureStore niedostępny
    }
  },

  /**
   * Zapisuje ID aktywnego użytkownika w AsyncStorage.
   */
  storeActiveUserId: async (userId: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, userId);
      // console.log('[AuthStorage] User ID zapisany:', userId);
    } catch (error) {
      console.error('[AuthStorage] Błąd zapisu ID użytkownika:', error);
      throw new Error('Nie można zapisać identyfikatora użytkownika.');
    }
  },

  /**
   * Pobiera ID aktywnego użytkownika z AsyncStorage.
   */
  retrieveActiveUserId: async (): Promise<string | null> => {
    try {
      const userId = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);
      // console.log('[AuthStorage] Pobrano User ID:', userId);
      return userId;
    } catch (error) {
      console.error('[AuthStorage] Błąd pobierania ID użytkownika:', error);
      throw new Error('Nie można pobrać identyfikatora użytkownika.');
    }
  },

  /**
   * Czyści access token z AsyncStorage.
   */
  clearAccessToken: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      // console.log('[AuthStorage] Access token usunięty.');
    } catch (error) {
      console.error('[AuthStorage] Błąd czyszczenia access tokena:', error);
      throw new Error('Nie można usunąć tokenu dostępu.');
    }
  },

  /**
   * Czyści refresh token.
   */
  clearRefreshToken: async (): Promise<void> => {
    try {
      if (DEBUG) {
        await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      } else {
        if (await SecureStore.isAvailableAsync()) {
             await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
        } else {
             console.warn('[AuthStorage] SecureStore niedostępny, próbuję usunąć refresh token z AsyncStorage (fallback).');
             await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        }
      }
      // console.log('[AuthStorage] Refresh token usunięty.');
    } catch (error) {
      console.error('[AuthStorage] Błąd czyszczenia refresh tokena:', error);
      throw new Error('Nie można usunąć tokenu odświeżającego.');
    }
  },

  /**
   * Czyści ID aktywnego użytkownika z AsyncStorage.
   */
  clearActiveUserId: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID);
      // console.log('[AuthStorage] User ID usunięty.');
    } catch (error) {
      console.error('[AuthStorage] Błąd czyszczenia ID użytkownika:', error);
      throw new Error('Nie można usunąć identyfikatora użytkownika.');
    }
  }
};

export default AuthStorage;