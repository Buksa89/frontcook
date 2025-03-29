import 'react-native-get-random-values'
import { Model } from '@nozbe/watermelondb'
import { field, text, writer } from '@nozbe/watermelondb/decorators'
import { Database } from '@nozbe/watermelondb'
import { v4 as uuidv4 } from 'uuid'
import AuthService from '../../app/services/auth/authService'
import { Q } from '@nozbe/watermelondb'

// Define our own SyncStatus type that matches what we're using
type SyncStatus = 'pending' | 'synced' | 'conflict'

export default class SyncModel extends Model {
  @field('sync_id') syncId!: string
  @field('sync_status') syncStatusField!: SyncStatus
  @field('last_update') lastUpdate!: string
  @text('owner') owner!: string | null
  @field('is_deleted') isDeleted!: boolean

  // Helper method to format last sync date
  get lastUpdateDate(): Date {
    return new Date(this.lastUpdate);
  }

  // Helper method to check if record needs synchronization
  get needsSync(): boolean {
    return this.syncStatusField === 'pending' || this.syncStatusField === 'conflict';
  }

  // Helper method to convert snake_case to camelCase
  static snakeToCamel(snakeCase: string): string {
    return snakeCase.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  // Helper method to convert camelCase to snake_case
  static camelToSnake(camelCase: string): string {
    return camelCase.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  // Helper method to determine if update is needed based on comparing dates
  needUpdate(serverDate: string): boolean {
    // Compare dates
    const localTime = new Date(this.lastUpdate).getTime();
    const serverTime = new Date(serverDate).getTime();
    
    return serverTime > localTime;
  }

  // Override update method to automatically update sync fields
  async update(recordUpdater?: (record: this) => void): Promise<this> {
      // Remember initial values
      const initialValues = {
        syncStatus: this.syncStatusField,
        lastUpdate: this.lastUpdate,
        isDeleted: this.isDeleted
      };
      
      // Use database.write to wrap the update operation
      return await this.database.write(async () => {
        // Use super.update to apply changes
        await super.update(record => {
          // First apply the user's updates if provided
          if (recordUpdater) {
            recordUpdater(record);
          }
          
          // Ustaw pola synchronizacyjne tylko jeśli nie zostały jawnie zmienione przez recordUpdater
          
          // Sprawdź czy status synchronizacji został jawnie zmieniony
          if (record.syncStatusField === initialValues.syncStatus) {
            // Jeśli nie został zmieniony, ustaw na 'pending'
            record.syncStatusField = 'pending';
          }
          
          // Sprawdź czy data ostatniej aktualizacji została jawnie zmieniona
          if (record.lastUpdate === initialValues.lastUpdate) {
            // Jeśli nie została zmieniona, zaktualizuj ją
            record.lastUpdate = new Date().toISOString();
          }
          
          // Inne pola rekordu zostają bez zmian - wszystkie zmiany zastosowane przez recordUpdater są zachowane
        });
        
        return this;
      });
  }

  // Helper method to update record and mark it as synced
  async updateAsSynced(recordUpdater?: (record: this) => void): Promise<this> {
    // Tworzymy wrapper dla recordUpdater, który dodatkowo ustawi status na 'synced'
    const syncedRecordUpdater = (record: this) => {
      // Najpierw zastosuj oryginalne zmiany, jeśli zostały podane
      if (recordUpdater) {
        recordUpdater(record);
      }
      
      // Następnie ustaw status synchronizacji na 'synced', niezależnie od tego,
      // czy recordUpdater coś zmienił, czy nie
      record.syncStatusField = 'synced';
    };
    
    // Użyj standardowej metody update z naszym wrapper'em
    return await this.update(syncedRecordUpdater);
  }

  // Method to prepare a record for pushing to server
  // Converts camelCase fields to snake_case and removes unnecessary fields
  prepareForPush(): Record<string, any> {
    // Get all fields from the record
    const rawData: Record<string, any> = { ...this._raw };
    
    // Fields to exclude from the push data
    const excludedFields = ['id', 'owner', 'sync_status'];
    
    // Prepare data for server
    const serverData: Record<string, any> = {};
    
    // Process all fields
    Object.entries(rawData).forEach(([key, value]) => {
      // Skip excluded fields
      if (!excludedFields.includes(key)) {
        // Convert the key to snake_case if needed
        const snakeKey = SyncModel.camelToSnake(key);
        // Add the field to server data
        serverData[snakeKey] = value;
      }
    });
    
    return serverData;
  }

  // Static version of prepareForPush for use with collections of records
  static prepareRecordsForPush(records: SyncModel[]): Record<string, any>[] {
    return records.map(record => record.prepareForPush());
  }

  // Helper method to mark record as deleted
  async markAsDeleted(): Promise<void> {
    // Utwórz updater, który oznaczy rekord jako usunięty
    const deletedRecordUpdater = (record: this) => {
      record.isDeleted = true;
      record.syncStatusField = 'pending';
      // Nie ustawiamy lastUpdate, bo metoda update sama to zrobi
    };
    
    // Użyj standardowej metody update z naszym updater'em
    await this.update(deletedRecordUpdater);
  }

  // Base create method that handles sync fields
  static async create<T extends SyncModel>(
    this: { new(): T } & typeof Model,
    database: Database,
    recordUpdater: (record: T) => void
  ): Promise<T> {
      const activeUser = await AuthService.getActiveUser();
      
      return await database.write(async () => {
        const record = await database.get<T>(this.table).create((newRecord: T) => {
          // Najpierw zastosuj zmiany użytkownika, jeśli podane
          if (recordUpdater) {
          recordUpdater(newRecord);
          }
          
          // Ustaw sync_id, jeśli nie został jawnie podany
          if (!newRecord.syncId) {
            newRecord.syncId = uuidv4();
          }
          
          // Ustaw status synchronizacji, jeśli nie został jawnie podany
          if (!newRecord.syncStatusField) {
            newRecord.syncStatusField = 'pending';
          }
          
          // Ustaw datę ostatniej aktualizacji, jeśli nie została jawnie podana
          if (!newRecord.lastUpdate) {
            newRecord.lastUpdate = new Date().toISOString();
          }
          
          // Ustaw pole isDeleted, jeśli nie zostało jawnie podane
          if (newRecord.isDeleted === undefined) {
            newRecord.isDeleted = false;
          }
        });

        return record;
      });
  }

  // Helper method to create a record from server data and mark it as synced
  static async createAsSynced<T extends SyncModel>(
    this: { new(): T } & typeof SyncModel,
    database: Database,
    serverData: Record<string, any>
  ): Promise<T> {
    
    // Utwórz funkcję recordUpdater z odpowiednim typem SyncModel
    const serverDataUpdater = (newRecord: SyncModel) => {
      // Zastosuj wszystkie pola z przygotowanych danych
      Object.entries(serverData).forEach(([key, value]) => {
        // Przypisz wartość do pola bezpośrednio - bez sprawdzania id
                  (newRecord as any)[key] = value;
          });
          
      // Jawnie ustaw status synchronizacji na 'synced'
          newRecord.syncStatusField = 'synced';
    };
    
    // Wywołaj statyczną metodę create z odpowiednimi parametrami
    return await SyncModel.create.call(
      this,
      database,
      serverDataUpdater
    ) as T;
  }

  // Method to check if a server object already exists in the local database
  // This can be overridden in derived classes to change the matching logic
  static async existsInLocalDatabase<T extends SyncModel>(
    this: { new(): T } & typeof SyncModel,
    database: Database,
    serverObject: Record<string, any>
  ): Promise<boolean> {
    // Default implementation: match by syncId
    // Check both syncId (camelCase) and sync_id (snake_case)
    const syncId = serverObject.sync_id;
    
    if (!syncId) {
      return false;
    }
    
    const records = await database
      .get<T>(this.table)
      .query(Q.where('sync_id', syncId))
      .fetch();
      
    return records.length > 0;
  }

  // Method for synchronizing updates between server and local database
  // Implementation will be built step by step
  static async pullSyncUpdate<T extends SyncModel>(
    this: { new(): T } & typeof SyncModel,
    database: Database,
    serverObject: Record<string, any>
  ): Promise<{ success: boolean; message: string }> {
    // First, check if the object exists in the local database
    const exists = await this.existsInLocalDatabase<T>(database, serverObject);
    
    // Get the syncId for logging purposes
    const syncId = serverObject.sync_id;
    
    // Case 1: Object doesn't exist in local database
    if (!exists) {
      // Preprocess server data to convert snake_case fields to camelCase
      const processedData: Record<string, any> = {};
      
      // Process all fields from serverObject
      Object.entries(serverObject).forEach(([key, value]) => {
        // Convert all keys from snake_case to camelCase
        const camelKey = SyncModel.snakeToCamel(key);
        processedData[camelKey] = value;
      });
      
      // Create a new record using the processed data
      try {
        const newRecord = await this.createAsSynced<T>(database, processedData);
        console.log(`[DB ${this.table}] Created new record with syncId: ${newRecord.syncId}`);
        
        return {
          success: true,
          message: `Created new record with syncId: ${syncId}`
        };
      } catch (createError) {
        const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';
        throw new Error(`Failed to create record: ${errorMessage}`);
      }
    } 
    // Case 2: Object exists in local database
    else {
      // Find the existing record to check if update is needed
      const records = await database
        .get<T>(this.table)
        .query(Q.where('sync_id', syncId))
        .fetch();
        
      const existingRecord = records[0];
      
      // Check if the server data is newer than our local data
      // Extract server date from various possible fields (camelCase or snake_case)
      const serverDate = serverObject.last_update;
      
      // Use the needUpdate method to check if an update is needed
      const needsUpdate = existingRecord.needUpdate(serverDate);
      
      // If update is needed
      if (needsUpdate) {
        // Preprocess server data to convert snake_case fields to camelCase
        const processedData: Record<string, any> = {};
        
        // Process all fields from serverObject
        Object.entries(serverObject).forEach(([key, value]) => {
          // Convert all keys from snake_case to camelCase
          const camelKey = SyncModel.snakeToCamel(key);
          processedData[camelKey] = value;
        });
        
        // Update the existing record with the processed data
        try {
          await existingRecord.updateAsSynced(record => {
            // Apply all processed fields to the record
            Object.entries(processedData).forEach(([key, value]) => {
              // Apply value to the record
                        (record as any)[key] = value;
            });
            
            // The updateAsSynced method will automatically set syncStatusField to 'synced'
          });
          
          console.log(`[DB ${this.table}] Updated record with syncId: ${syncId}`);
          
          return {
            success: true,
            message: `Updated existing record with syncId: ${syncId}`
          };
        } catch (updateError) {
          const errorMessage = updateError instanceof Error ? updateError.message : 'Unknown error';
          throw new Error(`Failed to update record: ${errorMessage}`);
        }
      } 
      // No update needed
      else {
        // Log that we're skipping this object
        console.log(`[DB ${this.table}] Object with syncId: ${syncId} skipped (no update needed)`);
        
        return {
          success: true,
          message: `No update needed for record with syncId: ${syncId}`
        };
      }
    }
  }
} 