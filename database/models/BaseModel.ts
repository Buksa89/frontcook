import 'react-native-get-random-values'
import { Model } from '@nozbe/watermelondb'
import { field, text, writer } from '@nozbe/watermelondb/decorators'
import { SyncStatus } from '@nozbe/watermelondb/Model'
import { Database } from '@nozbe/watermelondb'
import { v4 as uuidv4 } from 'uuid'
import AuthService from '../../app/services/auth/authService'
import { Q } from '@nozbe/watermelondb'

export default class BaseModel extends Model {
  @field('sync_id') syncId!: string
  @field('sync_status') syncStatusField!: SyncStatus
  @field('last_update') lastUpdate!: string | null
  @text('owner') owner!: string | null
  @field('is_deleted') isDeleted!: boolean

  // Getter and setter for syncStatus to avoid conflict with Model's accessor
  get syncStatus(): SyncStatus {
    return this.syncStatusField;
  }

  set syncStatus(value: SyncStatus) {
    this.syncStatusField = value;
  }

  // Helper methods for sync status
  get isPending(): boolean {
    return this.syncStatus === 'pending'
  }

  get isSynced(): boolean {
    return this.syncStatus === 'synced'
  }

  get hasConflict(): boolean {
    return this.syncStatus === 'conflict'
  }

  // Helper method to format last sync date
  get lastUpdateDate(): Date | null {
    return this.lastUpdate ? new Date(this.lastUpdate) : null
  }

  // Helper method to check if record needs synchronization
  get needsSync(): boolean {
    return this.isPending || this.hasConflict;
  }

