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

  // Override findMatchingRecords to find settings for the current user
  static async findMatchingRecords<T extends BaseModel>(
    database: Database,
    serverObject: Record<string, any>
  ): Promise<T[]> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      // Find existing settings for this user
      return await database
        .get<T>(this.table)
        .query(
          Q.and(
            Q.where('owner', activeUser),
            Q.where('is_deleted', false)
          )
        )
        .fetch();
    } catch (error) {
      console.error(`[DB ${this.table}] Error finding matching records: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  // Override filterServerObjectsForSync to get only the most recent object for the active user
  static async filterServerObjectsForSync<T extends BaseModel>(
    this: { new(): T } & typeof BaseModel,
    database: Database,
    serverObjects: Record<string, any>[]
  ): Promise<Record<string, any>[]> {
    try {
      console.log(`[DB ${this.table}] Filtering ${serverObjects.length} server objects for sync`);
      
      if (serverObjects.length === 0) {
        return [];
      }
      
      // Nie filtrujemy po owner, ponieważ serwer może używać innego pola (np. user)
      // Zamiast tego, po prostu wybieramy najnowszy obiekt, jeśli jest ich wiele
      
      // Get the most recent server object
      const mostRecentObject = serverObjects.sort((a, b) => {
        const aTime = a.last_update ? new Date(a.last_update).getTime() : 0;
        const bTime = b.last_update ? new Date(b.last_update).getTime() : 0;
        return bTime - aTime;
      })[0];
      
      console.log(`[DB ${this.table}] Selected most recent object for sync`);
      return [mostRecentObject];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[DB ${this.table}] Error filtering server objects: ${errorMessage}`);
      return [];
    }
  }
} 