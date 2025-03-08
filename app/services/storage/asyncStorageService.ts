import AsyncStorage from '@react-native-async-storage/async-storage';

// Klucze używane do przechowywania danych
const ACTIVE_USER_KEY = 'active_user';
const LAST_SYNC_KEY = 'last_sync';

const maskSensitiveData = (key: string, value: string): string => {
  const sensitiveKeys = ['password', 'token', 'access', 'refresh'];
  if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
    return '*'.repeat(8);
  }
  return value;
};

/**
 * Przechowuje nazwę aktywnego użytkownika w AsyncStorage
 * @param username Nazwa aktywnego użytkownika
 */
export const storeActiveUser = async (username: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(ACTIVE_USER_KEY, username);
    console.log('[Storage] Zapisano dane:', {
      key: ACTIVE_USER_KEY,
      value: username,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('[Storage] Błąd podczas zapisywania nazwy aktywnego użytkownika:', {
      key: ACTIVE_USER_KEY,
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw e;
  }
};

/**
 * Pobiera nazwę aktywnego użytkownika z AsyncStorage
 * @returns Nazwa aktywnego użytkownika lub null jeśli nie istnieje
 */
export const getActiveUser = async (): Promise<string | null> => {
  try {
    const username = await AsyncStorage.getItem(ACTIVE_USER_KEY);
    console.log('[Storage] Odczytano dane:', {
      key: ACTIVE_USER_KEY,
      value: username,
      timestamp: new Date().toISOString()
    });
    return username;
  } catch (e) {
    console.error('[Storage] Błąd podczas odczytywania nazwy aktywnego użytkownika:', {
      key: ACTIVE_USER_KEY,
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw e;
  }
};

/**
 * Usuwa nazwę aktywnego użytkownika z AsyncStorage
 */
export const removeActiveUser = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ACTIVE_USER_KEY);
    console.log('[Storage] Usunięto dane:', {
      key: ACTIVE_USER_KEY,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('[Storage] Błąd podczas usuwania nazwy aktywnego użytkownika:', {
      key: ACTIVE_USER_KEY,
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw e;
  }
};

/**
 * Sprawdza, czy istnieje aktywny użytkownik
 * @returns true jeśli istnieje aktywny użytkownik, false w przeciwnym razie
 */
export const hasActiveUser = async (): Promise<boolean> => {
  try {
    const username = await AsyncStorage.getItem(ACTIVE_USER_KEY);
    console.log('[Storage] Sprawdzono istnienie użytkownika:', {
      key: ACTIVE_USER_KEY,
      exists: username !== null,
      timestamp: new Date().toISOString()
    });
    return username !== null;
  } catch (e) {
    console.error('[Storage] Błąd podczas sprawdzania aktywnego użytkownika:', {
      key: ACTIVE_USER_KEY,
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    return false;
  }
};

/**
 * Zapisuje timestamp ostatniej synchronizacji
 * @param timestamp ISO string timestamp ostatniej synchronizacji
 */
export const storeLastSync = async (timestamp: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, timestamp);
    console.log('[Storage] Zapisano timestamp ostatniej synchronizacji:', {
      key: LAST_SYNC_KEY,
      value: timestamp,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('[Storage] Błąd podczas zapisywania timestampu synchronizacji:', {
      key: LAST_SYNC_KEY,
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw e;
  }
};

/**
 * Pobiera timestamp ostatniej synchronizacji
 * @returns ISO string timestamp ostatniej synchronizacji lub null jeśli nie istnieje
 */
export const getLastSync = async (): Promise<string | null> => {
  try {
    const timestamp = await AsyncStorage.getItem(LAST_SYNC_KEY);
    if (!timestamp) {
      // Jeśli nie ma zapisanego timestampu, zwracamy początek czasu unixowego
      return new Date(0).toISOString();
    }
    console.log('[Storage] Odczytano timestamp ostatniej synchronizacji:', {
      key: LAST_SYNC_KEY,
      value: timestamp,
      timestamp: new Date().toISOString()
    });
    return timestamp;
  } catch (e) {
    console.error('[Storage] Błąd podczas odczytywania timestampu synchronizacji:', {
      key: LAST_SYNC_KEY,
      error: e instanceof Error ? e.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw e;
  }
};

export default {
  storeActiveUser,
  getActiveUser,
  removeActiveUser,
  hasActiveUser,
  storeLastSync,
  getLastSync
}; 