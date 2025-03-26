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
        {
          type: 'sql',
          sql: `
            -- Add sync fields to tags
            ALTER TABLE tags 
            ADD COLUMN sync_status TEXT DEFAULT 'synced',
            ADD COLUMN last_update TEXT DEFAULT NULL,
            ADD COLUMN is_local INTEGER DEFAULT 0,
            ADD COLUMN owner TEXT DEFAULT NULL;

            -- Add sync fields to recipes
            ALTER TABLE recipes 
            ADD COLUMN sync_status TEXT DEFAULT 'synced',
            ADD COLUMN last_update TEXT DEFAULT NULL,
            ADD COLUMN is_local INTEGER DEFAULT 0,
            ADD COLUMN owner TEXT DEFAULT NULL;

            -- Add sync fields to recipe_tags
            ALTER TABLE recipe_tags 
            ADD COLUMN sync_status TEXT DEFAULT 'synced',
            ADD COLUMN last_update TEXT DEFAULT NULL,
            ADD COLUMN is_local INTEGER DEFAULT 0,
            ADD COLUMN owner TEXT DEFAULT NULL;

            -- Add sync fields to ingredients
            ALTER TABLE ingredients 
            ADD COLUMN sync_status TEXT DEFAULT 'synced',
            ADD COLUMN last_update TEXT DEFAULT NULL,
            ADD COLUMN is_local INTEGER DEFAULT 0,
            ADD COLUMN owner TEXT DEFAULT NULL;

            -- Add sync fields to shopping_items
            ALTER TABLE shopping_items 
            ADD COLUMN sync_status TEXT DEFAULT 'synced',
            ADD COLUMN last_update TEXT DEFAULT NULL,
            ADD COLUMN is_local INTEGER DEFAULT 0,
            ADD COLUMN owner TEXT DEFAULT NULL;

            -- Add sync fields to user_settings
            ALTER TABLE user_settings 
            ADD COLUMN sync_status TEXT DEFAULT 'synced',
            ADD COLUMN last_update TEXT DEFAULT NULL,
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
            { name: 'last_update', type: 'string', isOptional: true },
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
        {
          type: 'sql',
          sql: `
            ALTER TABLE notifications
            ADD COLUMN order INTEGER DEFAULT 0;
          `
        }
      ]
    },
    {
      toVersion: 9,
      steps: [
        // Create user_data table or add subscription fields if it exists
        {
          type: 'sql',
          sql: `
            -- Check if user_data table exists
            CREATE TABLE IF NOT EXISTS user_data (
              id TEXT PRIMARY KEY NOT NULL,
              user TEXT NOT NULL,
              last_sync NUMBER,
              subscription_end NUMBER,
              csv_lock TEXT,
              _changed TEXT,
              _status TEXT
            );

            -- Add subscription columns to user_data table if they don't exist
            -- SQLite doesn't have the "IF NOT EXISTS" for columns, so we use a workaround
            -- by checking if the column exists in the pragma info
            
            -- Add subscription_end column if it doesn't exist
            PRAGMA foreign_keys=off;
            BEGIN TRANSACTION;
            ALTER TABLE user_data RENAME TO user_data_old;
            CREATE TABLE user_data (
              id TEXT PRIMARY KEY NOT NULL,
              user TEXT NOT NULL,
              last_sync NUMBER,
              subscription_end NUMBER,
              csv_lock TEXT,
              _changed TEXT,
              _status TEXT
            );
            INSERT INTO user_data (id, user, last_sync, _changed, _status)
            SELECT id, user, last_sync, _changed, _status FROM user_data_old;
            DROP TABLE user_data_old;
            COMMIT;
            PRAGMA foreign_keys=on;
          `
        }
      ]
    }
  ]
}) 