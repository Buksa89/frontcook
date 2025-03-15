import { field, writer } from '@nozbe/watermelondb/decorators'
import { Database } from '@nozbe/watermelondb'
import BaseModel from './BaseModel'
import { Q } from '@nozbe/watermelondb'
import { Model } from '@nozbe/watermelondb'
import { text } from '@nozbe/watermelondb/decorators'
import { SyncItemType, UserSettingsSync } from '../../app/api/sync'
import AuthService from '../../app/services/auth/authService'

export default class LocalUserSettings extends BaseModel {
  static table = 'user_settings'

  @field('language') language!: string

  serialize(): UserSettingsSync {
    const base = super.serialize();
    return {
      ...base,
      object_type: 'user_settings',
      language: this.language
    };
  }

  static async deserialize(item: SyncItemType) {
    const baseFields = await BaseModel.deserialize(item);
    const settingsItem = item as UserSettingsSync;
    
    return {
      ...baseFields,
      language: settingsItem.language
    };
  }

  // Special method for handling settings sync by owner
  static async handleSync(database: Database, item: UserSettingsSync, activeUser: string) {
    try {
      // Always look up settings by owner, not by sync_id
      const existingSettings = await database.get<LocalUserSettings>('user_settings')
        .query(Q.where('owner', activeUser))
        .fetch();

      const deserializedData = await this.deserialize(item);

      if (existingSettings.length === 0) {
        // Create new settings if none exist for this owner
        return await database.get<LocalUserSettings>('user_settings').create(record => {
          Object.assign(record._raw, deserializedData);
          // Use type assertion to avoid TypeScript errors
          (record._raw as any).owner = activeUser;
          (record._raw as any).sync_status = 'synced';
        });
      } else {
        // Update existing settings
        const existingRecord = existingSettings[0];
        return await existingRecord.update(record => {
          Object.assign(record._raw, deserializedData);
          // Use type assertion to avoid TypeScript errors
          (record._raw as any).owner = activeUser;
          (record._raw as any).sync_status = 'synced';
        });
      }
    } catch (error) {
      console.error(`[DB Settings] Error handling settings sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  @writer async updateLanguage(newLanguage: 'pl' | 'en') {
    try {
      await this.update(settings => {
        settings.language = newLanguage;
        console.log(`[DB Settings] Zmiana języka: ${this.language} -> ${newLanguage}`);
      });
    } catch (error) {
      console.error(`[DB Settings] Błąd zmiany języka: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Static method to get or create settings
  static async getOrCreate(database: Database): Promise<LocalUserSettings> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      // Query settings for specific owner
      const settings = await database.get<LocalUserSettings>('user_settings')
        .query(Q.where('owner', activeUser))
        .fetch();
      
      if (settings.length > 0) {
        console.log(`[DB Settings] Pobrano ustawienia dla ${activeUser}: język=${settings[0].language}`);
        return settings[0];
      }

      const newSettings = await database.write(async () => {
        return await super.create(database, (settings: LocalUserSettings) => {
          settings.language = 'pl'
        });
      });

      console.log(`[DB Settings] Utworzono domyślne ustawienia dla ${activeUser}: język=pl`);
      return newSettings;
    } catch (error) {
      console.error(`[DB Settings] Błąd podczas pobierania/tworzenia ustawień: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 