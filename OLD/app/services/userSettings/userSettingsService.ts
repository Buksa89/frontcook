// src/services/userSettings/userSettingsService.ts

import api from '../../api/api'; // Upewnij się, że ścieżka jest poprawna

// Interface for user settings from API
export interface ClientUserSettingsApiResponse {
  auto_translate_recipes: boolean;
  // Dodaj inne pola, jeśli API je zwraca/przyjmuje
}

// Interface for updating user settings
export interface ClientUserSettingsUpdateRequest {
  auto_translate_recipes?: boolean;
  // Dodaj inne pola
}

/**
 * Klasa obsługująca ustawienia użytkownika pobierane/wysyłane do API
 */
class ClientUserSettingsService { // Nazwa klasy (PascalCase)
  /**
   * Fetches user settings from the API
   * @returns User settings object
   */
  async getClientUserSettings(): Promise<ClientUserSettingsApiResponse> {
    try {
      // Zakładamy, że endpoint '/api/users/me/settings/' jest poprawny
      return await api.get<ClientUserSettingsApiResponse>('/api/users/me/settings/', true);
    } catch (error) {
      console.error('[ClientUserSettingsService] Błąd podczas pobierania ustawień użytkownika z API:', error);
      // Rzuć błąd dalej, aby można było go obsłużyć wyżej
      throw error;
    }
  }

  /**
   * Updates user settings via API
   * @param settings Settings to update
   * @returns Updated user settings
   */
  async updateClientUserSettings(settings: ClientUserSettingsUpdateRequest): Promise<ClientUserSettingsApiResponse> {
    try {
      // Używamy PUT lub PATCH - dostosuj metodę do swojego API
      // Jeśli API używa PATCH do częściowej aktualizacji:
      // return await api.patch<ClientUserSettingsApiResponse>('/api/users/me/settings/', settings, true);
      // Jeśli API używa PUT do pełnej aktualizacji (nadpisania):
      return await api.put<ClientUserSettingsApiResponse>('/api/users/me/settings/', settings, true);
    } catch (error) {
      console.error('[ClientUserSettingsService] Błąd podczas aktualizacji ustawień użytkownika w API:', error);
      throw error;
    }
  }

  /**
   * Updates a single setting
   * @param key Setting key
   * @param value Setting value
   * @returns Updated user settings
   */
  async updateSetting<K extends keyof ClientUserSettingsUpdateRequest>(
    key: K,
    value: ClientUserSettingsUpdateRequest[K]
  ): Promise<ClientUserSettingsApiResponse> {
    // Tworzy obiekt z tylko jedną parą klucz-wartość
    const updateData = { [key]: value } as ClientUserSettingsUpdateRequest;
    // Wywołuje główną metodę aktualizacji
    return this.updateClientUserSettings(updateData);
  }
}

// --- POPRAWKA ---
// Eksportuj instancję singletona z inną nazwą (camelCase)
const clientUserSettingsService = new ClientUserSettingsService(); // Użyj camelCase dla instancji
export default clientUserSettingsService; // Eksportuj instancję
// --- KONIEC POPRAWKI ---

// Opcjonalnie, jeśli potrzebujesz też wyeksportować samą klasę (np. do testów):
// export { ClientUserSettingsService as ClientUserSettingsServiceClass };