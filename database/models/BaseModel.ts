import 'react-native-get-random-values'
import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'
import { SyncStatus } from '@nozbe/watermelondb/Model'
import { Q } from '@nozbe/watermelondb'
import { Database } from '@nozbe/watermelondb'
import { v4 as uuidv4 } from 'uuid'
import { SyncItemType } from '../../app/api/sync'
import AuthService from '../../app/services/auth/authService'

export default class BaseModel extends Model {
  @field('sync_id') syncId!: string
  @field('sync_status') synchStatus!: SyncStatus
  @field('last_update') lastUpdate!: string | null
  @field('is_local') isLocal!: boolean | null
  @text('owner') owner!: string | null
  @field('is_deleted') isDeleted!: boolean

  static async deserialize(item: SyncItemType) {
    return {
      sync_id: item.sync_id,
      sync_status: 'synced',
      last_update: item.last_update,
      is_deleted: item.is_deleted,
      is_local: false
    };
  }

  serialize(): BaseSyncItem {
    return {
      sync_id: this.syncId,
      sync_status: this.synchStatus,
      last_update: this.lastUpdate || new Date().toISOString(),
      is_deleted: this.isDeleted,
      owner: this.owner
    };
  }

  // Helper methods for sync status
  get isPending(): boolean {
    return this.synchStatus === 'pending'
  }

  get isSynced(): boolean {
    return this.synchStatus === 'synced'
  }

  get hasConflict(): boolean {
    return this.synchStatus === 'conflict'
  }

  // Helper method to format last sync date
  get lastUpdateDate(): Date | null {
    return this.lastUpdate ? new Date(this.lastUpdate) : null
  }

  // Override update method to automatically update sync fields
  async update(recordUpdater?: (record: this) => void): Promise<this> {
    try {
      console.log(`[DB ${this.table}] Updating record ${this.id}`);
      
      // Zapamiętaj początkowe wartości
      const initialSyncStatus = this._raw.sync_status;
      const initialLastUpdate = this._raw.last_update;
      
      const result = await super.update(record => {
        // First apply the user's updates if provided
        if (recordUpdater) {
          recordUpdater(record);
          console.log(`[DB ${this.table}] Record ${this.id} updated with:`, record._raw);
        }
        
        // Sprawdź, czy sync_status został jawnie zmieniony
        const syncStatusChanged = record._raw.sync_status !== initialSyncStatus;
        
        // Jeśli sync_status nie został jawnie zmieniony, ustaw go na 'pending'
        if (!syncStatusChanged) {
          record._raw.sync_status = 'pending';
        }
        
        // Sprawdź, czy last_update został jawnie zmieniony
        const lastUpdateChanged = record._raw.last_update !== initialLastUpdate;
        
        // Jeśli last_update nie został jawnie zmieniony, zaktualizuj go
        if (!lastUpdateChanged) {
          record._raw.last_update = new Date().toISOString();
        }
        
        record._raw.is_local = true;
      });

      return result;
    } catch (error) {
      console.error(`[DB ${this.table}] Error updating record ${this.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Helper method to mark record and its related records as deleted
  async markAsDeleted(cascade: boolean = true): Promise<void> {
    try {
      
      await this.database.write(async () => {
        // Mark this record as deleted
        await this.update(() => {
          this.isDeleted = true;
        });

      });
      
      console.log(`[DB ${this.table}] Successfully marked record ${this.id} as deleted`);
    } catch (error) {
      console.error(`[DB ${this.table}] Error marking record as deleted: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Base create method that handles sync fields
  static async create<T extends BaseModel>(
    this: { new(): T } & typeof BaseModel,
    database: Database,
    recordUpdater: (record: T) => void
  ): Promise<T> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      const record = await database.get(this.table).create((record: T) => {
        // First apply the user's updates
        recordUpdater(record);
        
        // Then set sync and owner fields, but only if they weren't set
        record.owner = activeUser;
        if (!record.synchStatus) {
          record.synchStatus = 'pending';
        }
        if (!record.lastUpdate) {
          record.lastUpdate = new Date().toISOString();
        }
        record.isLocal = true;
        record.syncId = record.syncId || uuidv4(); // Use existing syncId if provided

        console.log(`[DB ${this.table}] New record created with:`, record._raw);
      });

      return record;
    } catch (error) {
      console.error(`[DB ${this.table}] Error creating record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 