  // Helper method to mark record as synced
  async markAsSynced(): Promise<this> {
    try {
      return await this.database.write(async () => {
        // Use super.update directly to bypass our custom update method
        // that would automatically set lastUpdate and syncStatus
        await super.update(record => {
          record.syncStatusField = 'synced';
          // Don't update lastUpdate, keep the existing value
        });
        
        return this;
      });
    } catch (error) {
      console.error(`[DB ${this.table}] Error marking record as synced: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Helper method to mark record as having conflict
  async markAsConflict(conflictInfo?: string): Promise<this> {
    try {
      return await this.database.write(async () => {
        // Use super.update directly to bypass our custom update method
        // that would automatically set lastUpdate and syncStatus
        await super.update(record => {
          record.syncStatusField = 'conflict';
          // Don't update lastUpdate, keep the existing value
          // Optionally store conflict info in a separate field if needed
        });
        
        return this;
      });
    } catch (error) {
      console.error(`[DB ${this.table}] Error marking record as conflict: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Helper method to reset sync status to pending
  async resetSyncStatus(): Promise<this> {
    try {
      return await this.database.write(async () => {
        // Use super.update directly to bypass our custom update method
        // that would automatically set lastUpdate and syncStatus
        await super.update(record => {
          record.syncStatusField = 'pending';
          // Don't update lastUpdate, keep the existing value
        });
        
        return this;
      });
    } catch (error) {
      console.error(`[DB ${this.table}] Error resetting sync status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Helper method to get sync data for this record
  getSyncData(): Record<string, any> {
    // Return a plain object with all fields needed for synchronization
    const syncData: Record<string, any> = {
      sync_id: this.syncId,
      last_update: this.lastUpdate,
      is_deleted: this.isDeleted,
      // Add other fields that need to be synchronized
    };

    // Add all model fields dynamically
    Object.keys(this._raw).forEach(key => {
      // Skip id, owner and sync_status fields
      if (!syncData[key] && key !== 'sync_status' && key !== 'id' && key !== 'owner') {
        // Używamy bezpośrednio nazw pól w formacie snake_case
        syncData[key] = (this as any)[this.camelCaseToJs(key)];
      }
    });

    // Upewnij się, że wszystkie pola są w formacie snake_case
    const finalData: Record<string, any> = {};
    Object.entries(syncData).forEach(([key, value]) => {
      // Konwertuj camelCase na snake_case
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      finalData[snakeKey] = value;
    });

    return finalData;
  }

  // Helper method to convert snake_case to camelCase
  private camelCaseToJs(snakeCase: string): string {
    return snakeCase.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  // Helper method to apply sync data from server
  async applySyncData(serverData: Record<string, any>): Promise<this> {
    try {
      // Get the constructor of this instance
      const ModelClass = this.constructor as any;
      
      // Prepare server data first to handle field mapping
      const preparedData = ModelClass.prepareServerData ? 
                          ModelClass.prepareServerData(serverData, this) : 
                          serverData;
      
      return await this.database.write(async () => {
        // Use super.update to bypass our custom update method
        // so we can explicitly set the sync status and lastUpdate
        await super.update(record => {
          // Apply server data to local record
          Object.entries(preparedData).forEach(([key, value]) => {
            // Skip id and internal fields
            if (key !== 'id' && key !== 'syncStatus') {
              try {
                // Check if this is a relation field
                if (key === 'recipe' || key === 'tag') {
                  // Skip relation fields - they will be established via the ID fields (recipeId, tagId)
                  console.log(`[DB ${this.table}] Skipping relation field ${key} during sync data application`);
                } else {
                  // Regular field, set directly
                  (record as any)[key] = value;
                }
              } catch (e) {
                console.log(`[DB ${this.table}] Error setting field ${key}: ${e}`);
              }
            }
          });
          
          // Explicitly set sync status to synced
          record.syncStatusField = 'synced';
          
          // Use the server's lastUpdate value if provided
          if (preparedData.lastUpdate) {
            record.lastUpdate = preparedData.lastUpdate;
          }
        });
        
        return this;
      });
    } catch (error) {
      console.error(`[DB ${this.table}] Error applying sync data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Helper method to compare dates and determine if server data is newer
  static isServerDataNewer(localDate: string | null, serverDate: string | null): boolean {
    // If we don't have a local date, server data is considered newer
    if (!localDate) {
      console.log(`No local date, server data is considered newer`);
      return true;
    }
    
    // If we don't have a server date, local data is considered newer
    if (!serverDate) {
      console.log(`No server date, local data is considered newer`);
      return false;
    }
    
    // Compare dates
    const localTime = new Date(localDate).getTime();
    const serverTime = new Date(serverDate).getTime();
    
    console.log(`Comparing timestamps - Local: ${localTime}, Server: ${serverTime}`);
    
    return serverTime > localTime;
  }

  // Override update method to automatically update sync fields
  async update(recordUpdater?: (record: this) => void): Promise<this> {
    try {
      // Remember initial values using getters
      const initialSyncStatus = this.syncStatus;
      const initialLastUpdate = this.lastUpdate;
      
      // Use database.write to wrap the update operation
      return await this.database.write(async () => {
        // Use super.update to apply changes
        await super.update(record => {
          // First apply the user's updates if provided
          if (recordUpdater) {
            recordUpdater(record);
          }
          
          // Check if sync_status was explicitly changed by the recordUpdater
          const syncStatusChanged = record.syncStatus !== initialSyncStatus;
          
          // If sync_status wasn't explicitly changed, set it to 'pending'
          if (!syncStatusChanged) {
            record.syncStatus = 'pending';
          }
          
          // Check if last_update was explicitly changed by the recordUpdater
          const lastUpdateChanged = record.lastUpdate !== initialLastUpdate;
          
          // If last_update wasn't explicitly changed, update it
          if (!lastUpdateChanged) {
            record.lastUpdate = new Date().toISOString();
          }
        });
        
        return this;
      });
    } catch (error) {
      console.error(`[DB ${this.table}] Error updating record ${this.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Helper method to mark record as deleted
  async markAsDeleted(): Promise<void> {
    try {
      await this.database.write(async () => {
        // Use super.update directly to avoid nested transactions
        await super.update(record => {
          record.isDeleted = true;
          record.syncStatus = 'pending';
          record.lastUpdate = new Date().toISOString();
        });
      });
    } catch (error) {
      console.error(`[DB ${this.table}] Error marking record as deleted: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Helper function to apply default values for BaseModel fields
  static applyBaseModelDefaults<T extends BaseModel>(record: T, activeUser: string | null): void {
    // Set base fields with the same logic as in BaseModel.create
    record.owner = activeUser;
    if (!record.syncStatus) {
      record.syncStatus = 'pending';
    }
    if (!record.lastUpdate) {
      record.lastUpdate = new Date().toISOString();
    }
    record.syncId = record.syncId || uuidv4(); // Use existing syncId if provided
    record.isDeleted = false;
  }

  // Base create method that handles sync fields
  static async create<T extends BaseModel>(
    this: { new(): T } & typeof Model,
    database: Database,
    recordUpdater: (record: T) => void
  ): Promise<T> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      return await database.write(async () => {
        const record = await database.get<T>(this.table).create((newRecord: T) => {
          // First apply the user's updates
          recordUpdater(newRecord);
          
          // Then apply base model defaults using the helper function
          BaseModel.applyBaseModelDefaults(newRecord, activeUser);
        });

        return record;
      });
    } catch (error) {
      console.error(`[DB ${this.table}] Error creating record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Create a record from server data during sync
  static async createFromServer<T extends BaseModel>(
    this: { new(): T } & typeof BaseModel,
    database: Database,
    serverData: Record<string, any>
  ): Promise<T> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      // Prepare server data first to handle field mapping
      const preparedData = this.prepareServerData<T>(serverData);
      
      return await database.write(async () => {
        const record = await database.get<T>(this.table).create((newRecord: T) => {
          // Apply all server data fields to the new record
          Object.entries(preparedData).forEach(([key, value]) => {
            // Skip id field as it will be generated by WatermelonDB
            if (key !== 'id') {
              try {
                // Check if this is a relation field
                if (key === 'recipe' || key === 'tag') {
                  // Skip relation fields - they will be established via the ID fields (recipeId, tagId)
                  console.log(`[DB ${this.table}] Skipping relation field ${key} during creation from server`);
                } else {
                  // Regular field, set directly
                  (newRecord as any)[key] = value;
                }
              } catch (e) {
                console.log(`[DB ${this.table}] Error setting field ${key}: ${e}`);
              }
            }
          });
          
          // Ensure required fields are set
          newRecord.owner = activeUser;
          newRecord.syncStatusField = 'synced';
          
          // Use server's lastUpdate if provided, otherwise use current time
          if (!newRecord.lastUpdate) {
            newRecord.lastUpdate = new Date().toISOString();
          }
        });

        return record;
      });
    } catch (error) {
      console.error(`[DB ${this.table}] Error creating record from server data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Method to find existing records that match a server object
  // This can be overridden in derived classes to change the matching logic
  static async findMatchingRecords<T extends BaseModel>(
    this: { new(): T } & typeof BaseModel,
    database: Database,
    serverObject: Record<string, any>
  ): Promise<T[]> {
    // Default implementation: match by syncId
    // Check both syncId (camelCase) and sync_id (snake_case)
    const syncId = serverObject.syncId || serverObject.sync_id;
    
    if (!syncId) {
      return [];
    }
    
    
    const records = await database
      .get<T>(this.table)
      .query(Q.where('sync_id', syncId))
      .fetch();
      
    return records;
  }

  // Method to prepare server data before creating or updating a record
  // This can be overridden in derived classes to modify server data
  static prepareServerData<T extends BaseModel>(
    this: { new(): T } & typeof BaseModel,
    serverObject: Record<string, any>,
    existingRecord?: T
  ): Record<string, any> {
    // Create a copy of the server object to avoid modifying the original
    const preparedData = { ...serverObject };
    
    // Handle special fields mapping from snake_case to camelCase
    const specialFields = {
      'sync_id': 'syncId',
      'last_update': 'lastUpdate',
      'is_deleted': 'isDeleted',
      'sync_status': 'syncStatusField'
    };
    
    // Map special fields first
    Object.entries(specialFields).forEach(([snakeCase, camelCase]) => {
      if (preparedData[snakeCase] !== undefined && preparedData[camelCase] === undefined) {
        preparedData[camelCase] = preparedData[snakeCase];
      }
    });
    
    // Map all other snake_case fields to camelCase
    Object.keys(preparedData).forEach(key => {
      if (key.includes('_')) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        if (camelKey !== key && preparedData[camelKey] === undefined && !Object.keys(specialFields).includes(key)) {
          preparedData[camelKey] = preparedData[key];
        }
      }
    });
    
    // If there's an existing record and server object doesn't have syncId, use the one from the record
    if (existingRecord && !preparedData.syncId) {
      preparedData.syncId = existingRecord.syncId;
      console.log(`[DB ${this.table}] Using existing record's syncId: ${preparedData.syncId}`);
    }
    
    // Ensure syncId is set
    if (!preparedData.syncId) {
      preparedData.syncId = uuidv4();
      console.log(`[DB ${this.table}] Generated new syncId for server object: ${preparedData.syncId}`);
    }
    
    return preparedData;
  }

  // Method to determine if server data should update local record
  // This can be overridden in derived classes to change the update logic
  static shouldUpdateRecord<T extends BaseModel>(
    this: { new(): T } & typeof BaseModel,
    existingRecord: T,
    serverObject: Record<string, any>
  ): boolean {
    // Default implementation: update if server data is newer
    const localDate = existingRecord.lastUpdate;
    const serverDate = serverObject.lastUpdate;
    
    console.log(`[DB ${this.table}] Comparing dates - Local: ${localDate}, Server: ${serverDate}`);
    
    // Always update if the record is marked as deleted on the server
    if (serverObject.isDeleted === true) {
      console.log(`[DB ${this.table}] Server object is marked as deleted, updating local record`);
      return true;
    }
    
    return this.isServerDataNewer(localDate, serverDate);
  }

  // Method to filter server objects before sync
  // This can be overridden in derived classes to customize which objects are processed
  static async filterServerObjectsForSync<T extends BaseModel>(
    this: { new(): T } & typeof BaseModel,
    database: Database,
    serverObjects: Record<string, any>[]
  ): Promise<Record<string, any>[]> {
    // Default implementation: process all server objects
    return serverObjects;
  }

  // Pull synchronization method
  static async pullSync<T extends BaseModel>(
    this: { new(): T } & typeof BaseModel,
    database: Database,
    serverObjects: Record<string, any>[]
  ): Promise<{
    created: number;
    updated: number;
    unchanged: number;
    errors: { syncId: string; error: string }[];
  }> {
    const result = {
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: [] as { syncId: string; error: string }[]
    };

    try {
      // Filter server objects using the customizable method
      const filteredObjects = await this.filterServerObjectsForSync<T>(database, serverObjects);
      
      if (filteredObjects.length === 0) {
        return result;
      }
      
      console.log(`[DB ${this.table}] Processing ${filteredObjects.length} filtered objects`);
      
      // Collect all batch operations to be executed in a single transaction
      const batchOperations: Model[] = [];
      
      // First, collect all the operations we need to perform
      for (const serverObject of filteredObjects) {
        try {
          // Prepare server data first to ensure syncId is properly mapped
          const preparedData = this.prepareServerData<T>(serverObject);
          
          // Find existing records that match this server object
          // Use special methods for Ingredient and RecipeTag to handle relations
          let existingRecords: T[] = [];
          if (this.table === 'ingredients' && typeof (this as any).findMatchingRecordsWithRecipe === 'function') {
            existingRecords = await (this as any).findMatchingRecordsWithRecipe(database, preparedData);
          } else if (this.table === 'recipe_tags' && typeof (this as any).findMatchingRecordsWithRelations === 'function') {
            existingRecords = await (this as any).findMatchingRecordsWithRelations(database, preparedData);
          } else {
            existingRecords = await this.findMatchingRecords<T>(database, preparedData);
          }
          
          if (existingRecords.length === 0) {
            
            // Get the active user for record ownership
            const activeUser = await AuthService.getActiveUser();
            
            // Add create operation to the batch
            batchOperations.push(
              database.get<T>(this.table).prepareCreate((record: T) => {
                // Apply all server data fields to the new record
                Object.entries(preparedData).forEach(([key, value]) => {
                  // Skip id field as it will be generated by WatermelonDB
                  // Also skip owner field as it will be set explicitly
                  if (key !== 'id' && key !== 'owner') {
                    try {
                      // Check if this is a relation field by checking if it has a corresponding @relation decorator
                      // For example, 'recipe' would be a relation field if there's a @relation decorator for it
                      if (key === 'recipe' || key === 'tag') {
                        // Skip relation fields - they will be established via the ID fields (recipeId, tagId)
                      } else {
                        // Regular field, set directly
                        (record as any)[key] = value;
                      }
                    } catch (e) {
                      console.log(`[DB ${this.table}] Error setting field ${key}: ${e}`);
                    }
                  }
                });
                
                // Ensure required fields are set
                record.syncStatusField = 'synced';
                record.owner = activeUser; // Always use activeUser, ignore server value
                
                // Use server's lastUpdate if provided, otherwise use current time
                if (!record.lastUpdate) {
                  record.lastUpdate = new Date().toISOString();
                }
              })
            );
            result.created++;
          } else {
            // Record exists, check if we need to update it
            const existingRecord = existingRecords[0];
            console.log(`[DB ${this.table}] Found existing record with syncId: ${existingRecord.syncId}, checking if update needed`);
            
            // Check if we should update using the shouldUpdateRecord method
            if (this.shouldUpdateRecord<T>(existingRecord, preparedData)) {
              console.log(`[DB ${this.table}] Updating record with syncId: ${existingRecord.syncId}`);
              
              // Server data is newer, prepare to update the record
              batchOperations.push(
                existingRecord.prepareUpdate(record => {
                  // Apply server data to local record
                  Object.entries(preparedData).forEach(([key, value]) => {
                    // Skip id and internal fields
                    if (key !== 'id' && key !== 'syncStatus') {
                      try {
                        // Check if this is a relation field
                        if (key === 'recipe' || key === 'tag') {
                          // Skip relation fields - they will be established via the ID fields (recipeId, tagId)
                          console.log(`[DB ${this.table}] Skipping relation field ${key} during update`);
                        } else {
                          // Regular field, set directly
                          (record as any)[key] = value;
                        }
                      } catch (e) {
                        console.log(`[DB ${this.table}] Error setting field ${key}: ${e}`);
                      }
                    }
                  });
                  
                  // Explicitly set sync status to synced
                  record.syncStatusField = 'synced';
                })
              );
              result.updated++;
            } else {
              console.log(`[DB ${this.table}] No update needed for record with syncId: ${existingRecord.syncId}`);
              result.unchanged++;
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const syncId = serverObject.syncId || serverObject.sync_id || 'unknown';
          console.error(`[DB ${this.table}] Error processing server object with syncId ${syncId}: ${errorMessage}`);
          result.errors.push({ 
            syncId: syncId, 
            error: errorMessage 
          });
        }
      }
      
      // Execute all operations in a single transaction if there are any
      if (batchOperations.length > 0) {
        console.log(`[DB ${this.table}] Executing ${batchOperations.length} operations in a single transaction`);
        
        // Execute all operations in a single batch
        await database.write(async () => {
          await database.batch(...batchOperations);
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DB ${this.table}] Error during pull sync: ${errorMessage}`);
      throw error;
    }
  }
} 