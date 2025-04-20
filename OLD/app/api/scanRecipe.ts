// src/api/scanRecipe.ts
import api from './api';
import authService from '../services/auth/authService'; // Potrzebny do pobrania tokenu dla fetch
import { API_URL } from '../constants/env'; // Potrzebny do pełnego URL dla fetch

export interface ScanRecipeResponse {
  status: string;
  task_id: string;
  message: string;
}

const scanRecipeApi = { // Zmieniono na obiekt literalny
  /**
   * Scan a recipe from a screenshot
   */
  async scanFromImage(imageUri: string): Promise<ScanRecipeResponse> { // Metoda asynchroniczna
    console.log('[ScanRecipe API] Skanowanie obrazka z URI:', imageUri);
    try {
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'screenshot.jpg';
      formData.append('screenshot', {
        uri: imageUri,
        type: 'image/jpeg', // Załóżmy JPEG, dostosuj w razie potrzeby
        name: filename,
      } as any);

      // Endpoint API (użyj ścieżki, ApiClient doda bazę)
      const endpoint = '/api/recipes/from-screenshot/'; // Poprawiona ścieżka
      console.log('[ScanRecipe API] Wysyłanie żądania do:', endpoint);

      // Użyj api.post, które samo obsłuży FormData i autoryzację
      const data = await api.post<ScanRecipeResponse>(endpoint, formData, true);

      console.log('[ScanRecipe API] Skanowanie zakończone sukcesem:', data);
      return data;
    } catch (error) {
      console.error('[ScanRecipe API] Błąd skanowania przepisu:', error);
      throw error;
    }
  },
};

export default scanRecipeApi; // Eksportuj obiekt singletona
// Usunięto podwójny eksport