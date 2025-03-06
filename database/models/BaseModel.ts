import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'
import { SyncStatus } from '@nozbe/watermelondb/Model'
import { Q } from '@nozbe/watermelondb'
import { Database } from '@nozbe/watermelondb'
import { asyncStorageService } from '../../app/services/storage'

export default class BaseModel extends Model {
  @field('sync_status') synchStatus!: SyncStatus
  @field('last_sync') lastSync!: string
  @field('is_local') isLocal!: boolean
  @text('user_id') userId!: string | null
  @field('is_deleted') isDeleted!: boolean

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
  get lastSyncDate(): Date | null {
    return this.lastSync ? new Date(this.lastSync) : null
  }

  // Override update method to automatically update sync fields
  async update(recordUpdater?: (record: this) => void): Promise<this> {
    try {
      console.log(`[DB ${this.table}] Updating record ${this.id}`);
      
      const result = await super.update(record => {
        // First apply the user's updates if provided
        if (recordUpdater) {
          recordUpdater(record);
          console.log(`[DB ${this.table}] Record ${this.id} updated with:`, record._raw);
        }
        
        // Then update sync fields
        record._raw.sync_status = 'pending';
        record._raw.last_sync = new Date().toISOString();
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
      const activeUser = await asyncStorageService.getActiveUser();
      
      const record = await database.get(this.table).create((record: T) => {
        // First apply the user's updates
        recordUpdater(record);
        
        // Then set sync and userId fields
        record.userId = activeUser;
        record.synchStatus = 'pending';
        record.lastSync = new Date().toISOString();
        record.isLocal = true;

        console.log(`[DB ${this.table}] New record created with:`, record._raw);
      });

      return record;
    } catch (error) {
      console.error(`[DB ${this.table}] Error creating record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 