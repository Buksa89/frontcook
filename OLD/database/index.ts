// database/index.ts
import { Platform, NativeModules } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { Q } from '@nozbe/watermelondb';
import { Collection, Model } from '@nozbe/watermelondb';

import schema from './schema';
import migrations from './migrations'; // BARDZO WAŻNE: Muszą być aktualne do schema.version!
import { DEBUG } from '../app/constants/env'; // Import zmiennej DEBUG

// Importuj NOWE definicje modeli
import { Tag } from './models/Tag';
import { Recipe } from './models/Recipe';
import { RecipeTag } from './models/RecipeTag';
import { Ingredient } from './models/Ingredient';
import { ShoppingItem } from './models/ShoppingItem';
import { ClientUserSettings } from './models/ClientUserSettings'; // Poprawiono import - default export
import { Notification } from './models/Notification';
import { UserProfile } from './models/UserProfile'; // Poprawiono import - default export
import { RecipeImage } from './models/RecipeImage';
// Usunięto import Source

// Funkcja pomocnicza do sprawdzania dostępności modułów natywnych
const isWatermelonDBNativeAvailable = (): boolean => {
  try {
    return (
      Platform.OS === 'ios' || Platform.OS === 'android') && 
      NativeModules && 
      NativeModules.WMDatabaseBridge !== undefined && 
      NativeModules.WMDatabaseBridge !== null;
  } catch (e) {
    console.warn('[DB] Nie można sprawdzić dostępności modułów natywnych WatermelonDB:', e);
    return false;
  }
};

// --- Konfiguracja Adaptera ---
// Wybierz adapter na podstawie trybu DEBUG
let adapter;

if (DEBUG) {
  console.log('[DB] Tryb DEBUG: Używam adaptera LokiJS (JavaScript-only)');
  adapter = new LokiJSAdapter({
    schema,
    migrations,
    useWebWorker: false, // Web worker może powodować problemy na niektórych platformach
    useIncrementalIndexedDB: true,
  });
} else {
  console.log('[DB] Tryb PRODUKCYJNY: Używam adaptera SQLite (natywny)');
  // Sprawdź dostępność modułów natywnych tylko w trybie produkcyjnym
  const nativeModulesAvailable = isWatermelonDBNativeAvailable();
  console.log(`[DB] Moduły natywne dostępne: ${nativeModulesAvailable ? 'TAK' : 'NIE'}`);
  
  adapter = new SQLiteAdapter({
    schema,
    migrations,
    jsi: nativeModulesAvailable, // Użyj JSI tylko gdy moduły natywne są dostępne
    onSetUpError: (error: Error) => {
      console.error('[DB] BŁĄD KONFIGURACJI SQLITE:', error);
    },
  });
}

// --- Tworzenie Instancji Bazy Danych ---
let database: Database;
try {
  database = new Database({
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
      RecipeImage,
      // Usunięto Source
    ],
  });
  
  console.log(`[DB] Baza danych zainicjalizowana pomyślnie (adapter: ${DEBUG ? 'LokiJS' : 'SQLite'})`);
} catch (error) {
  console.error('[DB] Krytyczny błąd podczas inicjalizacji bazy danych:', error);
  // Fallback do pustej bazy danych
  database = new Database({
    adapter: new LokiJSAdapter({ schema, migrations, useWebWorker: false }),
    modelClasses: [
      Tag, Recipe, RecipeTag, Ingredient, ShoppingItem, 
      ClientUserSettings, Notification, UserProfile, RecipeImage
    ],
  });
  console.warn('[DB] Utworzono fallback bazy danych z LokiJS');
}

// --- Logika Tworzenia Domyślnych Tagów (Dostosowana) ---

interface DefaultTag {
  name: string;
  order: number;
}

const defaultTags: DefaultTag[] = [
    { name: 'Śniadanie', order: 1 }, { name: 'Obiad', order: 2 }, { name: 'Kolacja', order: 3 },
    { name: 'Deser', order: 4 }, { name: 'Napoje', order: 5 }, { name: 'Wege', order: 6 },
    { name: 'Wegan', order: 7 }, { name: 'LowCarb', order: 8 }, { name: 'Keto', order: 9 },
    { name: 'Bez glutenu', order: 10 }, { name: 'Bez laktozy', order: 11 }
];

