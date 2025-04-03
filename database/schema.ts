import { appSchema, tableSchema } from '@nozbe/watermelondb'
import { TableSchema, ColumnSchema, AppSchema } from '@nozbe/watermelondb'

// Wspólne kolumny synchronizacji
const syncColumns: ColumnSchema[] = [
  { name: 'sync_id', type: 'string' as const },
  { name: 'sync_status', type: 'string' as const },
  { name: 'last_update', type: 'number' as const, isOptional: true },
  { name: 'is_local', type: 'boolean' as const, isOptional: true },
  { name: 'owner', type: 'string' as const, isOptional: true },
  { name: 'is_deleted', type: 'boolean' as const, isOptional: false }
]

const tagsSchema: TableSchema = tableSchema({
  name: 'tags',
  columns: [
    // Note: local_id is automatically handled by WatermelonDB as 'id'
    { name: 'order', type: 'number' }, // For integers we use number type
    { name: 'name', type: 'string' }, // WatermelonDB doesn't have max length constraints at schema level
    ...syncColumns
  ]
})

const recipesSchema: TableSchema = tableSchema({
  name: 'recipes',
  columns: [
    // Note: local_id is automatically handled by WatermelonDB as 'id'
    { name: 'name', type: 'string' },
    { name: 'description', type: 'string', isOptional: true },
    { name: 'image', type: 'string', isOptional: true }, // We'll store the image path/url
    { name: 'rating', type: 'number' },
    { name: 'is_approved', type: 'boolean' },
    { name: 'prep_time', type: 'number' },
    { name: 'total_time', type: 'number' },
    { name: 'servings', type: 'number' },
    { name: 'instructions', type: 'string', isOptional: true },
    { name: 'notes', type: 'string', isOptional: true },
    { name: 'nutrition', type: 'string', isOptional: true },
    { name: 'video', type: 'string', isOptional: true }, // For URLField
    { name: 'source', type: 'string', isOptional: true },
    ...syncColumns
  ]
})

const recipeTagsSchema: TableSchema = tableSchema({
  name: 'recipe_tags',
  columns: [
    { name: 'recipe_id', type: 'string' }, // References the recipe.id
    { name: 'tag_id', type: 'string' }, // References the tag.id
    ...syncColumns
  ]
})

const ingredientsSchema: TableSchema = tableSchema({
  name: 'ingredients',
  columns: [
    { name: 'amount', type: 'number', isOptional: true },
    { name: 'unit', type: 'string', isOptional: true },
    { name: 'name', type: 'string' },
    { name: 'type', type: 'string', isOptional: true },
    { name: 'recipe_id', type: 'string' },
    { name: 'order', type: 'number' },
    { name: 'original_str', type: 'string' },
    ...syncColumns
  ]
})

// Nowy schemat dla przedmiotów do kupienia
const shoppingItemsSchema: TableSchema = tableSchema({
  name: 'shopping_items',
  columns: [
    { name: 'amount', type: 'number', isOptional: true },
    { name: 'unit', type: 'string', isOptional: true },
    { name: 'name', type: 'string', isIndexed: true },
    { name: 'type', type: 'string', isOptional: true },
    { name: 'order', type: 'number', isIndexed: true },
    { name: 'is_checked', type: 'boolean', isOptional: false, isIndexed: true },
    ...syncColumns
  ]
})

// Schema for user settings
const localUserSettingsSchema: TableSchema = tableSchema({
  name: 'user_settings',
  columns: [
    { name: 'language', type: 'string' },
    ...syncColumns
  ]
})

// Schema for notifications
const notificationsSchema: TableSchema = tableSchema({
  name: 'notifications',
  columns: [
    { name: 'content', type: 'string' },
    { name: 'type', type: 'string' }, // 'warn' or 'info'
    { name: 'link', type: 'string', isOptional: true },
    { name: 'is_readed', type: 'boolean', isIndexed: true },
    { name: 'order', type: 'number', isIndexed: true },
    ...syncColumns
  ]
})

// Schema forapp data (including last sync per user)
const AppDataSchema: TableSchema = tableSchema({
  name: 'app_data',
  columns: [
    { name: 'last_sync', type: 'number' as const, isOptional: true },
    { name: 'subscription_end', type: 'number' as const, isOptional: true },
    { name: 'csv_lock', type: 'string', isOptional: true },
    ...syncColumns
  ]
})

const schema: AppSchema = appSchema({
  version: 10, // Updated to version 10 for making recipe fields non-nullable
  tables: [
    tagsSchema,
    recipesSchema,
    recipeTagsSchema,
    ingredientsSchema,
    shoppingItemsSchema,
    localUserSettingsSchema,
    notificationsSchema,
    AppDataSchema
  ]
})

export default schema 