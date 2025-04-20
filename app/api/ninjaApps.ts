// src/api/ninjaApps.ts
import api from './api';

export interface AppListResponse {
  [key: string]: string;
}

export interface NinjaImportResponse {
  status: string;
  message: string;
  task_id?: string;
  app_id: string;
  app_name: string;
  file_name: string;
  file_type: string;
  file_size: number;
}

const ninjaAppsApi = { // Zmieniono na obiekt literalny
  /**
   * Fetches the list of available external apps for recipe import
   */
  async getAppList(): Promise<AppListResponse> { // Metoda asynchroniczna
    console.log('[NinjaApps API] Fetching app list...');
    try {
      // Użyj api.get, zakładając, że nie wymaga autoryzacji
      const response = await api.get<AppListResponse>('/api/ninja/apps/', false); // Zakładam brak autoryzacji
      console.log('[NinjaApps API] Successfully fetched app list');
      return response;
    } catch (error) {
      console.error('[NinjaApps API] Error fetching app list:', error);
      throw error;
    }
  },

  /**
   * Imports recipes from an external app file
   */
  async importFromApp(appId: string, fileUri: string, fileName?: string): Promise<NinjaImportResponse> { // Metoda asynchroniczna
    console.log(`[NinjaApps API] Importing file from app: ${appId}, filename: ${fileName || 'import.file'}`);
    try {
      const formData = new FormData();
      formData.append('app', appId);
      formData.append('file', {
        uri: fileUri,
        name: fileName || 'import.file',
        type: 'application/octet-stream', // Typ generyczny dla plików
      } as any);

      // Użyj api.post, zakładając, że wymaga autoryzacji (true)
      const response = await api.post<NinjaImportResponse>('/api/ninja/import/', formData, true);
      console.log('[NinjaApps API] File import successful response:', response);
      return response;
    } catch (error) {
      console.error('[NinjaApps API] Error importing file:', error);
      throw error;
    }
  }
};

export default ninjaAppsApi; // Eksportuj obiekt singletona