import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations'
import { TableSchema, ColumnSchema } from '@nozbe/watermelondb'

interface Migration {
  toVersion: number
  steps: Array<{
    type: string
    name?: string
    columns?: ColumnSchema[]
    sql?: string
  }>
}

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        // Remove ingredients column from recipes
        {
          type: 'sql',
          sql: `ALTER TABLE recipes DROP COLUMN ingredients;`
        },
        // Create ingredients table
        createTable({
          name: 'ingredients',
          columns: [
            { name: 'remote_id', type: 'string', isOptional: true },
            { name: 'amount', type: 'number', isOptional: true },
            { name: 'unit', type: 'string', isOptional: true },
            { name: 'name', type: 'string', isOptional: true },
            { name: 'type', type: 'string', isOptional: true },
            { name: 'recipe_id', type: 'string' },
            { name: 'order', type: 'number' },
            { name: 'original_str', type: 'string' }
          ]
        })
      ]
    },
    {
      toVersion: 3,
      steps: [
        // Create shopping_items table
        createTable({
          name: 'shopping_items',
          columns: [
            { name: 'remote_id', type: 'string', isOptional: true },
            { name: 'amount', type: 'number', isOptional: true },
            { name: 'unit', type: 'string', isOptional: true },
            { name: 'name', type: 'string' },
            { name: 'type', type: 'string', isOptional: true },
            { name: 'order', type: 'number' },
            { name: 'is_checked', type: 'boolean' }
          ]
        })
      ]
    },
    {
      toVersion: 4,
      steps: [
        // Create user_settings table
        createTable({
          name: 'user_settings',
          columns: [
            { name: 'language', type: 'string' },
            { name: 'auto_translate_recipes', type: 'boolean' },
            { name: 'allow_friends_views_recipes', type: 'boolean' }
          ]
        })
      ]
    },
    {
      toVersion: 5,
      steps: [
        // Add sync fields to all tables
        {
          type: 'sql',
          sql: `
            -- Add sync fields to tags
            ALTER TABLE tags 
            ADD COLUMN sync_status TEXT DEFAULT 'synced',
            ADD COLUMN last_sync TEXT DEFAULT NULL,
            ADD COLUMN is_local INTEGER DEFAULT 0,
            ADD COLUMN owner TEXT DEFAULT NULL;

            -- Add sync fields to recipes
            ALTER TABLE recipes 
            ADD COLUMN sync_status TEXT DEFAULT 'synced',
            ADD COLUMN last_sync TEXT DEFAULT NULL,
            ADD COLUMN is_local INTEGER DEFAULT 0,
            ADD COLUMN owner TEXT DEFAULT NULL;

            -- Add sync fields to recipe_tags
            ALTER TABLE recipe_tags 
            ADD COLUMN sync_status TEXT DEFAULT 'synced',
            ADD COLUMN last_sync TEXT DEFAULT NULL,
            ADD COLUMN is_local INTEGER DEFAULT 0,
            ADD COLUMN owner TEXT DEFAULT NULL;

            -- Add sync fields to ingredients
            ALTER TABLE ingredients 
            ADD COLUMN sync_status TEXT DEFAULT 'synced',
            ADD COLUMN last_sync TEXT DEFAULT NULL,
            ADD COLUMN is_local INTEGER DEFAULT 0,
            ADD COLUMN owner TEXT DEFAULT NULL;

            -- Add sync fields to shopping_items
            ALTER TABLE shopping_items 
            ADD COLUMN sync_status TEXT DEFAULT 'synced',
            ADD COLUMN last_sync TEXT DEFAULT NULL,
            ADD COLUMN is_local INTEGER DEFAULT 0,
            ADD COLUMN owner TEXT DEFAULT NULL;

            -- Add sync fields to user_settings
            ALTER TABLE user_settings 
            ADD COLUMN sync_status TEXT DEFAULT 'synced',
            ADD COLUMN last_sync TEXT DEFAULT NULL,
            ADD COLUMN is_local INTEGER DEFAULT 0,
            ADD COLUMN owner TEXT DEFAULT NULL;
          `
        }
      ]
    },
    {
      toVersion: 6,
      steps: [
        {
          type: 'sql',
          sql: `
            -- Add is_deleted field to tags
            ALTER TABLE tags 
            ADD COLUMN is_deleted INTEGER DEFAULT 0;

            -- Add is_deleted field to recipes
            ALTER TABLE recipes 
            ADD COLUMN is_deleted INTEGER DEFAULT 0;

            -- Add is_deleted field to recipe_tags
            ALTER TABLE recipe_tags 
            ADD COLUMN is_deleted INTEGER DEFAULT 0;

            -- Add is_deleted field to ingredients
            ALTER TABLE ingredients 
            ADD COLUMN is_deleted INTEGER DEFAULT 0;

            -- Add is_deleted field to shopping_items
            ALTER TABLE shopping_items 
            ADD COLUMN is_deleted INTEGER DEFAULT 0;

            -- Add is_deleted field to user_settings
            ALTER TABLE user_settings 
            ADD COLUMN is_deleted INTEGER DEFAULT 0;
          `
        }
      ]
    }
  ]
}) 