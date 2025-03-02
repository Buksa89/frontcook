import { appSchema, tableSchema } from '@nozbe/watermelondb'
import { TableSchema, ColumnSchema, AppSchema } from '@nozbe/watermelondb'

// Wspólne kolumny synchronizacji
const syncColumns = [
  { name: 'sync_status', type: 'string' },
  { name: 'last_sync', type: 'string' },
  { name: 'is_local', type: 'boolean' },
  { name: 'owner', type: 'string', isOptional: true }
]

const tagsSchema: TableSchema = tableSchema({
  name: 'tags',
  columns: [
    // Note: local_id is automatically handled by WatermelonDB as 'id'
    { name: 'remote_id', type: 'string', isOptional: true }, // Using string for bigint to avoid JS number limitations
    { name: 'user_email', type: 'string', isOptional: true },
    { name: 'order', type: 'number' }, // For integers we use number type
    { name: 'name', type: 'string' }, // WatermelonDB doesn't have max length constraints at schema level
    ...syncColumns
  ]
})

const recipesSchema: TableSchema = tableSchema({
  name: 'recipes',
  columns: [
    // Note: local_id is automatically handled by WatermelonDB as 'id'
    { name: 'remote_id', type: 'string', isOptional: true }, // Using string for bigint
    { name: 'user_email', type: 'string', isOptional: true },
    { name: 'name', type: 'string' },
    { name: 'description', type: 'string', isOptional: true },
    { name: 'image', type: 'string', isOptional: true }, // We'll store the image path/url
    { name: 'rating', type: 'number', isOptional: true },
    { name: 'is_approved', type: 'boolean' },
    { name: 'prep_time', type: 'number', isOptional: true },
    { name: 'total_time', type: 'number', isOptional: true },
    { name: 'servings', type: 'number', isOptional: true },
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
    { name: 'remote_id', type: 'string', isOptional: true },
    { name: 'amount', type: 'number', isOptional: true },
    { name: 'unit', type: 'string', isOptional: true },
    { name: 'name', type: 'string' },
    { name: 'type', type: 'string', isOptional: true },
    { name: 'recipe_id', type: 'string' },
    { name: 'order', type: 'number' },
    { name: 'original_str', type: 'string' },
    ...syncColumns
  ],
  columnIndexes: [
    { columns: ['recipe_id', 'order'], unique: true }
  ]
})

// Nowy schemat dla przedmiotów do kupienia
const shoppingItemsSchema: TableSchema = tableSchema({
  name: 'shopping_items',
  columns: [
    { name: 'remote_id', type: 'string', isOptional: true },
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
const userSettingsSchema: TableSchema = tableSchema({
  name: 'user_settings',
  columns: [
    { name: 'language', type: 'string' },
    { name: 'auto_translate_recipes', type: 'boolean' },
    { name: 'allow_friends_views_recipes', type: 'boolean' },
    ...syncColumns
  ]
})

const schema: AppSchema = appSchema({
  version: 5, // Increasing version number for sync fields
  tables: [
    tagsSchema,
    recipesSchema,
    recipeTagsSchema,
    ingredientsSchema,
    shoppingItemsSchema,
    userSettingsSchema
  ]
})

export default schema 