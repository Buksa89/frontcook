import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-secure-storage';
import { DEBUG } from '../../constants/env';

// Klucze do przechowywania danych
const STORAGE_KEYS = {
  ACCESS_TOKEN: '@auth/access_token',
  REFRESH_TOKEN: '@auth/refresh_token',
  ACTIVE_USER: '@auth/active_user',
};

const AuthStorage = {
  /**
   * Zapisuje access token w pamięci
   */
  storeAccessToken: async (token: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    } catch (error) {
      console.error('[AuthStorage] Błąd zapisu access tokena:', error);
      throw error;
    }
  },

  /**
   * Pobiera access token z pamięci
   */
  retrieveAccessToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('[AuthStorage] Błąd pobierania access tokena:', error);
      throw error;
    }
  },

  /**
   * Zapisuje refresh token w bezpiecznej pamięci
   */
  storeRefreshToken: async (token: string): Promise<void> => {
    try {
      if (DEBUG) {
        await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
      } else {
        await EncryptedStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
      }
    } catch (error) {
      console.error('[AuthStorage] Błąd zapisu refresh tokena:', error);
      throw error;
    }
  },

  /**
   * Pobiera refresh token z pamięci
   */
  retrieveRefreshToken: async (): Promise<string | null> => {
    try {
      return DEBUG
        ? await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
        : await EncryptedStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('[AuthStorage] Błąd pobierania refresh tokena:', error);
      throw error;
    }
  },

  /**
   * Zapisuje nazwę użytkownika w pamięci
   */
  storeActiveUser: async (username: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_USER, username);
    } catch (error) {
      console.error('[AuthStorage] Błąd zapisu nazwy użytkownika:', error);
      throw error;
    }
  },

  /**
   * Pobiera nazwę użytkownika z pamięci
   */
  retrieveActiveUser: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
    } catch (error) {
      console.error('[AuthStorage] Błąd pobierania nazwy użytkownika:', error);
      throw error;
    }
  },

  /**
   * Czyści access token
   */
  clearAccessToken: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('[AuthStorage] Błąd czyszczenia access tokena:', error);
      throw error;
    }
  },

  /**
   * Czyści refresh token
   */
  clearRefreshToken: async (): Promise<void> => {
    try {
      if (DEBUG) {
        await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      } else {
        await EncryptedStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      }
    } catch (error) {
      console.error('[AuthStorage] Błąd czyszczenia refresh tokena:', error);
      throw error;
    }
  },

  /**
   * Czyści nazwę użytkownika
   */
  clearActiveUser: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    } catch (error) {
      console.error('[AuthStorage] Błąd czyszczenia nazwy użytkownika:', error);
      throw error;
    }
  }
};

export default AuthStorage;