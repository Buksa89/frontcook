// database/index.ts
import { Platform } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema from './schema';
import migrations from './migrations'; // BARDZO WAŻNE: Muszą być aktualne do schema.version!

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

// --- Konfiguracja Adaptera ---
const adapter = new SQLiteAdapter({
  schema,
  migrations, // Przekaż migracje
  jsi: Platform.OS === 'ios' || Platform.OS === 'android', // Włącz JSI dla natywnych platform
  onSetUpError: (error: Error) => {
    console.error('!!!!!!!!!!!! WATERMELONDB SETUP ERROR !!!!!!!!!!!!!', error);
  },
});

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
    RecipeImage,
    // Usunięto Source
  ],
});

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
// Wywołaj tworzenie tagów po inicjalizacji bazy
// Użyj .then() dla pewności, że baza jest gotowa, lub umieść w innym miejscu logiki startowej
database.adapter.underlyingAdapter // Poczekaj na gotowość adaptera (trochę hack, ale często działa)
  // @ts-ignore
  .then(() => populateDefaultTags())
  .catch(err => console.error("Błąd podczas inicjalizacji tagów po gotowości adaptera:", err));


// --- Eksporty ---
export default database;

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