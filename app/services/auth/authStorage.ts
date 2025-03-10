import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-secure-storage';
import { DEBUG } from '../../constants/env';

// Storage keys
const KEYS = {
  ACCESS_TOKEN: '@auth/access_token',
  REFRESH_TOKEN: '@auth/refresh_token',
  ACTIVE_USER: '@auth/active_user'
};

/**
 * Maskuje wrażliwe dane
 */
const maskSensitiveData = (data: string): string => {
  if (!data) return '';
  if (data.length <= 8) return '*'.repeat(data.length);
  return data.substring(0, 4) + '*'.repeat(data.length - 8) + data.substring(data.length - 4);
};

/**
 * Zapisuje access token w AsyncStorage
 */
export const saveAccessToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.ACCESS_TOKEN, token);
    console.log('[Auth Storage] Access token saved:', {
      token: maskSensitiveData(token),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Auth Storage] Error saving access token:', error);
    throw error;
  }
};

/**
 * Pobiera access token z AsyncStorage
 */
export const getAccessToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem(KEYS.ACCESS_TOKEN);
    console.log('[Auth Storage] Access token retrieved:', {
      token: token ? maskSensitiveData(token) : null,
      timestamp: new Date().toISOString()
    });
    return token;
  } catch (error) {
    console.error('[Auth Storage] Error getting access token:', error);
    throw error;
  }
};

/**
 * Zapisuje refresh token w EncryptedStorage (lub AsyncStorage w trybie debug)
 */
export const saveRefreshToken = async (token: string): Promise<void> => {
  try {
    if (DEBUG) {
      await AsyncStorage.setItem(KEYS.REFRESH_TOKEN, token);
    } else {
      await EncryptedStorage.setItem(KEYS.REFRESH_TOKEN, token);
    }
    console.log('[Auth Storage] Refresh token saved:', {
      token: maskSensitiveData(token),
      storage: DEBUG ? 'AsyncStorage' : 'EncryptedStorage',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Auth Storage] Error saving refresh token:', error);
    throw error;
  }
};

/**
 * Pobiera refresh token z EncryptedStorage (lub AsyncStorage w trybie debug)
 */
export const getRefreshToken = async (): Promise<string | null> => {
  try {
    const token = DEBUG 
      ? await AsyncStorage.getItem(KEYS.REFRESH_TOKEN)
      : await EncryptedStorage.getItem(KEYS.REFRESH_TOKEN);
    
    console.log('[Auth Storage] Refresh token retrieved:', {
      token: token ? maskSensitiveData(token) : null,
      storage: DEBUG ? 'AsyncStorage' : 'EncryptedStorage',
      timestamp: new Date().toISOString()
    });
    return token;
  } catch (error) {
    console.error('[Auth Storage] Error getting refresh token:', error);
    throw error;
  }
};

/**
 * Zapisuje dane użytkownika w AsyncStorage
 */
export const saveActiveUser = async (user: object): Promise<void> => {
  try {
    const userData = JSON.stringify(user);
    await AsyncStorage.setItem(KEYS.ACTIVE_USER, userData);
    console.log('[Auth Storage] Active user saved:', {
      user: { ...user, id: user['id'] ? maskSensitiveData(user['id'].toString()) : null },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Auth Storage] Error saving active user:', error);
    throw error;
  }
};

/**
 * Pobiera dane użytkownika z AsyncStorage
 */
export const getActiveUser = async (): Promise<object | null> => {
  try {
    const userData = await AsyncStorage.getItem(KEYS.ACTIVE_USER);
    const parsedUser = userData ? JSON.parse(userData) : null;
    console.log('[Auth Storage] Active user retrieved:', {
      user: parsedUser ? { 
        ...parsedUser, 
        id: parsedUser.id ? maskSensitiveData(parsedUser.id.toString()) : null 
      } : null,
      timestamp: new Date().toISOString()
    });
    return parsedUser;
  } catch (error) {
    console.error('[Auth Storage] Error getting active user:', error);
    throw error;
  }
};

/**
 * Czyści wszystkie dane uwierzytelniania
 */
export const clearAuthData = async (): Promise<void> => {
  try {
    const promises = [
      AsyncStorage.removeItem(KEYS.ACCESS_TOKEN),
      AsyncStorage.removeItem(KEYS.ACTIVE_USER)
    ];

    if (DEBUG) {
      promises.push(AsyncStorage.removeItem(KEYS.REFRESH_TOKEN));
    } else {
      promises.push(EncryptedStorage.removeItem(KEYS.REFRESH_TOKEN));
    }

    await Promise.all(promises);
    console.log('[Auth Storage] Auth data cleared:', {
      clearedKeys: [KEYS.ACCESS_TOKEN, KEYS.REFRESH_TOKEN, KEYS.ACTIVE_USER],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Auth Storage] Error clearing auth data:', error);
    throw error;
  }
};

export default {
  saveAccessToken,
  getAccessToken,
  saveRefreshToken,
  getRefreshToken,
  saveActiveUser,
  getActiveUser,
  clearAuthData
};