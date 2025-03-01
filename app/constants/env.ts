import Constants from 'expo-constants';

export const API_URL = Constants.expoConfig?.extra?.API_URL as string;
export const DEBUG = Constants.expoConfig?.extra?.DEBUG as boolean;

if (!API_URL) {
  throw new Error('API_URL is not defined in environment variables');
} 