// src/services/auth/authStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
// Import DEBUG z właściwego miejsca - zakładam, że jest w constants
import { DEBUG } from '../../constants/env'; // Popraw ścieżkę, jeśli trzeba

// Klucze do przechowywania danych z jednolitym prefixem
const STORAGE_KEYS = {
  ACCESS_TOKEN: '@auth/access_token',
  REFRESH_TOKEN: '@auth/refresh_token', // Zmieniono klucz dla spójności
  ACTIVE_USER_ID: '@auth/active_user_id', // Zmieniono na ID
};

const AuthStorage = {
  /**
   * Zapisuje access token w AsyncStorage.
   */
  storeAccessToken: async (token: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    } catch (error) {
      console.error('[AuthStorage] Błąd zapisu access tokena:', error);
      throw new Error('Nie można zapisać tokenu dostępu.'); // Rzucaj bardziej opisowy błąd
    }
  },

  /**
   * Pobiera access token z AsyncStorage.
   */
  retrieveAccessToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
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
        console.log('[AuthStorage] Zapisywanie refresh tokena w AsyncStorage (DEBUG)');
        await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
      } else {
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, token);
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
      if (DEBUG) {
        // console.log('[AuthStorage] Pobieranie refresh tokena z AsyncStorage (DEBUG)');
        return await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      } else {
        return await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      }
    } catch (error) {
      console.error('[AuthStorage] Błąd pobierania refresh tokena:', error);
      // Nie rzucaj błędu, jeśli token po prostu nie istnieje, ale loguj inne błędy
      if (!(error instanceof Error && error.message.includes('not found'))) {
          throw new Error('Nie można pobrać tokenu odświeżającego.');
      }
      return null; // Token nie istnieje
    }
  },

  /**
   * Zapisuje ID aktywnego użytkownika w AsyncStorage.
   */
  storeActiveUserId: async (userId: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, userId);
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
      return await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID);
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
        // Sprawdź czy SecureStore jest dostępny przed usunięciem
        if (await SecureStore.isAvailableAsync()) {
             await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
        } else {
             console.warn('[AuthStorage] SecureStore niedostępny, nie można usunąć refresh tokena.');
             // Jeśli w DEBUG używałeś AsyncStorage, usuń też stamtąd na wszelki wypadek
             if (DEBUG) await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        }
      }
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
    } catch (error) {
      console.error('[AuthStorage] Błąd czyszczenia ID użytkownika:', error);
      throw new Error('Nie można usunąć identyfikatora użytkownika.');
    }
  }
};

export default AuthStorage;