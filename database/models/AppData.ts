import { Model } from '@nozbe/watermelondb'
import { field, text, date } from '@nozbe/watermelondb/decorators'
import { Database } from '@nozbe/watermelondb'
import { Q } from '@nozbe/watermelondb'
import { Observable, from, of } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import AuthService from '../../app/services/auth/authService'
import SyncModel from './SyncModel'

export default class AppData extends SyncModel {
  static table = 'app_data'

  @date('last_sync') lastSync!: Date
  @date('subscription_end') subscriptionEnd!: Date
  @text('csv_lock') csvLock!: Date

  // Static method to observe subscription status
  static observeSubscriptionStatus(database: Database): Observable<{ isActive: boolean, endDate: Date | null }> {
    return new Observable<{ isActive: boolean, endDate: Date | null }>(subscriber => {
      let subscription: any;
      
      AuthService.getActiveUser().then(activeUser => {
        subscription = database
          .get<AppData>('app_data')
          .query(
            Q.and(
              Q.where('owner', activeUser),
              Q.where('is_deleted', false)
            )
          )
          .observe()
          .pipe(
            map(appDataArray => {
              if (appDataArray.length === 0) {
                return { isActive: false, endDate: null };
              }
              
              const appData = appDataArray[0];
              const subscriptionEnd = appData.subscriptionEnd;
              const now = new Date();
              
              // Check if subscription is active
              const isActive = subscriptionEnd ? subscriptionEnd > now : false;
              
              return { isActive, endDate: subscriptionEnd };
            })
          )
          .subscribe(subscriber);
      });

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    });
  }

  // Create method following the same pattern as UserSettings
  static async create(
    database: Database,
    lastSync: Date = new Date(0), // Unix epoch as default if not provided
    subscriptionEnd: Date = new Date(0),
    csvLock: Date = new Date(0),
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: Date,
    isDeleted?: boolean
  ): Promise<AppData> {
    try {
      console.log(`[DB ${this.table}] Creating new app data with lastSync: ${lastSync}, subscriptionEnd: ${subscriptionEnd}, csvLock: ${csvLock}`);
      
      // Use the parent SyncModel.create method
      return await SyncModel.create.call(
        this as unknown as (new () => SyncModel) & typeof SyncModel,
        database,
        (record: SyncModel) => {
          const appData = record as AppData;
          
          // Set AppData specific fields
          appData.lastSync = lastSync;
          appData.subscriptionEnd = subscriptionEnd;
          appData.csvLock = csvLock;
          
          // Set optional SyncModel fields if provided
          if (syncId !== undefined) appData.syncId = syncId;
          if (syncStatusField !== undefined) appData.syncStatusField = syncStatusField;
          if (lastUpdate !== undefined) appData.lastUpdate = lastUpdate;
          if (isDeleted !== undefined) appData.isDeleted = isDeleted;
        }
      ) as AppData;
    } catch (error) {
      console.error(`[DB ${this.table}] Error creating app data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  // Statyczna metoda do aktualizacji lastSync (np. dla DebugScreen)
  static async updateLastSync(
    database: Database,
    newLastSync: Date
  ): Promise<void> {
    try {
      // console.log(`[DB ${this.table}] Updating last sync to ${newLastSync}`);
      
      // Use upsert to update or create app data with new lastSync
      await this.upsert(
        database,
        newLastSync, // lastSync
        undefined,   // subscriptionEnd
        undefined,   // csvLock
        undefined,   // syncId
        undefined,   // syncStatusField
        undefined,   // lastUpdate
        undefined    // isDeleted
      );
    } catch (error) {
      console.error(`[DB ${this.table}] Error updating last sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Static method to get or create app data
  static async getOrCreate(database: Database): Promise<AppData> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      // Query app data for specific owner
      const appDataRecords = await database.get<AppData>('app_data')
        .query(
          Q.and(
            Q.where('owner', activeUser),
            Q.where('is_deleted', false)
          )
        )
        .fetch();
      
      if (appDataRecords.length > 0) {
        // console.log(`[DB ${this.table}] Retrieved app data for ${activeUser}`);
        return appDataRecords[0];
      }

      // Create new app data using our static create method
      console.log(`[DB ${this.table}] No app data found for ${activeUser}, creating new app data`);
      return await AppData.create(
        database,
        new Date(0), // lastSync
        new Date(0), // subscriptionEnd
        new Date(0), // csvLock
        undefined, // syncId
        undefined, // syncStatusField
        undefined, // lastUpdate
        undefined // isDeleted
      );
    } catch (error) {
      console.error(`[DB ${this.table}] Error getting or creating app data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Get lastSync, creating a record if none exists
  static async getLastSync(database: Database): Promise<Date> {
    try {
      // console.log(`[DB ${this.table}] Getting last sync date`);
      
      // Get or create app data
      const appData = await this.getOrCreate(database);
      
      // Return lastSync, defaulting to epoch if null
      return appData.lastSync
    } catch (error) {
      console.error(`[DB ${this.table}] Error getting last sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Static method to upsert (create or update) app data
  static async upsert(
    database: Database,
    lastSync?: Date,
    subscriptionEnd?: Date,
    csvLock?: Date,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: Date,
    isDeleted?: boolean
  ): Promise<AppData> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      // Query app data for specific owner
      const appDataRecords = await database.get<AppData>('app_data')
        .query(
          Q.and(
            Q.where('owner', activeUser),
            Q.where('is_deleted', false)
          )
        )
        .fetch();
      
      let appData: AppData;
      
      if (appDataRecords.length > 0) {
        // Record exists, update it
        appData = appDataRecords[0];
        
        await appData.update((record: AppData) => {
          // Update only provided fields
          if (lastSync !== undefined) record.lastSync = lastSync;
          if (subscriptionEnd !== undefined) record.subscriptionEnd = subscriptionEnd;
          if (csvLock !== undefined) record.csvLock = csvLock;
          
          // Update SyncModel fields if provided
          if (syncId !== undefined) record.syncId = syncId;
          if (syncStatusField !== undefined) record.syncStatusField = syncStatusField;
          if (lastUpdate !== undefined) record.lastUpdate = lastUpdate;
          if (isDeleted !== undefined) record.isDeleted = isDeleted;
        });
        
        // console.log(`[DB ${this.table}] Updated existing app data for user ${activeUser}`);
      } else {
        // No record exists, create new one
        appData = await AppData.create(
          database,
          lastSync !== undefined ? lastSync : new Date(0),
          subscriptionEnd !== undefined ? subscriptionEnd : new Date(0),
          csvLock !== undefined ? csvLock : new Date(0),
          syncId,
          syncStatusField,
          lastUpdate,
          isDeleted
        );
        
        console.log(`[DB ${this.table}] Created new app data for user ${activeUser}`);
      }
      
      return appData;
    } catch (error) {
      console.error(`[DB ${this.table}] Error upserting app data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}
