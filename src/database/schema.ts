import { appSchema, tableSchema } from '@nozbe/watermelondb';
import type { TableSchema, ColumnSchema, AppSchema } from '@nozbe/watermelondb';

// Kolumny wspólne dla wszystkich synchronizowanych tabel (poza ID)
const baseSyncColumns: ColumnSchema[] = [
  { name: 'user_id', type: 'string', isIndexed: true },
  { name: 'last_modified', type: 'number', isIndexed: true },
  { name: 'created_at', type: 'number' },
];

// Kolumny dla tagów (userId opcjonalne)
const tagSyncColumns: ColumnSchema[] = [
  { name: 'user_id', type: 'string', isIndexed: true, isOptional: true },
  { name: 'last_modified', type: 'number', isIndexed: true },
  { name: 'created_at', type: 'number' },
];

// --- Definicje Tabel ---

const tagsSchema: TableSchema = tableSchema({
  name: 'tags', // Zmieniono z recipe_tags na 'tags' zgodnie z logiką modeli
  columns: [
    { name: 'name', type: 'string', isIndexed: true },
    { name: 'order', type: 'number' },
    ...tagSyncColumns,
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
    // Zmieniono nazwy pól video i source zgodnie z dokumentacją backendu
    { name: 'video', type: 'string', isOptional: true },
    { name: 'source', type: 'string', isOptional: true },
    { name: 'image_url', type: 'string', isOptional: true }, // Dodano pole image_url
    ...baseSyncColumns,
  ]
});

// Tabela pośrednicząca Recipe-Tag
const recipeTagsThroughSchema: TableSchema = tableSchema({
  name: 'recipe_tags', // Zmieniono nazwę na zgodną z backendem i poprzednim schematem WDB
  columns: [
    { name: 'recipe_id', type: 'string', isIndexed: true },
    { name: 'tag_id', type: 'string', isIndexed: true },
    ...baseSyncColumns,
  ]
});

const ingredientsSchema: TableSchema = tableSchema({
  name: 'ingredients',
  columns: [
    { name: 'recipe_id', type: 'string', isIndexed: true },
    { name: 'amount', type: 'string', isOptional: true }, // Używamy string zgodnie z API
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
    { name: 'amount', type: 'string', isOptional: true }, // Używamy string zgodnie z API
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
    ...baseSyncColumns,
  ]
});

const notificationsSchema: TableSchema = tableSchema({
  name: 'notifications',
  columns: [
    { name: 'content', type: 'string' },
    { name: 'type', type: 'string' },
    { name: 'link', type: 'string', isOptional: true },
    { name: 'is_read', type: 'boolean', isIndexed: true },
    { name: 'order', type: 'number', isIndexed: true },
    ...baseSyncColumns,
  ]
});

const userProfileSchema: TableSchema = tableSchema({
  name: 'user_profile',
  columns: [
    // Zmieniono typy na string zgodnie z API (ISO 8601)
    { name: 'subscription_end', type: 'string', isOptional: true },
    { name: 'csv_lock', type: 'string', isOptional: true },
    ...baseSyncColumns,
  ]
});

// NOWA: Lokalna tabela obrazków (niesynchronizowana)
const recipeImagesLocalSchema: TableSchema = tableSchema({
  name: 'recipe_images_local', // Nowa nazwa
  columns: [
    { name: 'recipe_id', type: 'string', isIndexed: true },
    { name: 'local_path', type: 'string', isOptional: true },
    { name: 'local_thumbnail_path', type: 'string', isOptional: true },
    { name: 'original_remote_url', type: 'string', isOptional: true },
    { name: 'last_processed_timestamp', type: 'number', isOptional: true },
    // BRAK KOLUMN SYNC (user_id, last_modified, created_at)
  ]
});


// --- Główny Schemat Aplikacji ---
const schema: AppSchema = appSchema({
  version: 1, // Zaczynamy od wersji 1 dla nowego schematu
  tables: [
    tagsSchema,
    recipesSchema,
    recipeTagsThroughSchema, // Zmieniono nazwę
    ingredientsSchema,
    shoppingItemsSchema,
    clientUserSettingsSchema,
    notificationsSchema,
    userProfileSchema,
    recipeImagesLocalSchema, // Dodano nową lokalną tabelę
  ]
});

export default schema;