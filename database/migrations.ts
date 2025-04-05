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
            { name: 'language', type: 'string' }
          ]
        })
      ]
    },
    {
      toVersion: 5,
      steps: [
        // Add sync fields to all tables
        // Note: Using addColumns instead of raw SQL to ensure proper typing
        addColumns({
          table: 'tags',
          columns: [
            { name: 'sync_status', type: 'string' },
            { name: 'last_update', type: 'number' },
            { name: 'is_local', type: 'boolean' },
            { name: 'owner', type: 'string', isOptional: true }
          ]
        }),
        addColumns({
          table: 'recipes',
          columns: [
            { name: 'sync_status', type: 'string' },
            { name: 'last_update', type: 'number' },
            { name: 'is_local', type: 'boolean' },
            { name: 'owner', type: 'string', isOptional: true }
          ]
        }),
        addColumns({
          table: 'recipe_tags',
          columns: [
            { name: 'sync_status', type: 'string' },
            { name: 'last_update', type: 'number' },
            { name: 'is_local', type: 'boolean' },
            { name: 'owner', type: 'string', isOptional: true }
          ]
        }),
        addColumns({
          table: 'ingredients',
          columns: [
            { name: 'sync_status', type: 'string' },
            { name: 'last_update', type: 'number' },
            { name: 'is_local', type: 'boolean' },
            { name: 'owner', type: 'string', isOptional: true }
          ]
        }),
        addColumns({
          table: 'shopping_items',
          columns: [
            { name: 'sync_status', type: 'string' },
            { name: 'last_update', type: 'number' },
            { name: 'is_local', type: 'boolean' },
            { name: 'owner', type: 'string', isOptional: true }
          ]
        }),
        addColumns({
          table: 'user_settings',
          columns: [
            { name: 'sync_status', type: 'string' },
            { name: 'last_update', type: 'number' },
            { name: 'is_local', type: 'boolean' },
            { name: 'owner', type: 'string', isOptional: true }
          ]
        })
      ]
    },
    {
      toVersion: 6,
      steps: [
        // Add is_deleted fields
        addColumns({
          table: 'tags',
          columns: [
            { name: 'is_deleted', type: 'boolean' }
          ]
        }),
        addColumns({
          table: 'recipes',
          columns: [
            { name: 'is_deleted', type: 'boolean' }
          ]
        }),
        addColumns({
          table: 'recipe_tags',
          columns: [
            { name: 'is_deleted', type: 'boolean' }
          ]
        }),
        addColumns({
          table: 'ingredients',
          columns: [
            { name: 'is_deleted', type: 'boolean' }
          ]
        }),
        addColumns({
          table: 'shopping_items',
          columns: [
            { name: 'is_deleted', type: 'boolean' }
          ]
        }),
        addColumns({
          table: 'user_settings',
          columns: [
            { name: 'is_deleted', type: 'boolean' }
          ]
        })
      ]
    },
    {
      toVersion: 7,
      steps: [
        // Create notifications table
        createTable({
          name: 'notifications',
          columns: [
            { name: 'content', type: 'string' },
            { name: 'type', type: 'string' },
            { name: 'link', type: 'string', isOptional: true },
            { name: 'is_readed', type: 'boolean' },
            { name: 'sync_id', type: 'string' },
            { name: 'sync_status', type: 'string' },
            { name: 'last_update', type: 'number', isOptional: true },
            { name: 'is_local', type: 'boolean', isOptional: true },
            { name: 'owner', type: 'string', isOptional: true },
            { name: 'is_deleted', type: 'boolean' }
          ]
        })
      ]
    },
    {
      toVersion: 8,
      steps: [
        // Add order column to notifications table
        addColumns({
          table: 'notifications',
          columns: [
            { name: 'order', type: 'number' }
          ]
        })
      ]
    },
    {
      toVersion: 9,
      steps: [
        // Create app_data table with correct sync fields
        createTable({
          name: 'app_data',
          columns: [
            { name: 'last_sync', type: 'number', isOptional: true },
            { name: 'subscription_end', type: 'number', isOptional: true },
            { name: 'csv_lock', type: 'string', isOptional: true },
            { name: 'sync_id', type: 'string' },
            { name: 'sync_status', type: 'string' },
            { name: 'last_update', type: 'number', isOptional: true },
            { name: 'is_local', type: 'boolean', isOptional: true },
            { name: 'owner', type: 'string', isOptional: true },
            { name: 'is_deleted', type: 'boolean' }
          ]
        })
      ]
    },
    {
      toVersion: 10,
      steps: [
        // Update null values in recipes table to use default values
        {
          type: 'sql',
          sql: `
            -- Update rating to 0 where null
            UPDATE recipes SET rating = 0 WHERE rating IS NULL;
            
            -- Update prep_time to 0 where null
            UPDATE recipes SET prep_time = 0 WHERE prep_time IS NULL;
            
            -- Update total_time to 0 where null
            UPDATE recipes SET total_time = 0 WHERE total_time IS NULL;
            
            -- Update servings to 1 where null
            UPDATE recipes SET servings = 1 WHERE servings IS NULL;
          `
        }
      ]
    },
    {
      toVersion: 11,
      steps: [
        // Dodaj nową tabelę recipe_images
        createTable({
          name: 'recipe_images',
          columns: [
            { name: 'image', type: 'string', isOptional: true },
            // Kolumny synchronizacji
            { name: 'sync_id', type: 'string' },
            { name: 'sync_status', type: 'string' },
            { name: 'last_update', type: 'number', isOptional: true },
            { name: 'is_local', type: 'boolean', isOptional: true },
            { name: 'owner', type: 'string', isOptional: true },
            { name: 'is_deleted', type: 'boolean' }
          ]
        })
      ]
    },
    {
      toVersion: 12,
      steps: [
        // Dodaj kolumnę thumbnail do tabeli recipe_images
        addColumns({
          table: 'recipe_images',
          columns: [
            { name: 'thumbnail', type: 'string', isOptional: true }
          ]
        })
      ]
    }
  ]
}) 