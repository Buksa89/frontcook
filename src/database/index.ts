// src/database/index.ts
import { Platform, NativeModules } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import schema from './schema';
// --- NOWY IMPORT ---
import migrations from './migrations'; // Zaimportuj migracje
// ------------------

// Importuj wszystkie nowe definicje modeli
import Tag from './models/Tag';
import Recipe from './models/Recipe';
import RecipeTag from './models/RecipeTag';
import Ingredient from './models/Ingredient';
import ShoppingItem from './models/ShoppingItem';
import ClientUserSettings from './models/ClientUserSettings';
import Notification from './models/Notification';
import UserProfile from './models/UserProfile';
import RecipeImageLocal from './models/RecipeImageLocal';

import { DEBUG } from '../config/env';

// Funkcja pomocnicza do sprawdzania dostępności modułów natywnych (bez zmian)
const isWatermelonDBNativeAvailable = (): boolean => {
  try {
    return (
      (Platform.OS === 'ios' || Platform.OS === 'android') &&
      NativeModules &&
      NativeModules.WMDatabaseBridge !== undefined &&
      NativeModules.WMDatabaseBridge !== null
    );
  } catch (e) {
    console.warn('[DB] Nie można sprawdzić dostępności modułów natywnych WatermelonDB:', e);
    return false;
  }
};

// --- Konfiguracja Adaptera ---
let adapter;
const dbName = "OmNomNomDB";

if (DEBUG) {
  console.log('[DB] Tryb DEBUG: Używam adaptera LokiJS (in-memory)');
  adapter = new LokiJSAdapter({
    schema,
    // --- ZMIANA: Przekaż migracje ---
    migrations,
    // -----------------------------
    useWebWorker: false,
    useIncrementalIndexedDB: false,
    dbName: dbName,
  });
} else {
  console.log('[DB] Tryb PRODUKCYJNY: Używam adaptera SQLite (natywny)');
  const nativeModulesAvailable = isWatermelonDBNativeAvailable();
  const useJsi = nativeModulesAvailable;
  console.log(`[DB] Moduły natywne dostępne: ${nativeModulesAvailable}. Użycie JSI (Turbo Sync): ${useJsi}`);

  adapter = new SQLiteAdapter({
    schema,
    // --- ZMIANA: Przekaż migracje ---
    migrations,
    // -----------------------------
    dbName: dbName,
    jsi: useJsi,
    onSetUpError: (error: Error) => {
      console.error('[DB] KRYTYCZNY BŁĄD podczas konfiguracji adaptera SQLite:', error);
    },
  });
}

// --- Tworzenie Instancji Bazy Danych ---
const database = new Database({
  adapter,
  modelClasses: [
    Tag,
    Recipe,
    RecipeTag,
    Ingredient,
    ShoppingItem,
    ClientUserSettings,
    Notification,
    UserProfile,
    RecipeImageLocal,
  ],
  // --- ZMIANA: Przekaż migracje również tutaj ---
  // Chociaż dokumentacja nie zawsze tego wymaga, dobra praktyka
  // migrations, // Nie jest wymagane bezpośrednio w Database, ale nie zaszkodzi
  // ---------------------------------------------
});

console.log(`[DB] Instancja WatermelonDB utworzona (Adapter: ${DEBUG ? 'LokiJS' : 'SQLite'})`);

// --- Eksport ---
export default database;

// Opcjonalna funkcja inicjalizująca (bez zmian)
export const initializeDatabase = async (): Promise<void> => {
  try {
    console.log('[DB] Inicjalizacja bazy danych zakończona.');
  } catch (error) {
    console.error('[DB] Błąd podczas dodatkowej inicjalizacji bazy danych:', error);
  }
};