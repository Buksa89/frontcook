import { field, writer } from '@nozbe/watermelondb/decorators'
import { Database } from '@nozbe/watermelondb'
import BaseModel from './BaseModel'
import { Q } from '@nozbe/watermelondb'
import { v4 as uuidv4 } from 'uuid'
import AuthService from '../../app/services/auth/authService'

export default class UserSettings extends BaseModel {
  static table = 'user_settings'

  // Fields specific to UserSettings
  @field('language') language!: string

  // Helper method to get sync data for user settings
  getSyncData(): Record<string, any> {
    const baseData = super.getSyncData();
    return {
      ...baseData,
      object_type: 'user_settings',
      language: this.language
    };
  }

  // Uproszczona metoda aktualizacji języka korzystająca z naprawionej metody update() z BaseModel
  async updateLanguage(newLanguage: 'pl' | 'en'): Promise<this> {
    try {
      // Bezpośrednio używamy metody update() z BaseModel, która teraz prawidłowo obsługuje transakcje
      await this.update(record => {
        const oldLanguage = record.language;
        record.language = newLanguage;
        console.log(`[DB Settings] Zmiana języka: ${oldLanguage} -> ${newLanguage}`);
      });
      
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
        console.log(`[DB Settings] Pobrano ustawienia dla ${activeUser}: język=${settings[0].language}`);
        return settings[0];
      }

      // Create new settings if none exist
      return await database.write(async () => {
        const newSettings = await database.get<UserSettings>('user_settings').create((record: UserSettings) => {
          // Set user settings specific fields
          record.language = 'pl';
          
          // Apply base model defaults using the helper function
          BaseModel.applyBaseModelDefaults(record, activeUser);
        });

        console.log(`[DB Settings] Utworzono domyślne ustawienia dla ${activeUser}: język=pl`);
        return newSettings;
      });
    } catch (error) {
      console.error(`[DB Settings] Błąd podczas pobierania/tworzenia ustawień: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Override pullSync to handle the special case of user settings
  static async pullSync(
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
      console.log(`[DB ${this.table}] Starting pull sync with ${serverObjects.length} objects`);
      
      // Get active user
      const activeUser = await AuthService.getActiveUser();
      
      // Filter server objects to only include those for the active user
      const userServerObjects = serverObjects.filter(obj => obj.owner === activeUser);
      
      if (userServerObjects.length === 0) {
        console.log(`[DB ${this.table}] No server objects found for user ${activeUser}`);
        return result;
      }
      
      // Get the most recent server object
      const serverObject = userServerObjects.sort((a, b) => {
        const aTime = a.lastUpdate ? new Date(a.lastUpdate).getTime() : 0;
        const bTime = b.lastUpdate ? new Date(b.lastUpdate).getTime() : 0;
        return bTime - aTime;
      })[0];
      
      // Find existing settings for this user
      const existingSettings = await database
        .get<UserSettings>(this.table)
        .query(
          Q.and(
            Q.where('owner', activeUser),
            Q.where('is_deleted', false)
          )
        )
        .fetch();

      if (existingSettings.length === 0) {
        // No existing settings found, create new ones
        await database.write(async () => {
          await database.get<UserSettings>(this.table).create((record: UserSettings) => {
            // Apply all server data fields to the new record
            Object.entries(serverObject).forEach(([key, value]) => {
              // Skip id field as it will be generated by WatermelonDB
              if (key !== 'id') {
                // Convert camelCase to snake_case for database fields if needed
                const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                const fieldName = key === 'syncId' ? 'syncId' : 
                                 key === 'lastUpdate' ? 'lastUpdate' : 
                                 record.hasOwnProperty(key) ? key : snakeKey;
                
                // Only set if the field exists on the model
                if (record.hasOwnProperty(fieldName)) {
                  (record as any)[fieldName] = value;
                }
              }
            });
            
            // Ensure required fields are set
            record.owner = activeUser;
            record.syncStatus = 'synced';
            
            // Use server's lastUpdate if provided, otherwise use current time
            if (!record.lastUpdate) {
              record.lastUpdate = new Date().toISOString();
            }
            
            // Ensure syncId is set
            if (!record.syncId) {
              record.syncId = serverObject.syncId || uuidv4();
            }
          });
        });
        
        result.created++;
        console.log(`[DB ${this.table}] Created new settings for user ${activeUser}`);
      } else {
        // Settings exist, check if we need to update
        const existingRecord = existingSettings[0];
        
        // Check if server data is newer
        if (BaseModel.isServerDataNewer(existingRecord.lastUpdate, serverObject.lastUpdate)) {
          // Server data is newer, update the record
          await existingRecord.applySyncData(serverObject);
          result.updated++;
          console.log(`[DB ${this.table}] Updated settings for user ${activeUser}`);
        } else {
          // Local data is newer or same age, no update needed
          result.unchanged++;
          console.log(`[DB ${this.table}] No update needed for settings of user ${activeUser}`);
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DB ${this.table}] Error during pull sync: ${errorMessage}`);
      throw error;
    }
  }
} 