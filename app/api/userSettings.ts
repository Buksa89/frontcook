// src/api/userSettings.ts
import api from './api';

// Interfejsy (bez zmian)
export interface ClientUserSettingsApiResponse { auto_translate_recipes: boolean; /* ...inne */ }
export interface ClientUserSettingsUpdateRequest { auto_translate_recipes?: boolean; /* ...inne */ }

/**
 * Obiekt singletona do zarządzania ustawieniami użytkownika przez API.
 */
const clientUserSettingsApi = { // Zmieniono nazwę na camelCase
  /**
   * Fetches user settings from the API
   */
  async getClientUserSettings(): Promise<ClientUserSettingsApiResponse> {
    console.log('[UserSettings API] Pobieranie ustawień...');
    try {
      // Użyj api.get, wymaga autoryzacji
      const response = await api.get<ClientUserSettingsApiResponse>('/api/users/me/settings/', true);
      console.log('[UserSettings API] Pobrano ustawienia:', response);
      return response;
    } catch (error) {
      console.error('[UserSettings API] Błąd pobierania ustawień:', error);
      throw error;
    }
  },

  /**
   * Updates user settings via API
   */
  async updateClientUserSettings(settings: ClientUserSettingsUpdateRequest): Promise<ClientUserSettingsApiResponse> {
     console.log('[UserSettings API] Aktualizacja ustawień:', settings);
    try {
      // Użyj api.put lub api.patch zgodnie z Twoim API
      const response = await api.put<ClientUserSettingsApiResponse>('/api/users/me/settings/', settings, true);
      console.log('[UserSettings API] Zaktualizowano ustawienia:', response);
      return response;
    } catch (error) {
      console.error('[UserSettings API] Błąd aktualizacji ustawień:', error);
      throw error;
    }
  },

  /**
   * Updates a single setting
   */
  async updateSetting<K extends keyof ClientUserSettingsUpdateRequest>(
    key: K,
    value: ClientUserSettingsUpdateRequest[K]
  ): Promise<ClientUserSettingsApiResponse> {
    console.log(`[UserSettings API] Aktualizacja ustawienia ${key} na ${value}`);
    const updateData = { [key]: value } as ClientUserSettingsUpdateRequest;
    // Wywołaj główną metodę aktualizacji z tego obiektu
    return this.updateClientUserSettings(updateData);
  }
};

export default clientUserSettingsApi; // Eksportuj obiekt singletona