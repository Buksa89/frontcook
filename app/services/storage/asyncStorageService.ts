import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNC_KEY = 'last_sync';

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
  storeLastSync,
  getLastSync
}; 