async function populateDefaultTags(): Promise<void> {
  try {
    const tagsCollection = database.get<Tag>(Tag.table);

    // Sprawdź, czy istnieją już tagi systemowe (z userId=null)
    const existingSystemTags = await tagsCollection.query(
        // @ts-ignore - Pozwalamy na Q.where('user_id', null), jeśli schemat na to pozwala
        Q.where('user_id', null)
    ).fetchCount(); // Sprawdź tylko liczbę

    if (existingSystemTags === 0) {
      console.log('[DB Index] Tworzenie domyślnych tagów systemowych...');
      await database.write(async () => {
        for (const tagData of defaultTags) {
          // Sprawdź dodatkowo nazwę, aby uniknąć duplikatów, jeśli logika sprawdzania się zmieni
          const exists = await tagsCollection.query(
              Q.where('name', tagData.name),
              // @ts-ignore
              Q.where('user_id', null)
          ).fetchCount() > 0;

          if (!exists) {
              await tagsCollection.create(tag => {
                tag.name = tagData.name;
                tag.order = tagData.order;
                // @ts-ignore - Przypisujemy null do userId (zakładając isOptional: true w schemacie)
                tag.userId = null;
                // Nie ustawiamy lastModified ani createdAt ręcznie
              });
          }
        }
      });
      console.log('[DB Index] Domyślne tagi systemowe utworzone pomyślnie.');
    } else {
      console.log('[DB Index] Tagi systemowe już istnieją, pomijanie tworzenia.');
    }
  } catch (error) {
    console.error('[DB Index] Błąd podczas tworzenia domyślnych tagów:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// --- Inicjalizacja Bazy Danych z Domyślnymi Danymi ---
// Zabezpieczone wywołanie tworzenia tagów po inicjalizacji bazy
try {
  console.log(`[DB] Inicjalizacja domyślnych danych z adapterem ${DEBUG ? 'LokiJS' : 'SQLite'}`);
  
  if (DEBUG) {
    // W trybie DEBUG z LokiJS nie potrzebujemy czekać na adapter
    setTimeout(() => {
      try {
        populateDefaultTags();
      } catch (error) {
        console.error('[DB] Błąd podczas tworzenia domyślnych tagów (LokiJS):', error);
      }
    }, 500); // Małe opóźnienie dla bezpieczeństwa
  } else {
    // W trybie produkcyjnym czekamy na gotowość adaptera SQLite
    database.adapter.underlyingAdapter
      // @ts-ignore
      .then(() => {
        console.log('[DB] Adapter SQLite gotowy, tworzenie domyślnych tagów...');
        return populateDefaultTags();
      })
      .catch((err: Error) => {
        console.error("[DB] Błąd podczas inicjalizacji tagów po gotowości adaptera SQLite:", err);
      });
  }
} catch (e) {
  console.warn('[DB] Błąd podczas konfiguracji adaptera:', e);
  // Próbujemy mimo wszystko stworzyć tagi w trybie awaryjnym
  setTimeout(() => {
    try {
      populateDefaultTags();
    } catch (ex) {
      console.error('[DB] Niepowodzenie tworzenia tagów w trybie awaryjnym:', ex);
    }
  }, 1000);
}


// --- Eksporty ---
export default database;

// Funkcja pomocnicza do bezpiecznego pobierania modeli (do użycia w kodzie aplikacji)
export const safeGetCollection = <T extends Model>(tableName: string): { collection: Collection<T>, query: (q: any) => Promise<T[]>, observe: () => any } => {
  try {
    const collection = database.get<T>(tableName);
    
    // Dodatkowe zabezpieczenie sprawdzające typ adaptera
    const isLokiAdapter = DEBUG;
    if (isLokiAdapter) {
      console.log(`[DB] Używam LokiJS dla kolekcji ${tableName}`);
    }
    
    return {
      collection,
      query: async (q: any) => {
        try {
          return await collection.query(q).fetch() as T[];
        } catch (e) {
          console.error(`[DB] Błąd przy zapytaniu do tabeli ${tableName}:`, e);
          return [] as T[];
        }
      },
      observe: () => {
        try {
          return collection.query().observe();
        } catch (e) {
          console.error(`[DB] Błąd przy obserwacji tabeli ${tableName}:`, e);
          // Tworzenie pustego Observable
          return { 
            subscribe: (observer: any) => {
              // Emituj pustą tablicę na początek
              if (observer.next) {
                observer.next([]);
              }
              // Zwróć pusty unsubscribe
              return { unsubscribe: () => {} };
            } 
          };
        }
      }
    };
  } catch (e) {
    console.error(`[DB] Błąd przy pobieraniu kolekcji ${tableName}:`, e);
    // Zwróć bezpieczne "mock" implementacje
    return {
      collection: null as any,
      query: async () => [] as T[],
      observe: () => ({ 
        subscribe: (observer: any) => {
          if (observer.next) {
            observer.next([]);
          }
          return { unsubscribe: () => {} };
        } 
      })
    };
  }
};

// Test bazy danych w trybie DEBUG
if (DEBUG) {
  setTimeout(() => {
    try {
      const testCollection = database.get(Tag.table);
      console.log(`[DB] Test dostępu do bazy: Tabela ${Tag.table} dostępna`);
    } catch (e) {
      console.warn(`[DB] Test dostępu do bazy: BŁĄD przy dostępie do tabeli ${Tag.table}:`, e);
    }
  }, 2000); // Dajemy 2 sekundy na inicjalizację
}

export type {
    Tag,
    Recipe,
    RecipeTag,
    Ingredient,
    ShoppingItem,
    ClientUserSettings,
    Notification,
    UserProfile,
    RecipeImage,
    // Usunięto Source
};