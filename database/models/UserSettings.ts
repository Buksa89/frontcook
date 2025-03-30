import { field, writer } from '@nozbe/watermelondb/decorators'
import { Database } from '@nozbe/watermelondb'
import SyncModel from './SyncModel'
import { Q } from '@nozbe/watermelondb'
import { v4 as uuidv4 } from 'uuid'
import AuthService from '../../app/services/auth/authService'

export default class UserSettings extends SyncModel {
  static table = 'user_settings'

  // Fields specific to UserSettings
  @field('language') language!: string

  // Method to check if a server object already exists in the local database
  // Override from SyncModel to check by user instead of syncId
  static async existsInLocalDatabase<T extends SyncModel>(
    this: { new(): T } & typeof SyncModel,
    database: Database,
    serverObject: Record<string, any>
  ): Promise<boolean> {
    // Get active user
    const activeUser = await AuthService.getActiveUser();
    
    // Check if any user settings exists for the current user
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
    // For UserSettings, we ignore the syncId parameter and just get the user's record
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

  // Create method following the ShoppingItem pattern
  static async create(
    database: Database,
    language: string = 'pl',
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: string,
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
  
  // Update method following the ShoppingItem pattern
  static async update(
    database: Database,
    settingsId: string,
    language?: string,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: string,
    isDeleted?: boolean
  ): Promise<UserSettings | null> {
    try {
      const settings = await database
        .get<UserSettings>('user_settings')
        .find(settingsId);
      
      if (!settings) {
        console.log(`[DB ${this.table}] User settings with id ${settingsId} not found`);
        return null;
      }
      
      console.log(`[DB ${this.table}] Updating user settings ${settingsId} with provided fields`);
      
      // Use the update method directly from the model instance
      await settings.update(record => {
        // Update only provided fields
        if (language !== undefined) record.language = language;
        
        // Update SyncModel fields if provided
        if (syncId !== undefined) record.syncId = syncId;
        if (syncStatusField !== undefined) record.syncStatusField = syncStatusField;
        if (lastUpdate !== undefined) record.lastUpdate = lastUpdate;
        if (isDeleted !== undefined) record.isDeleted = isDeleted;
      });
      
      console.log(`[DB ${this.table}] Successfully updated user settings ${settingsId}`);
      return settings;
    } catch (error) {
      console.error(`[DB ${this.table}] Error updating user settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Uproszczona metoda aktualizacji języka korzystająca z naprawionej metody update() z SyncModel
  async updateLanguage(newLanguage: 'pl' | 'en'): Promise<this> {
    try {
      console.log(`[DB ${this.table}] Updating language from ${this.language} to ${newLanguage}`);
      
      // Use the static update method
      await UserSettings.update(
        this.database,
        this.id,
        newLanguage
      );
      
      return this;
    } catch (error) {
      console.error(`[DB Settings] Błąd podczas zmiany języka: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Static method to get or create settings
  static async getOrCreate(database: Database): Promise<UserSettings> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      // Query settings for specific owner
      const settings = await database.get<UserSettings>('user_settings')
        .query(
          Q.and(
            Q.where('owner', activeUser),
            Q.where('is_deleted', false)
          )
        )
        .fetch();
      
      if (settings.length > 0) {
        console.log(`[DB ${this.table}] Retrieved settings for ${activeUser}: language=${settings[0].language}`);
        return settings[0];
      }

      // Create new settings using our static create method
      console.log(`[DB ${this.table}] No settings found for ${activeUser}, creating new settings`);
      return await UserSettings.create(
        database,
        'pl' // default language
      );
    } catch (error) {
      console.error(`[DB ${this.table}] Error getting or creating settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

}