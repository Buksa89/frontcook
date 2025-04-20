// src/api/textImportRecipe.ts
import api from './api';

export interface TextImportRecipeResponse {
  status: string;
  task_id: string;
  message: string;
}

const textImportRecipeApi = { // Zmieniono na obiekt literalny
  /**
   * Import a recipe from plain text
   */
  async importFromText(text: string): Promise<TextImportRecipeResponse> { // Metoda asynchroniczna
    console.log('[TextImport API] Importowanie przepisu z tekstu...');
    try {
      // Użyj api.post, zakładając autoryzację (true)
      const response = await api.post<TextImportRecipeResponse>('/api/recipes/from-text/', { text }, true);
      console.log('[TextImport API] Import z tekstu zakończony sukcesem:', response);
      return response;
    } catch (error) {
      console.error('[TextImport API] Błąd importu przepisu z tekstu:', error);
      throw error;
    }
  },
};

export default textImportRecipeApi; // Eksportuj obiekt singletona