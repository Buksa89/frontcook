import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'

export default class BaseModel extends Model {
  @field('sync_status') syncStatus!: string
  @field('last_sync') lastSync!: string
  @field('is_local') isLocal!: boolean
  @text('owner') owner!: string | null

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
  get lastSyncDate(): Date | null {
    return this.lastSync ? new Date(this.lastSync) : null
  }
} 