import { field, writer } from '@nozbe/watermelondb/decorators'
import { Database } from '@nozbe/watermelondb'
import BaseModel from './BaseModel'

export default class UserSettings extends BaseModel {
  static table = 'user_settings'

  @field('language') language!: string
  @field('auto_translate_recipes') autoTranslateRecipes!: boolean
  @field('allow_friends_views_recipes') allowFriendsViewsRecipes!: boolean

  @writer async updateLanguage(newLanguage: 'pl' | 'en') {
    try {
      console.log(`[DB Settings] Zmiana języka: ${this.language} -> ${newLanguage}`);
      await this.update(settings => {
        settings.language = newLanguage
        settings.syncStatus = 'pending'
        settings.lastSync = new Date().toISOString()
        settings.isLocal = true
      });
    } catch (error) {
      console.error(`[DB Settings] Błąd zmiany języka: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  @writer async updateAutoTranslate(autoTranslate: boolean) {
    try {
      console.log(`[DB Settings] Zmiana auto-tłumaczenia: ${this.autoTranslateRecipes} -> ${autoTranslate}`);
      await this.update(settings => {
        settings.autoTranslateRecipes = autoTranslate
        settings.syncStatus = 'pending'
        settings.lastSync = new Date().toISOString()
        settings.isLocal = true
      });
    } catch (error) {
      console.error(`[DB Settings] Błąd zmiany auto-tłumaczenia: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  @writer async updateAllowFriendsViews(allowFriendsViews: boolean) {
    try {
      console.log(`[DB Settings] Zmiana widoczności dla znajomych: ${this.allowFriendsViewsRecipes} -> ${allowFriendsViews}`);
      await this.update(settings => {
        settings.allowFriendsViewsRecipes = allowFriendsViews
        settings.syncStatus = 'pending'
        settings.lastSync = new Date().toISOString()
        settings.isLocal = true
      });
    } catch (error) {
      console.error(`[DB Settings] Błąd zmiany widoczności: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Static method to get or create settings
  static async getOrCreate(database: Database): Promise<UserSettings> {
    try {
      const settings = await database.get<UserSettings>('user_settings').query().fetch();
      
      if (settings.length > 0) {
        console.log(`[DB Settings] Pobrano ustawienia: język=${settings[0].language}, auto-tłumaczenie=${settings[0].autoTranslateRecipes}, widoczność=${settings[0].allowFriendsViewsRecipes}`);
        return settings[0];
      }

      const newSettings = await database.write(async () => {
        return await database.get<UserSettings>('user_settings').create(settings => {
          settings.language = 'pl'
          settings.autoTranslateRecipes = true
          settings.allowFriendsViewsRecipes = true
          settings.syncStatus = 'pending'
          settings.lastSync = new Date().toISOString()
          settings.isLocal = true
          settings.owner = null
        });
      });

      console.log(`[DB Settings] Utworzono domyślne ustawienia: język=pl, auto-tłumaczenie=true, widoczność=true`);
      return newSettings;
    } catch (error) {
      console.error(`[DB Settings] Błąd bazy danych: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 