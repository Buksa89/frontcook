import 'react-native-get-random-values'
import { Model } from '@nozbe/watermelondb'
import { field, text, date, writer } from '@nozbe/watermelondb/decorators'
import { Database } from '@nozbe/watermelondb'
import { v4 as uuidv4 } from 'uuid'
import AuthService from '../../app/services/auth/authService'
import { Q } from '@nozbe/watermelondb'
import { snakeToCamel, camelToSnake } from '../../app/utils/syncUtils'

// Define our own SyncStatus type that matches what we're using
type SyncStatus = 'pending' | 'synced' | 'conflict'

export default class SyncModel extends Model {
  @field('sync_id') syncId!: string
  @field('sync_status') syncStatusField!: SyncStatus
  @date('last_update') lastUpdate!: Date
  @text('owner') owner!: string | null
  @field('is_deleted') isDeleted!: boolean

  // Helper method to format last sync date
  get lastUpdateDate(): Date {
    return this.lastUpdate;
  }

  // Helper method to check if record needs synchronization
  get needsSync(): boolean {
    return this.syncStatusField === 'pending' || this.syncStatusField === 'conflict';
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
            record.lastUpdate = new Date();
          }
          
          // Inne pola rekordu zostają bez zmian - wszystkie zmiany zastosowane przez recordUpdater są zachowane
        });
        
        return this;
      });
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
            newRecord.lastUpdate = new Date();
          }
          
          // Ustaw pole isDeleted, jeśli nie zostało jawnie podane
          if (newRecord.isDeleted === undefined) {
            newRecord.isDeleted = false;
          }
          newRecord.owner = activeUser;
        });

        return record;
      });
  }

  // #########  SYNC  #########

  // Method to find an existing record by sync_id and owner
  static async getExistingRecord<T extends SyncModel>(
    this: { new(): T } & typeof SyncModel,
    database: Database,
    serverData: Record<string, any>,
    owner: string | null
  ): Promise<T | null> {
    // Extract sync_id from the server data
    const syncId = serverData.sync_id;
    
    // Find a record with the given sync_id and matching owner
    const records = await database
      .get<T>(this.table)
      .query(
        Q.and(
          Q.where('sync_id', syncId),
          Q.where('owner', owner)
        )
      )
      .fetch();
    
    // Return the first record if found, otherwise null
    return records.length > 0 ? records[0] : null;
  }

  // Method to be called before upsertBySync operations
  // Can be overridden by child classes to implement custom pre-sync logic
  static async deserialize<T extends SyncModel>(
    database: Database,
    serverData: Record<string, any>,
    existingRecord: T | null
  ): Promise<Record<string, any>> {
    // Transform snake_case to camelCase keys
    const transformedData: Record<string, any> = {};
    Object.entries(serverData).forEach(([key, value]) => {
      // Transform snake_case to camelCase for field names
      const camelKey = snakeToCamel(key);
      transformedData[camelKey] = value;
    });
    return transformedData;
  }

  // Method for inserting or updating a record based on sync_id
  static async upsertBySync<T extends SyncModel>(
    this: { new(): T } & typeof SyncModel,
    database: Database,
    recordData: Record<string, any>
  ): Promise<T> {
    // Get the active user
    const activeUser = await AuthService.getActiveUser();
    
    // Extract sync_id from the record data
    const syncId = recordData.sync_id;
    
    // Try to find an existing record
    const existingRecord = await this.getExistingRecord<T>(database, recordData, activeUser);
    // Process the data through preUpsertBySync
    
    const serverDate = new Date(recordData.last_update);
    
    
    // If the record exists, check if update is needed
    if (existingRecord) {
      // If no server date provided or the server date is newer, perform the update
      const updateNeeded = existingRecord.needUpdate(serverDate);
      
      if (updateNeeded) {

        const deserializedData = await this.deserialize<T>(database, recordData, existingRecord);
        
        await existingRecord.update((record: any) => {
          // Apply the provided data
          Object.entries(deserializedData).forEach(([key, value]) => {
            (record as any)[key] = value;
          });
          // Set syncStatusField to 'synced'
          record.syncStatusField = 'synced';
        });
      }
      return existingRecord;
    }
    
    // If the record doesn't exist, create a new one using the dedicated method
    const deserializedData = await this.deserialize<T>(database, recordData, null);
    
    // Use the new createFromSyncData method instead of this.create
    return await this.createFromSyncData<T>(database, deserializedData);
  }

  needUpdate(serverDate: Date): boolean {
    // Compare dates
    const localTime = this.lastUpdate;
    
    return serverDate.getTime() > localTime.getTime();
  }

  // #########  SYNC PUSH  #########
  // Method to prepare a record for pushing to server
  // Converts camelCase fields to snake_case and removes unnecessary fields
  serialize(): Record<string, any> {
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
        const snakeKey = camelToSnake(key);
        
        // Handle Date objects - convert to timestamp for server
        if (key === 'last_update' && value instanceof Date) {
          serverData[snakeKey] = value.getTime();
        } else {
          // Add the field to server data
          serverData[snakeKey] = value;
        }
      }
    });
    
    return serverData;
  }

  // Static version of prepareForPush for use with collections of records
  static serializeRecords(records: SyncModel[]): Record<string, any>[] {
    return records.map(record => record.serialize());
  }

  // Nowa metoda do tworzenia rekordu na podstawie danych z synchronizacji
  // Powinna być nadpisana przez klasy potomne!
  static async createFromSyncData<T extends SyncModel>(
    this: { new(): T } & typeof SyncModel,
    database: Database,
    deserializedData: Record<string, any>,
  ): Promise<T> {
    console.error(`[SyncModel.createFromSyncData] Method not implemented for table ${this.table}. Child model MUST override this method.`);
    throw new Error(`createFromSyncData must be overridden in ${this.name}`);
  }
}