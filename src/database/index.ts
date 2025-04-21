import { Platform, NativeModules } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import schema from './schema'; // Importuj nowy schemat
// import migrations from './migrations'; // Zaimportuj migracje, jeśli je masz

// Importuj wszystkie nowe definicje modeli
import Tag from './models/Tag';
import Recipe from './models/Recipe';
import RecipeTag from './models/RecipeTag';
import Ingredient from './models/Ingredient';
import ShoppingItem from './models/ShoppingItem';
import ClientUserSettings from './models/ClientUserSettings';
import Notification from './models/Notification';
import UserProfile from './models/UserProfile';
import RecipeImageLocal from './models/RecipeImageLocal'; // Importuj nowy lokalny model

import { DEBUG } from '../config/env'; // Import flagi DEBUG

// Funkcja pomocnicza do sprawdzania dostępności modułów natywnych
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
const dbName = "OmNomNomDB"; // Nazwa pliku bazy danych

if (DEBUG) {
  console.log('[DB] Tryb DEBUG: Używam adaptera LokiJS (in-memory)');
  adapter = new LokiJSAdapter({
    schema,
    // migrations, // Odkomentuj, jeśli masz migracje
    useWebWorker: false,
    useIncrementalIndexedDB: false, // Dla debugowania może być lepiej wyłączyć
    dbName: dbName, // Opcjonalnie, dla LokiJS może pomóc w niektórych przypadkach
    // Opcje dla LokiJS (jeśli potrzebne):
    // adapter: new LokiMemoryAdapter(), // Zawsze in-memory w tym trybie
    // autosave: false, // Wyłącz autosave dla czystego startu w debug
  });
} else {
  console.log('[DB] Tryb PRODUKCYJNY: Używam adaptera SQLite (natywny)');
  const nativeModulesAvailable = isWatermelonDBNativeAvailable();
  const useJsi = nativeModulesAvailable; // JSI tylko gdy natywne moduły są ok
  console.log(`[DB] Moduły natywne dostępne: ${nativeModulesAvailable}. Użycie JSI (Turbo Sync): ${useJsi}`);

  adapter = new SQLiteAdapter({
    schema,
    // migrations, // Odkomentuj, jeśli masz migracje
    dbName: dbName,
    jsi: useJsi,
    onSetUpError: (error: Error) => {
      console.error('[DB] KRYTYCZNY BŁĄD podczas konfiguracji adaptera SQLite:', error);
      // Tutaj można dodać logikę fallback lub powiadomienie użytkownika
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
    RecipeImageLocal, // Dodaj nowy lokalny model
  ],
});

console.log(`[DB] Instancja WatermelonDB utworzona (Adapter: ${DEBUG ? 'LokiJS' : 'SQLite'})`);

// --- Eksport ---
export default database;

// Opcjonalna funkcja inicjalizująca (może być wywołana w App.tsx)
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Można tu dodać logikę, która musi się wykonać po inicjalizacji,
    // np. sprawdzenie statusu migracji, ale podstawowa inicjalizacja
    // odbywa się synchronicznie przy tworzeniu instancji Database.
    console.log('[DB] Inicjalizacja bazy danych zakończona.');
    // Można tu np. uruchomić `populateDefaultTags` jeśli potrzeba
  } catch (error) {
    console.error('[DB] Błąd podczas dodatkowej inicjalizacji bazy danych:', error);
  }
};