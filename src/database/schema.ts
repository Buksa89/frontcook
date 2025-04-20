// src/database/schema.ts
import { appSchema, tableSchema } from '@nozbe/watermelondb';
import type { TableSchema, ColumnSchema, AppSchema } from '@nozbe/watermelondb';

// --- ZMIANA: user_id jest teraz opcjonalne ---
const baseSyncColumns: ColumnSchema[] = [
  { name: 'user_id', type: 'string', isIndexed: true, isOptional: true }, // KLUCZOWA ZMIANA
  { name: 'last_modified', type: 'number', isIndexed: true },
  { name: 'created_at', type: 'number' },
];

// Kolumny dla tagów (userId opcjonalne) - bez zmian, już było opcjonalne
const tagSyncColumns: ColumnSchema[] = [
  { name: 'user_id', type: 'string', isIndexed: true, isOptional: true },
  { name: 'last_modified', type: 'number', isIndexed: true },
  { name: 'created_at', type: 'number' },
];

// --- Definicje Tabel (używają teraz baseSyncColumns z opcjonalnym user_id) ---

const tagsSchema: TableSchema = tableSchema({
  name: 'tags',
  columns: [ { name: 'name', type: 'string', isIndexed: true }, { name: 'order', type: 'number' }, ...tagSyncColumns ]
});

const recipesSchema: TableSchema = tableSchema({
  name: 'recipes',
  columns: [
    { name: 'name', type: 'string', isIndexed: true }, { name: 'description', type: 'string', isOptional: true },
    { name: 'rating', type: 'number', isOptional: true }, { name: 'is_approved', type: 'boolean', isOptional: true },
    { name: 'prep_time', type: 'number', isOptional: true }, { name: 'total_time', type: 'number', isOptional: true },
    { name: 'servings', type: 'number', isOptional: true }, { name: 'instructions', type: 'string', isOptional: true },
    { name: 'notes', type: 'string', isOptional: true }, { name: 'nutrition', type: 'string', isOptional: true },
    { name: 'video', type: 'string', isOptional: true }, { name: 'source', type: 'string', isOptional: true },
    { name: 'image_url', type: 'string', isOptional: true },
    ...baseSyncColumns, // Teraz user_id jest opcjonalne
  ]
});

const recipeTagsThroughSchema: TableSchema = tableSchema({
  name: 'recipe_tags',
  columns: [
    { name: 'recipe_id', type: 'string', isIndexed: true }, { name: 'tag_id', type: 'string', isIndexed: true },
    ...baseSyncColumns, // Teraz user_id jest opcjonalne
  ]
});

const ingredientsSchema: TableSchema = tableSchema({
  name: 'ingredients',
  columns: [
    { name: 'recipe_id', type: 'string', isIndexed: true }, { name: 'amount', type: 'string', isOptional: true },
    { name: 'unit', type: 'string', isOptional: true }, { name: 'name', type: 'string' },
    { name: 'type', type: 'string', isOptional: true }, { name: 'order', type: 'number' },
    { name: 'original_str', type: 'string', isOptional: true },
    ...baseSyncColumns, // Teraz user_id jest opcjonalne
  ]
});

const shoppingItemsSchema: TableSchema = tableSchema({
  name: 'shopping_items',
  columns: [
    { name: 'amount', type: 'string', isOptional: true }, { name: 'unit', type: 'string', isOptional: true },
    { name: 'name', type: 'string', isIndexed: true }, { name: 'type', type: 'string', isOptional: true },
    { name: 'order', type: 'number', isIndexed: true }, { name: 'is_checked', type: 'boolean', isIndexed: true },
    ...baseSyncColumns, // Teraz user_id jest opcjonalne
  ]
});

// UserProfile i ClientUserSettings zakładamy, że ZAWSZE mają user_id po synchronizacji
// Jeśli ClientUserSettings może być tworzone offline, też potrzebuje opcjonalnego user_id
// Załóżmy na razie, że ClientUserSettings też może być offline:
const clientUserSettingsSchema: TableSchema = tableSchema({
  name: 'client_user_settings',
  columns: [
    { name: 'language', type: 'string' },
    ...baseSyncColumns, // Teraz user_id jest opcjonalne
  ]
});

const notificationsSchema: TableSchema = tableSchema({
  name: 'notifications',
  columns: [
    { name: 'content', type: 'string' }, { name: 'type', type: 'string' },
    { name: 'link', type: 'string', isOptional: true }, { name: 'is_read', type: 'boolean', isIndexed: true },
    { name: 'order', type: 'number', isIndexed: true },
    ...baseSyncColumns, // Teraz user_id jest opcjonalne
  ]
});

// UserProfile jest read-only i ZAWSZE powinien mieć user_id po PULL
const userProfileSchema: TableSchema = tableSchema({
  name: 'user_profile',
  columns: [
    { name: 'subscription_end', type: 'string', isOptional: true }, { name: 'csv_lock', type: 'string', isOptional: true },
    // Używamy baseSyncColumns, ale w praktyce user_id tu NIGDY nie będzie null po stronie klienta
    // Jeśli byśmy pozwolili na tworzenie UserProfile offline (bez sensu), musiałoby być opcjonalne.
    ...baseSyncColumns,
  ]
});

const recipeImagesLocalSchema: TableSchema = tableSchema({
  name: 'recipe_images_local',
  columns: [
    { name: 'recipe_id', type: 'string', isIndexed: true }, { name: 'local_path', type: 'string', isOptional: true },
    { name: 'local_thumbnail_path', type: 'string', isOptional: true }, { name: 'original_remote_url', type: 'string', isOptional: true },
    { name: 'last_processed_timestamp', type: 'number', isOptional: true },
  ]
});


// --- Główny Schemat Aplikacji ---
const schema: AppSchema = appSchema({
  // --- WAŻNE: Podbijamy wersję schematu ---
  version: 2,
  tables: [
    tagsSchema, recipesSchema, recipeTagsThroughSchema, ingredientsSchema,
    shoppingItemsSchema, clientUserSettingsSchema, notificationsSchema,
    userProfileSchema, recipeImagesLocalSchema,
  ]
});

export default schema;