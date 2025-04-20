// database/migrations.ts
import { schemaMigrations, createTable, addColumns, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';
import type { MigrationStep } from '@nozbe/watermelondb/Schema/migrations'; // Importuj typy

// --- FUNKCJE POMOCNICZE ---

// Funkcja dodająca NOWE kolumny sync do istniejącej tabeli (standardowe)
const addNewSyncColumns = (tableName: string): MigrationStep => addColumns({
  table: tableName,
  columns: [
    // user_id jest zwykle wymagane, chyba że tabela może zawierać dane niespersonalizowane
    { name: 'user_id', type: 'string', isIndexed: true },
    // last_modified i created_at są kluczowe i wymagane
    { name: 'last_modified', type: 'number', isIndexed: true },
    { name: 'created_at', type: 'number' }, // Wymagane
  ],
});

// Funkcja dodająca NOWE kolumny sync do tabeli Tagów (userId opcjonalne)
const addTagSyncColumns = (tableName: string): MigrationStep => addColumns({
    table: tableName,
    columns: [
      { name: 'user_id', type: 'string', isIndexed: true, isOptional: true }, // Opcjonalne dla tagów systemowych
      { name: 'last_modified', type: 'number', isIndexed: true },
      { name: 'created_at', type: 'number' },
    ],
});

// Funkcja usuwająca STARE kolumny sync z tabeli
// WAŻNE: Składnia DROP COLUMN może wymagać dostosowania do konkretnej implementacji SQLite
const dropOldSyncColumns = (tableName: string): MigrationStep[] => [
    // Użycie `IF EXISTS` jest bezpieczniejsze, ale może nie być wspierane wszędzie
    // Rozważ użycie osobnych kroków dla każdej kolumny dla większej kontroli błędów
    { type: 'sql', sql: `ALTER TABLE ${tableName} DROP COLUMN sync_id;` },
    { type: 'sql', sql: `ALTER TABLE ${tableName} DROP COLUMN sync_status;` },
    { type: 'sql', sql: `ALTER TABLE ${tableName} DROP COLUMN last_update;` },
    { type: 'sql', sql: `ALTER TABLE ${tableName} DROP COLUMN is_local;` },
    { type: 'sql', sql: `ALTER TABLE ${tableName} DROP COLUMN owner;` },
    { type: 'sql', sql: `ALTER TABLE ${tableName} DROP COLUMN is_deleted;` },
];

// --- GŁÓWNA DEFINICJA MIGRACJI ---

export default schemaMigrations({
  migrations: [
    // === Migracje od 1 do 12 (Twoje istniejące, BEZ ZMIAN) ===
    // Zakładamy, że te migracje poprawnie doprowadzają bazę
    // do stanu ZANIM wprowadzono nowy system synchronizacji.
    {
      toVersion: 2,
      steps: [
        // Usuń starą kolumnę ingredients z recipes (jeśli istniała)
        // Bezpieczniej użyć kroku SQL, jeśli nie masz pewności co do stanu w v1
        // { type: 'remove_column', table: 'recipes', name: 'ingredients' },
        { type: 'sql', sql: `ALTER TABLE recipes DROP COLUMN ingredients;` }, // Zakładając, że istniała
        // Stwórz tabelę ingredients ze STARYMI polami sync (remote_id)
        createTable({
          name: 'ingredients',
          columns: [
            { name: 'remote_id', type: 'string', isOptional: true }, // Stare pole
            { name: 'amount', type: 'number', isOptional: true },
            { name: 'unit', type: 'string', isOptional: true },
            { name: 'name', type: 'string' }, // Poprawiono isOptional na false
            { name: 'type', type: 'string', isOptional: true },
            { name: 'recipe_id', type: 'string', isIndexed: true }, // Dodano indeks
            { name: 'order', type: 'number' },
            { name: 'original_str', type: 'string', isOptional: true } // Ustawiono na opcjonalne
          ]
        })
      ]
    },
    {
      toVersion: 3,
      steps: [
        // Stwórz tabelę shopping_items ze STARYMI polami sync (remote_id)
        createTable({
          name: 'shopping_items',
          columns: [
            { name: 'remote_id', type: 'string', isOptional: true }, // Stare pole
            { name: 'amount', type: 'number', isOptional: true },
            { name: 'unit', type: 'string', isOptional: true },
            { name: 'name', type: 'string', isIndexed: true }, // Dodano indeks
            { name: 'type', type: 'string', isOptional: true },
            { name: 'order', type: 'number', isIndexed: true }, // Dodano indeks
            { name: 'is_checked', type: 'boolean', isIndexed: true } // Dodano indeks
          ]
        })
      ]
    },
    {
      toVersion: 4,
      steps: [
        // Stwórz tabelę client_user_settings (bez pól sync na tym etapie)
        createTable({
          name: 'client_user_settings',
          columns: [
            { name: 'language', type: 'string' }
          ]
        })
      ]
    },
    {
      toVersion: 5,
      steps: [
        // Dodaj STARE pola sync do istniejących tabel
        addColumns({
          table: 'tags', // Zakładamy, że 'tags' istniało od v1
          columns: [
            { name: 'sync_id', type: 'string', isOptional: true }, // Dodano sync_id (wcześniej go brakowało)
            { name: 'sync_status', type: 'string', isOptional: true }, // Ustawiono na opcjonalne
            { name: 'last_update', type: 'number', isOptional: true },
            { name: 'is_local', type: 'boolean', isOptional: true },
            { name: 'owner', type: 'string', isOptional: true }
          ]
        }),
        addColumns({
          table: 'recipes',
          columns: [
            { name: 'sync_id', type: 'string', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'last_update', type: 'number', isOptional: true },
            { name: 'is_local', type: 'boolean', isOptional: true },
            { name: 'owner', type: 'string', isOptional: true }
          ]
        }),
        // Dodaj stare pola sync do 'recipe_tags' (która później zmieni nazwę)
         addColumns({
           table: 'recipe_tags', // Stara nazwa tabeli M2M
           columns: [
             { name: 'sync_id', type: 'string', isOptional: true },
             { name: 'sync_status', type: 'string', isOptional: true },
             { name: 'last_update', type: 'number', isOptional: true },
             { name: 'is_local', type: 'boolean', isOptional: true },
             { name: 'owner', type: 'string', isOptional: true }
           ]
         }),
        addColumns({
          table: 'ingredients', // Do tabeli utworzonej w v2
          columns: [
            { name: 'sync_id', type: 'string', isOptional: true }, // Zmieniono remote_id na sync_id dla spójności
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'last_update', type: 'number', isOptional: true },
            { name: 'is_local', type: 'boolean', isOptional: true },
            { name: 'owner', type: 'string', isOptional: true }
          ]
        }),
        // Usunięcie remote_id z ingredients, bo dodaliśmy sync_id
        { type: 'sql', sql: `ALTER TABLE ingredients DROP COLUMN remote_id;` },

        addColumns({
          table: 'shopping_items', // Do tabeli utworzonej w v3
          columns: [
            { name: 'sync_id', type: 'string', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'last_update', type: 'number', isOptional: true },
            { name: 'is_local', type: 'boolean', isOptional: true },
            { name: 'owner', type: 'string', isOptional: true }
          ]
        }),
         // Usunięcie remote_id z shopping_items
         { type: 'sql', sql: `ALTER TABLE shopping_items DROP COLUMN remote_id;` },

        addColumns({
          table: 'client_user_settings', // Do tabeli utworzonej w v4
          columns: [
            { name: 'sync_id', type: 'string', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'last_update', type: 'number', isOptional: true },
            { name: 'is_local', type: 'boolean', isOptional: true },
            { name: 'owner', type: 'string', isOptional: true }
          ]
        })
      ]
    },
    {
      toVersion: 6,
      steps: [
        // Dodaj STARE pole is_deleted
        addColumns({ table: 'tags', columns: [{ name: 'is_deleted', type: 'boolean', isOptional: true }] }), // Ustawiono isOptional: true
        addColumns({ table: 'recipes', columns: [{ name: 'is_deleted', type: 'boolean', isOptional: true }] }),
        addColumns({ table: 'recipe_tags', columns: [{ name: 'is_deleted', type: 'boolean', isOptional: true }] }),
        addColumns({ table: 'ingredients', columns: [{ name: 'is_deleted', type: 'boolean', isOptional: true }] }),
        addColumns({ table: 'shopping_items', columns: [{ name: 'is_deleted', type: 'boolean', isOptional: true }] }),
        addColumns({ table: 'client_user_settings', columns: [{ name: 'is_deleted', type: 'boolean', isOptional: true }] })
      ]
    },
    {
      toVersion: 7,
      steps: [
        // Stwórz tabelę notifications ze STARYMI polami sync
        createTable({
          name: 'notifications',
          columns: [
            { name: 'content', type: 'string' },
            { name: 'type', type: 'string' },
            { name: 'link', type: 'string', isOptional: true },
            { name: 'is_readed', type: 'boolean' }, // Stara nazwa kolumny
            // Stare pola sync
            { name: 'sync_id', type: 'string', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'last_update', type: 'number', isOptional: true },
            { name: 'is_local', type: 'boolean', isOptional: true },
            { name: 'owner', type: 'string', isOptional: true },
            { name: 'is_deleted', type: 'boolean', isOptional: true } // Ustawiono isOptional: true
          ]
        })
      ]
    },
    {
      toVersion: 8,
      steps: [
        // Dodaj order do notifications
        addColumns({ table: 'notifications', columns: [{ name: 'order', type: 'number', isOptional: true }] }) // Ustawiono isOptional: true
      ]
    },
    {
      toVersion: 9,
      steps: [
        // Stwórz user_profile ze STARYMI polami sync
        createTable({
          name: 'user_profile',
          columns: [
            { name: 'last_sync', type: 'number', isOptional: true }, // Stare pole
            { name: 'subscription_end', type: 'number', isOptional: true },
            { name: 'csv_lock', type: 'string', isOptional: true }, // Stary typ
            // Stare pola sync
            { name: 'sync_id', type: 'string', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'last_update', type: 'number', isOptional: true },
            { name: 'is_local', type: 'boolean', isOptional: true },
            { name: 'owner', type: 'string', isOptional: true },
            { name: 'is_deleted', type: 'boolean', isOptional: true }
          ]
        })
      ]
    },
    {
      toVersion: 10,
      steps: [
        // Update null values w recipes - bez zmian
        { type: 'sql', sql: `UPDATE recipes SET rating = 0 WHERE rating IS NULL;` },
        { type: 'sql', sql: `UPDATE recipes SET prep_time = 0 WHERE prep_time IS NULL;` },
        { type: 'sql', sql: `UPDATE recipes SET total_time = 0 WHERE total_time IS NULL;` },
        { type: 'sql', sql: `UPDATE recipes SET servings = 1 WHERE servings IS NULL;` }
      ]
    },
    {
      toVersion: 11,
      steps: [
        // Stwórz recipe_images ze STARYMI polami sync
        createTable({
          name: 'recipe_images',
          columns: [
            { name: 'image', type: 'string', isOptional: true }, // Stare pole image
            // Stare pola sync
            { name: 'sync_id', type: 'string', isOptional: true },
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'last_update', type: 'number', isOptional: true },
            { name: 'is_local', type: 'boolean', isOptional: true },
            { name: 'owner', type: 'string', isOptional: true },
            { name: 'is_deleted', type: 'boolean', isOptional: true }
          ]
        })
      ]
    },
    {
      toVersion: 12,
      steps: [
        // Dodaj thumbnail do recipe_images
        addColumns({ table: 'recipe_images', columns: [{ name: 'thumbnail', type: 'string', isOptional: true }] })
      ]
    },

    // === NOWA MIGRACJA DO WERSJI 13: ZMIANA NAZWY TABELI TAGÓW I UTWORZENIE NOWEJ ===
    {
      toVersion: 13,
      steps: [
        // 1. Zmień nazwę tabeli `recipe_tags` (M2M) na `recipe_tags_through`
        { type: 'sql', sql: `ALTER TABLE recipe_tags RENAME TO recipe_tags_through;` },

        // 2. Stwórz NOWĄ tabelę `recipe_tags` dla właściwych Tagów
        //    Na tym etapie tworzymy ją z NOWYMI kolumnami sync, ale userId jest opcjonalne
        createTable({
          name: 'recipe_tags',
          columns: [
            { name: 'name', type: 'string', isIndexed: true },
            { name: 'order', type: 'number' },
            // Nowe kolumny synchronizacji z userId opcjonalnym
            { name: 'user_id', type: 'string', isIndexed: true, isOptional: true },
            { name: 'last_modified', type: 'number', isIndexed: true },
            { name: 'created_at', type: 'number' },
          ]
        }),
      ]
    },

    // === NOWA MIGRACJA DO WERSJI 14: AKTUALIZACJA PÓL SYNC I STRUKTURY ===
    {
      toVersion: 14,
      steps: [
        // --- 1. Dodaj NOWE kolumny synchronizacji do istniejących tabel (oprócz nowej 'recipe_tags') ---
        //    Zakładamy, że wszystkie te tabele istniały po migracji do v12
        addNewSyncColumns('recipes'),
        addNewSyncColumns('recipe_tags_through'), // Do tabeli pośredniczącej
        addNewSyncColumns('ingredients'),
        addNewSyncColumns('shopping_items'),
        addNewSyncColumns('client_user_settings'),
        addNewSyncColumns('notifications'),
        addNewSyncColumns('user_profile'),
        addNewSyncColumns('recipe_images'),

        // --- 2. Zmodyfikuj istniejące tabele/kolumny ---
        { type: 'sql', sql: `ALTER TABLE notifications RENAME COLUMN is_readed TO is_read;` },
        { type: 'sql', sql: `ALTER TABLE user_profile DROP COLUMN last_sync;` },
        // Bezpieczniejsze podejście do zmiany typu csv_lock: usuń i dodaj jako number
        { type: 'sql', sql: `ALTER TABLE user_profile DROP COLUMN csv_lock;` },
        addColumns({ table: 'user_profile', columns: [{ name: 'csv_lock', type: 'number', isOptional: true }] }), // Dodaj jako opcjonalny number

        // Modyfikacja recipe_images
        addColumns({
            table: 'recipe_images',
            columns: [
                { name: 'recipe_id', type: 'string', isIndexed: true }, // Dodaj recipe_id
                { name: 'order', type: 'number', isOptional: true }, // Dodaj order jako opcjonalny (ustaw domyślny 0?)
                { name: 'image_url', type: 'string', isOptional: true },
            ]
        }),
        { type: 'sql', sql: `ALTER TABLE recipe_images DROP COLUMN image;` },
        { type: 'sql', sql: `ALTER TABLE recipe_images DROP COLUMN thumbnail;` },

        // --- 3. (KRYTYCZNE) Usuń STARE kolumny synchronizacji ---
        // Usuwamy je ze wszystkich tabel, które je miały po migracji v12
        // Upewnij się, że wszystkie wymienione tabele istniały i miały te kolumny!
        ...dropOldSyncColumns('recipes'),
        ...dropOldSyncColumns('recipe_tags_through'), // Z tabeli o zmienionej nazwie
        ...dropOldSyncColumns('ingredients'),
        ...dropOldSyncColumns('shopping_items'),
        ...dropOldSyncColumns('client_user_settings'),
        ...dropOldSyncColumns('notifications'),
        ...dropOldSyncColumns('user_profile'),
        ...dropOldSyncColumns('recipe_images'),
        // Należy też usunąć stare kolumny z pierwotnej tabeli 'tags' (jeśli istniała od v1)
        // Jeśli tabela 'tags' z v1 została USUNIĘTA wcześniej, nie wykonuj tego kroku dla 'tags'.
        // Zakładając, że istniała i miała stare kolumny sync dodane w v5:
        // ...dropOldSyncColumns('tags'), // Odkomentuj, jeśli tabela 'tags' istniała i miała te kolumny przed v13
      ]
    }
  ]
});
