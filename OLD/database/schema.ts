// database/schema.ts
import { appSchema, tableSchema } from '@nozbe/watermelondb';
import type { TableSchema, ColumnSchema, AppSchema } from '@nozbe/watermelondb';

// --- NOWY SCHEMAT Z KOLUMNAMI DLA WDB SYNC ---

// Kolumny wspólne dla wszystkich synchronizowanych tabel (poza ID)
const baseSyncColumns: ColumnSchema[] = [
  // Klucz obcy do użytkownika
  { name: 'user_id', type: 'string', isIndexed: true }, // Zwykle wymagane dla danych użytkownika
  // Kluczowy dla mechanizmu PULL
  { name: 'last_modified', type: 'number', isIndexed: true },
  // Wymagane przez WDB (lub silnie zalecane), nie opcjonalne
  { name: 'created_at', type: 'number' }, // *** POPRAWKA: Usunięto isOptional: true ***
];

// Kolumny dla tagów systemowych/użytkownika
const tagSyncColumns: ColumnSchema[] = [
  // userId jest opcjonalne dla tagów systemowych (null)
  { name: 'user_id', type: 'string', isIndexed: true, isOptional: true }, // *** POPRAWKA: isOptional: true ***
  { name: 'last_modified', type: 'number', isIndexed: true },
  { name: 'created_at', type: 'number' },
];


// --- Definicje Tabel ---

const tagsSchema: TableSchema = tableSchema({
  name: 'recipe_tags', // Nazwa tabeli dla Tagów
  columns: [
    { name: 'name', type: 'string', isIndexed: true },
    { name: 'order', type: 'number' },
    ...tagSyncColumns, // Używamy specjalnych kolumn dla tagów
  ]
});

const recipesSchema: TableSchema = tableSchema({
  name: 'recipes',
  columns: [
    { name: 'name', type: 'string', isIndexed: true },
    { name: 'description', type: 'string', isOptional: true },
    { name: 'rating', type: 'number', isOptional: true },
    { name: 'is_approved', type: 'boolean', isOptional: true },
    { name: 'prep_time', type: 'number', isOptional: true },
    { name: 'total_time', type: 'number', isOptional: true },
    { name: 'servings', type: 'number', isOptional: true },
    { name: 'instructions', type: 'string', isOptional: true },
    { name: 'notes', type: 'string', isOptional: true },
    { name: 'nutrition', type: 'string', isOptional: true },
    { name: 'video_url', type: 'string', isOptional: true },
    { name: 'source_url', type: 'string', isOptional: true },
    // Usunięto source_obj_id, bo nie ma modelu Source
    ...baseSyncColumns,
  ]
});

// Tabela pośrednicząca Recipe-Tag
const recipeTagsThroughSchema: TableSchema = tableSchema({
  name: 'recipe_tags_through',
  columns: [
    { name: 'recipe_id', type: 'string', isIndexed: true },
    { name: 'tag_id', type: 'string', isIndexed: true },
    ...baseSyncColumns, // Powiązanie też należy do użytkownika
  ]
});

const ingredientsSchema: TableSchema = tableSchema({
  name: 'ingredients',
  columns: [
    { name: 'recipe_id', type: 'string', isIndexed: true },
    { name: 'amount', type: 'number', isOptional: true },
    { name: 'unit', type: 'string', isOptional: true },
    { name: 'name', type: 'string' },
    { name: 'type', type: 'string', isOptional: true },
    { name: 'order', type: 'number' },
    { name: 'original_str', type: 'string', isOptional: true },
    ...baseSyncColumns,
  ]
});

const shoppingItemsSchema: TableSchema = tableSchema({
  name: 'shopping_items',
  columns: [
    { name: 'amount', type: 'number', isOptional: true },
    { name: 'unit', type: 'string', isOptional: true },
    { name: 'name', type: 'string', isIndexed: true },
    { name: 'type', type: 'string', isOptional: true },
    { name: 'order', type: 'number', isIndexed: true },
    { name: 'is_checked', type: 'boolean', isIndexed: true },
    ...baseSyncColumns,
  ]
});

const clientUserSettingsSchema: TableSchema = tableSchema({
  name: 'client_user_settings',
  columns: [
    { name: 'language', type: 'string' },
    ...baseSyncColumns, // Ustawienia też należą do użytkownika
  ]
});

const notificationsSchema: TableSchema = tableSchema({
  name: 'notifications',
  columns: [
    { name: 'content', type: 'string' },
    { name: 'type', type: 'string' },
    { name: 'link', type: 'string', isOptional: true },
    { name: 'is_read', type: 'boolean', isIndexed: true }, // Poprawiona nazwa
    { name: 'order', type: 'number', isIndexed: true },
    ...baseSyncColumns,
  ]
});

const userProfileSchema: TableSchema = tableSchema({
  name: 'user_profile',
  columns: [
    { name: 'subscription_end', type: 'number' }, // Wymagane?
    { name: 'csv_lock', type: 'number' }, // Wymagane?
    ...baseSyncColumns,
  ]
});

const recipeImagesSchema: TableSchema = tableSchema({
  name: 'recipe_images',
  columns: [
    { name: 'recipe_id', type: 'string', isIndexed: true },
    { name: 'image_url', type: 'string', isOptional: true },
    // { name: 'thumbnail_url', type: 'string', isOptional: true }, // Opcjonalna miniaturka
    { name: 'order', type: 'number' },
    ...baseSyncColumns,
  ]
});

// Usunięto sourcesSchema


// --- Główny Schemat Aplikacji ---
const schema: AppSchema = appSchema({
  // Zwiększ wersję, jeśli wprowadzasz zmiany w schemacie!
  // Jeśli wprowadziłeś zmiany w baseSyncColumns i tagSyncColumns,
  // a poprzednia wersja to 13, teraz powinno być 14.
  version: 14, // *** ZAKTUALIZUJ WERSJĘ ***
  tables: [
    tagsSchema,             // 'recipe_tags'
    recipesSchema,          // 'recipes'
    recipeTagsThroughSchema,// 'recipe_tags_through'
    ingredientsSchema,      // 'ingredients'
    shoppingItemsSchema,    // 'shopping_items'
    clientUserSettingsSchema,// 'client_user_settings'
    notificationsSchema,    // 'notifications'
    userProfileSchema,      // 'user_profile'
    recipeImagesSchema,     // 'recipe_images'
    // Usunięto sourcesSchema
  ]
});

export default schema;