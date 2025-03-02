import AsyncStorage from '@react-native-async-storage/async-storage';

// Klucze używane do przechowywania danych
const ACTIVE_USER_KEY = 'active_user';

/**
 * Przechowuje nazwę aktywnego użytkownika w AsyncStorage
 * @param username Nazwa aktywnego użytkownika
 */
export const storeActiveUser = async (username: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(ACTIVE_USER_KEY, username);
    console.log('Nazwa aktywnego użytkownika zapisana pomyślnie');
  } catch (e) {
    console.error('Błąd podczas zapisywania nazwy aktywnego użytkownika', e);
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
    return username;
  } catch (e) {
    console.error('Błąd podczas odczytywania nazwy aktywnego użytkownika', e);
    throw e;
  }
};

/**
 * Usuwa nazwę aktywnego użytkownika z AsyncStorage
 */
export const removeActiveUser = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ACTIVE_USER_KEY);
    console.log('Nazwa aktywnego użytkownika usunięta pomyślnie');
  } catch (e) {
    console.error('Błąd podczas usuwania nazwy aktywnego użytkownika', e);
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
    return username !== null;
  } catch (e) {
    console.error('Błąd podczas sprawdzania aktywnego użytkownika', e);
    return false;
  }
};

export default {
  storeActiveUser,
  getActiveUser,
  removeActiveUser,
  hasActiveUser
}; 