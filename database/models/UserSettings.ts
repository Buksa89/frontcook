import { field, writer } from '@nozbe/watermelondb/decorators'
import { Database } from '@nozbe/watermelondb'
import SyncModel from './SyncModel'
import { Q } from '@nozbe/watermelondb'
import { v4 as uuidv4 } from 'uuid'
import AuthService from '../../app/services/auth/authService'

// UserSettings class uses standard SyncModel synchronization behavior
// Each user has a single UserSettings record identified by owner
export default class UserSettings extends SyncModel {
  static table = 'user_settings'

  // Fields specific to UserSettings
  @field('language') language!: string

  // Create method following the ShoppingItem pattern
  static async create(
    database: Database,
    language: string = 'pl',
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: Date,
    isDeleted?: boolean
  ): Promise<UserSettings> {
    try {
      console.log(`[DB ${this.table}] Creating new user settings with language: ${language}`);
      
      // Use the parent SyncModel.create method
      return await SyncModel.create.call(
        this as unknown as (new () => SyncModel) & typeof SyncModel,
        database,
        (record: SyncModel) => {
          const settings = record as UserSettings;
          
          // Set user settings specific fields
          settings.language = language;
          
          // Set optional SyncModel fields if provided
          if (syncId !== undefined) settings.syncId = syncId;
          if (syncStatusField !== undefined) settings.syncStatusField = syncStatusField;
          if (lastUpdate !== undefined) settings.lastUpdate = lastUpdate;
          if (isDeleted !== undefined) settings.isDeleted = isDeleted;
        }
      ) as UserSettings;
    } catch (error) {
      console.error(`[DB ${this.table}] Error creating user settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Static method to get or create settings
  static async getOrCreate(database: Database): Promise<UserSettings> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      // Query settings for specific owner
      const settingsRecords = await database.get<UserSettings>('user_settings')
        .query(
          Q.and(
            Q.where('owner', activeUser),
            Q.where('is_deleted', false)
          )
        )
        .fetch();
      
      if (settingsRecords.length > 0) {
        // console.log(`[DB ${this.table}] Retrieved settings for ${activeUser}`);
        return settingsRecords[0];
      }

      // Create new settings using our static create method
      console.log(`[DB ${this.table}] No settings found for ${activeUser}, creating new settings`);
      return await UserSettings.create(
        database,
        'pl', // default language
        undefined, // syncId
        undefined, // syncStatusField
        undefined, // lastUpdate
        undefined  // isDeleted
      );
    } catch (error) {
      console.error(`[DB ${this.table}] Error getting or creating settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Get language setting, creating a record if none exists
  static async getLanguage(database: Database): Promise<string> {
    try {
      // console.log(`[DB ${this.table}] Getting language setting`);
      
      // Get or create user settings
      const settings = await this.getOrCreate(database);
      
      // Return language, defaulting to 'pl' if null
      return settings.language || 'pl';
    } catch (error) {
      console.error(`[DB ${this.table}] Error getting language: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Static method to update language
  static async updateLanguage(
    database: Database,
    newLanguage: string
  ): Promise<void> {
    try {
      // console.log(`[DB ${this.table}] Updating language to ${newLanguage}`);
      
      // Use upsert to update or create settings with new language
      await this.upsert(
        database,
        newLanguage,   // language
        undefined,     // syncId
        undefined,     // syncStatusField
        undefined,     // lastUpdate
        undefined      // isDeleted
      );
    } catch (error) {
      console.error(`[DB ${this.table}] Error updating language: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Static method to upsert (create or update) user settings
  static async upsert(
    database: Database,
    language?: string,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: Date,
    isDeleted?: boolean
  ): Promise<UserSettings> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      // Query settings for specific owner
      const settingsRecords = await database.get<UserSettings>('user_settings')
        .query(
          Q.and(
            Q.where('owner', activeUser),
            Q.where('is_deleted', false)
          )
        )
        .fetch();
      
      let settings: UserSettings;
      
      if (settingsRecords.length > 0) {
        // Record exists, update it
        settings = settingsRecords[0];
        
        await settings.update((record: UserSettings) => {
          // Update only provided fields
          if (language !== undefined) record.language = language;
          
          // Update SyncModel fields if provided
          if (syncId !== undefined) record.syncId = syncId;
          if (syncStatusField !== undefined) record.syncStatusField = syncStatusField;
          if (lastUpdate !== undefined) record.lastUpdate = lastUpdate;
          if (isDeleted !== undefined) record.isDeleted = isDeleted;
        });
        
        console.log(`[DB ${this.table}] Updated existing settings for user ${activeUser}`);
      } else {
        // No record exists, create new one
        settings = await UserSettings.create(
          database,
          language !== undefined ? language : 'pl', // default language
          syncId,
          syncStatusField,
          lastUpdate,
          isDeleted
        );
        
        console.log(`[DB ${this.table}] Created new settings for user ${activeUser}`);
      }
      
      return settings;
    } catch (error) {
      console.error(`[DB ${this.table}] Error upserting user settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Implementacja createFromSyncData dla klasy UserSettings
  static async createFromSyncData<T extends SyncModel>(
    this: typeof UserSettings,
    database: Database,
    deserializedData: Record<string, any>,
  ): Promise<T> {

    // Przygotuj argumenty dla UserSettings.create na podstawie deserializedData
    const language = deserializedData.language || 'pl'; // Domyślna wartość

    // Przygotuj pola synchronizacji do przekazania
    const syncStatus: 'pending' | 'synced' | 'conflict' = 'synced';
    const isDeleted = !!deserializedData.isDeleted;
    const syncId = deserializedData.syncId;
    let lastUpdate: Date | undefined = undefined;
    if ('lastUpdate' in deserializedData && deserializedData.lastUpdate) {
      try { lastUpdate = new Date(deserializedData.lastUpdate); } catch (e) { lastUpdate = new Date(); }
    } else {
      lastUpdate = new Date(); // Fallback
    }

    // Wywołaj istniejącą metodę UserSettings.create, przekazując wszystkie dane
    const newUserSettings = await (UserSettings.create as any)(
      database,
      language,
      // Przekaż pola synchronizacji jawnie
      syncId,
      syncStatus,
      lastUpdate,
      isDeleted
    );

    return newUserSettings as unknown as T;
  }
}