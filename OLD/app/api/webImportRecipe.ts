// src/api/webImportRecipe.ts
import api from './api';

export interface WebImportRecipeResponse {
  status: string;
  task_id: string;
  message: string;
}

const webImportRecipeApi = { // Zmieniono na obiekt literalny
  /**
   * Import a recipe from a URL
   */
  async importFromUrl(url: string): Promise<WebImportRecipeResponse> { // Metoda asynchroniczna
    console.log('[WebImport API] Importowanie przepisu z URL:', url);
    try {
      // Użyj api.post, zakładając autoryzację (true)
      const response = await api.post<WebImportRecipeResponse>('/api/recipes/from-url/', { url }, true);
      console.log('[WebImport API] Import z URL zakończony sukcesem:', response);
      return response;
    } catch (error) {
      console.error('[WebImport API] Błąd importu przepisu z URL:', error);
      throw error;
    }
  },
};

export default webImportRecipeApi; // Eksportuj obiekt singletona