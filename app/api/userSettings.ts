import api from './api';

// Interface for user settings from API
export interface UserSettingsApiResponse {
  auto_translate_recipes: boolean;
}

// Interface for updating user settings
export interface UserSettingsUpdateRequest {
  auto_translate_recipes?: boolean;
}

/**
 * API for managing user settings
 */
export const UserSettingsApi = {
  /**
   * Fetches user settings from the API
   * @returns User settings object
   */
  getUserSettings: async (): Promise<UserSettingsApiResponse> => {
    try {
      return await api.get<UserSettingsApiResponse>('/api/users/me/settings/', true);
    } catch (error) {
      console.error('[UserSettingsApi] Error fetching user settings:', error);
      throw error;
    }
  },

  /**
   * Updates user settings via API
   * @param settings Settings to update
   * @returns Updated user settings
   */
  updateUserSettings: async (settings: UserSettingsUpdateRequest): Promise<UserSettingsApiResponse> => {
    try {
      return await api.put<UserSettingsApiResponse>('/api/users/me/settings/', settings, true);
    } catch (error) {
      console.error('[UserSettingsApi] Error updating user settings:', error);
      throw error;
    }
  },

  /**
   * Updates a single setting
   * @param key Setting key
   * @param value Setting value
   * @returns Updated user settings
   */
  updateSetting: async <K extends keyof UserSettingsUpdateRequest>(
    key: K, 
    value: UserSettingsUpdateRequest[K]
  ): Promise<UserSettingsApiResponse> => {
    const updateData = { [key]: value } as UserSettingsUpdateRequest;
    return UserSettingsApi.updateUserSettings(updateData);
  }
}; 

// Add default export for Expo Router compatibility
export default UserSettingsApi; 