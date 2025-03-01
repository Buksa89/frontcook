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
const storage: StorageInterface = DEBUG ? AsyncStorage : EncryptedStorage;

// Klucze używane do przechowywania tokenów
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Przechowuje tokeny uwierzytelniania (access i refresh) w odpowiednim magazynie
 * @param accessToken Token dostępu
 * @param refreshToken Token odświeżania
 */
export const storeTokens = async (accessToken: string, refreshToken: string): Promise<void> => {
  try {
    await storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    console.log('Tokeny zapisane pomyślnie');
  } catch (e) {
    console.error('Błąd podczas zapisywania tokenów', e);
    throw e;
  }
};

/**
 * Pobiera tokeny uwierzytelniania z magazynu
 * @returns Obiekt zawierający accessToken i refreshToken
 */
export const getTokens = async (): Promise<{ accessToken: string | null, refreshToken: string | null }> => {
  try {
    const accessToken = await storage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = await storage.getItem(REFRESH_TOKEN_KEY);
    return { accessToken, refreshToken };
  } catch (e) {
    console.error('Błąd podczas odczytywania tokenów', e);
    throw e;
  }
};

/**
 * Usuwa tokeny uwierzytelniania z magazynu (np. przy wylogowaniu)
 */
export const removeTokens = async (): Promise<void> => {
  try {
    await storage.removeItem(ACCESS_TOKEN_KEY);
    await storage.removeItem(REFRESH_TOKEN_KEY);
    console.log('Tokeny usunięte pomyślnie');
  } catch (e) {
    console.error('Błąd podczas usuwania tokenów', e);
    throw e;
  }
};

/**
 * Sprawdza, czy użytkownik jest zalogowany (czy istnieje accessToken)
 * @returns true jeśli użytkownik jest zalogowany, false w przeciwnym razie
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const accessToken = await storage.getItem(ACCESS_TOKEN_KEY);
    return accessToken !== null;
  } catch (e) {
    console.error('Błąd podczas sprawdzania uwierzytelnienia', e);
    return false;
  }
};

export default {
  storeTokens,
  getTokens,
  removeTokens,
  isAuthenticated
};