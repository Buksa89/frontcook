import api from './api';
import authService from '../services/auth';
import { API_URL } from '../constants/env';

/**
 * Interface for the response from the recipe image retrieve API
 */
export interface RecipeImageRetrieveResponse {
  image?: string;
  thumbnail?: string;
  status: string;
  message?: string;
}

/**
 * Recipe Image API functions
 */
const recipeImageApi = {
  /**
   * Retrieve image for a recipe by sync_id
   * @param syncId The sync_id of the recipe image to retrieve
   * @returns A promise that resolves to the image blob
   */
  retrieveImage: async (syncId: string): Promise<Blob> => {
    try {
      console.log(`[recipeImageApi.retrieveImage] Wywołanie dla syncId: ${syncId}`);
      
      // Define the correct API endpoint
      const endpoint = 'api/recipes/images/retrieve/';
      
      // Tworzymy pełny URL do API
      const baseUrl = API_URL;
      const url = `${baseUrl}${endpoint}`;
      
      // Pobieramy token dostępu z authService
      const { accessToken } = await authService.getAuthData();
      
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      // Wykonujemy bezpośrednie zapytanie fetch aby otrzymać plik
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ sync_id: syncId })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Pobranie pliku jako blob
      const blob = await response.blob();
      console.log(`[recipeImageApi.retrieveImage] Otrzymano plik obrazu dla syncId: ${syncId}, rozmiar: ${blob.size} bajtów`);
      
      return blob;
    } catch (error) {
      console.error('[recipeImageApi.retrieveImage] Error:', error);
      throw error; // Rzucamy błąd dalej, aby obsłużyć go w RecipeImage
    }
  }
};

export default recipeImageApi;
export { recipeImageApi }; 