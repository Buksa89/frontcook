import { Model } from '@nozbe/watermelondb'
import { field, writer } from '@nozbe/watermelondb/decorators'
import { Database } from '@nozbe/watermelondb'

export default class UserSettings extends Model {
  static table = 'user_settings'

  @field('language') language!: string
  @field('auto_translate_recipes') autoTranslateRecipes!: boolean
  @field('allow_friends_views_recipes') allowFriendsViewsRecipes!: boolean

  @writer async updateLanguage(newLanguage: 'pl' | 'en') {
    await this.update(settings => {
      settings.language = newLanguage
    })
  }

  @writer async updateAutoTranslate(autoTranslate: boolean) {
    await this.update(settings => {
      settings.autoTranslateRecipes = autoTranslate
    })
  }

  @writer async updateAllowFriendsViews(allowFriendsViews: boolean) {
    await this.update(settings => {
      settings.allowFriendsViewsRecipes = allowFriendsViews
    })
  }

  // Static method to get or create settings
  static async getOrCreate(database: Database): Promise<UserSettings> {
    const settings = await database.get<UserSettings>('user_settings').query().fetch()
    
    if (settings.length > 0) {
      return settings[0]
    }

    // Create default settings if none exist
    return await database.write(async () => {
      return await database.get<UserSettings>('user_settings').create(settings => {
        settings.language = 'pl'
        settings.autoTranslateRecipes = true
        settings.allowFriendsViewsRecipes = true
      })
    })
  }
} 