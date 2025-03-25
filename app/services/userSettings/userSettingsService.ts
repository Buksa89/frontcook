import api from '../../api/api';

// Interface for user settings from API
export interface UserSettingsApiResponse {
  auto_translate_recipes: boolean;
}

// Interface for updating user settings
export interface UserSettingsUpdateRequest {
  auto_translate_recipes?: boolean;
}

/**
 * Service for managing user settings via API
 */
class UserSettingsService {
  /**
   * Fetches user settings from the API
   * @returns User settings object
   */
  async getUserSettings(): Promise<UserSettingsApiResponse> {
    try {
      return await api.get<UserSettingsApiResponse>('/api/users/me/settings/', true);
    } catch (error) {
      console.error('[UserSettingsService] Error fetching user settings:', error);
      throw error;
    }
  }

  /**
   * Updates user settings via API
   * @param settings Settings to update
   * @returns Updated user settings
   */
  async updateUserSettings(settings: UserSettingsUpdateRequest): Promise<UserSettingsApiResponse> {
    try {
      return await api.put<UserSettingsApiResponse>('/api/users/me/settings/', settings, true);
    } catch (error) {
      console.error('[UserSettingsService] Error updating user settings:', error);
      throw error;
    }
  }

  /**
   * Updates a single setting
   * @param key Setting key
   * @param value Setting value
   * @returns Updated user settings
   */
  async updateSetting<K extends keyof UserSettingsUpdateRequest>(
    key: K, 
    value: UserSettingsUpdateRequest[K]
  ): Promise<UserSettingsApiResponse> {
    const updateData = { [key]: value } as UserSettingsUpdateRequest;
    return this.updateUserSettings(updateData);
  }
}

// Export a singleton instance
const userSettingsService = new UserSettingsService();
export default userSettingsService; 