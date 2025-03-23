import Constants from 'expo-constants';

// Fallback wartości dla zmiennych środowiskowych
const DEFAULT_API_URL = 'https://smartcook.addev.pl/';
const DEFAULT_DEBUG = false;

// Próba pobrania z Constants, jeśli nie jest dostępna, użyj wartości domyślnej
export const API_URL = Constants.expoConfig?.extra?.API_URL || DEFAULT_API_URL;
export const DEBUG = Constants.expoConfig?.extra?.DEBUG !== undefined 
  ? Constants.expoConfig?.extra?.DEBUG as boolean 
  : DEFAULT_DEBUG;

// Sprawdzenie czy API_URL jest zdefiniowane - już nie rzucamy błędu, tylko logujemy ostrzeżenie
if (!API_URL) {
  console.warn('API_URL is not defined in environment variables, using default value');
} 