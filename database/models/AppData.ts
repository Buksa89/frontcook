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
  @date('subscription_end') subscriptionEnd!: Date | null
  @text('csv_lock') csvLock!: string | null

  // Method to check if a server object already exists in the local database
  // Override from SyncModel to check by user instead of syncId
  static async existsInLocalDatabase<T extends SyncModel>(
    this: { new(): T } & typeof SyncModel,
    database: Database,
    serverObject: Record<string, any>
  ): Promise<boolean> {
    // Get active user
    const activeUser = await AuthService.getActiveUser();
    
    // Check if any app data exists for the current user
    const records = await database
      .get<T>(this.table)
      .query(
        Q.and(
          Q.where('owner', activeUser),
          Q.where('is_deleted', false)
        )
      )
      .fetch();
      
    return records.length > 0;
  }

  // Method to get a model from the local database for the current user
  // Override from SyncModel to get by user instead of syncId
  static async getModelBySyncId<T extends SyncModel>(
    this: { new(): T } & typeof SyncModel,
    database: Database,
    syncId: string
  ): Promise<T | null> {
    // For AppData, we ignore the syncId parameter and just get the user's record
    const activeUser = await AuthService.getActiveUser();
    
    const records = await database
      .get<T>(this.table)
      .query(
        Q.and(
          Q.where('owner', activeUser),
          Q.where('is_deleted', false)
        )
      )
      .fetch();
      
    return records.length > 0 ? records[0] : null;
  }

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
    subscriptionEnd: Date | null = null,
    csvLock: string | null = null,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: string,
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
  
  // Update method following the UserSettings pattern
  static async update(
    database: Database,
    appDataId: string,
    lastSync?: Date,
    subscriptionEnd?: Date | null,
    csvLock?: string | null,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: string,
    isDeleted?: boolean
  ): Promise<AppData | null> {
    try {
      const appData = await database
        .get<AppData>('app_data')
        .find(appDataId);
      
      if (!appData) {
        console.log(`[DB ${this.table}] App data with id ${appDataId} not found`);
        return null;
      }
      
      console.log(`[DB ${this.table}] Updating app data ${appDataId} with provided fields`);
      
      // Use the update method directly from the model instance
      await appData.update(record => {
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
      
      console.log(`[DB ${this.table}] Successfully updated app data ${appDataId}`);
      return appData;
    } catch (error) {
      console.error(`[DB ${this.table}] Error updating app data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Statyczna metoda do aktualizacji lastSync (np. dla DebugScreen)
  static async updateLastSync(
    database: Database,
    newLastSync: Date
  ): Promise<void> {
    try {
      console.log(`[DB ${this.table}] Updating last sync to ${newLastSync}`);
      
      // Get or create app data
      const appData = await this.getOrCreate(database);
      
      // Update the lastSync value
      await AppData.update(
        database,
        appData.id,
        newLastSync,
        undefined, // subscriptionEnd
        undefined, // csvLock
        undefined, // syncId
        undefined, // syncStatusField
        undefined, // lastUpdate
        undefined // isDeleted
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
        console.log(`[DB ${this.table}] Retrieved app data for ${activeUser}`);
        return appDataRecords[0];
      }

      // Create new app data using our static create method
      console.log(`[DB ${this.table}] No app data found for ${activeUser}, creating new app data`);
      return await AppData.create(
        database,
        new Date(0), // lastSync
        null, // subscriptionEnd
        null, // csvLock
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
      console.log(`[DB ${this.table}] Getting last sync date`);
      
      // Get or create app data
      const appData = await this.getOrCreate(database);
      
      // Return lastSync, defaulting to epoch if null
      return appData.lastSync
    } catch (error) {
      console.error(`[DB ${this.table}] Error getting last sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}
