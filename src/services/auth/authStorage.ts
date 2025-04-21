// src/services/auth/authStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DEBUG } from '../../config/env'; // Import DEBUG z nowej lokalizacji

// Klucze do przechowywania danych z jednolitym prefixem
const STORAGE_KEYS = {
  ACCESS_TOKEN: '@auth/access_token',
  REFRESH_TOKEN: '@auth/refresh_token',
  ACTIVE_USER_ID: '@auth/active_user_id',
  // --- NOWY KLUCZ (Prefiks) ---
  LAST_PULLED_AT_PREFIX: '@sync/last_pulled_at_', // Prefiks, do którego dodamy userId
};

// Funkcja pomocnicza do tworzenia klucza LPA dla użytkownika
const getLastPulledAtKey = (userId: string): string => {
  if (!userId) {
      console.error("[AuthStorage] Próba utworzenia klucza LPA bez userId.");
      // Rzucenie błędu lub zwrócenie stałego klucza może być ryzykowne
      // Lepiej zapobiegać wywołaniu bez userId
      throw new Error("Nie można utworzyć klucza LPA bez userId.");
  }
  return `${STORAGE_KEYS.LAST_PULLED_AT_PREFIX}${userId}`;
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

  // --- NOWE METODY DLA LAST PULLED AT ---

  /**
   * Zapisuje ostatni timestamp synchronizacji dla danego użytkownika.
   */
  storeLastPulledAt: async (userId: string, timestamp: number): Promise<void> => {
    if (!userId) {
        console.warn('[AuthStorage] Próba zapisu LPA bez userId.');
        return;
    }
    try {
      const key = getLastPulledAtKey(userId);
      await AsyncStorage.setItem(key, timestamp.toString());
      console.log(`[AuthStorage] Zapisano LPA (${timestamp}) dla User ID: ${userId}`);
    } catch (error) {
      console.error(`[AuthStorage] Błąd zapisu LPA dla User ID ${userId}:`, error);
      throw new Error('Nie można zapisać ostatniego czasu synchronizacji.');
    }
  },

  /**
   * Pobiera ostatni timestamp synchronizacji dla danego użytkownika.
   */
  retrieveLastPulledAt: async (userId: string): Promise<number | null> => {
    if (!userId) {
        console.warn('[AuthStorage] Próba pobrania LPA bez userId.');
        return null;
    }
    try {
      const key = getLastPulledAtKey(userId);
      const timestampStr = await AsyncStorage.getItem(key);
      if (timestampStr === null) {
        console.log(`[AuthStorage] Brak zapisanego LPA dla User ID: ${userId}.`);
        return null;
      }
      const timestamp = parseInt(timestampStr, 10);
      if (isNaN(timestamp)) {
        console.warn(`[AuthStorage] Nieprawidłowy format zapisanego LPA dla User ID ${userId}: "${timestampStr}". Zwracam null.`);
        await AsyncStorage.removeItem(key); // Usuń nieprawidłową wartość
        return null;
      }
      console.log(`[AuthStorage] Pobrano LPA (${timestamp}) dla User ID: ${userId}.`);
      return timestamp;
    } catch (error) {
      console.error(`[AuthStorage] Błąd pobierania LPA dla User ID ${userId}:`, error);
      throw new Error('Nie można pobrać ostatniego czasu synchronizacji.');
    }
  },

  /**
   * Czyści zapisany timestamp synchronizacji dla danego użytkownika.
   * (Może być przydatne do debugowania lub resetowania stanu sync)
   */
  clearLastPulledAt: async (userId: string): Promise<void> => {
    if (!userId) {
        console.warn('[AuthStorage] Próba czyszczenia LPA bez userId.');
        return;
    }
    try {
      const key = getLastPulledAtKey(userId);
      await AsyncStorage.removeItem(key);
      console.log(`[AuthStorage] Wyczyszczono LPA dla User ID: ${userId}.`);
    } catch (error) {
      console.error(`[AuthStorage] Błąd czyszczenia LPA dla User ID ${userId}:`, error);
      // Raczej nie rzucamy błędu, bo to operacja pomocnicza
    }
  },

  // --- KONIEC NOWYCH METOD ---

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