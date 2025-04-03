import api from './api';

export interface AppListResponse {
  [key: string]: string;  // Format: 'app-slug': 'App Name'
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

const ninjaAppsApi = {
  /**
   * Fetches the list of available external apps for recipe import
   */
  getAppList: async (): Promise<AppListResponse> => {
    console.log('[NinjaApps API] Fetching app list from endpoint: api/ninja/apps/');
    try {
      const response = await api.get<AppListResponse>('api/ninja/apps/');
      console.log('[NinjaApps API] Successfully fetched app list');
      console.log(response);
      return response;
    } catch (error) {
      console.error('[NinjaApps API] Error fetching app list:', error);
      throw error;
    }
  },

  /**
   * Imports recipes from an external app file
   * @param appId The ID of the app to import from
   * @param fileUri The URI of the file to upload
   * @param fileName Optional filename to use
   */
  importFromApp: async (appId: string, fileUri: string, fileName?: string): Promise<NinjaImportResponse> => {
    console.log(`[NinjaApps API] Importing file from app: ${appId}, filename: ${fileName || 'unknown'}`);
    
    try {
      const formData = new FormData();
      formData.append('app', appId);
      
      // Add the file
      formData.append('file', {
        uri: fileUri,
        name: fileName || 'import.file',
        type: 'application/octet-stream',
      } as any);

      console.log('[NinjaApps API] Sending request to endpoint: api/ninja/import/');
      const response = await api.post<NinjaImportResponse>('api/ninja/import/', formData);
      console.log('[NinjaApps API] File import successful');
      return response;
    } catch (error) {
      console.error('[NinjaApps API] Error importing file:', error);
      throw error;
    }
  }
};

export default ninjaAppsApi; 