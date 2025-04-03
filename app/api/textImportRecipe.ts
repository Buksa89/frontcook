import api from './api';

/**
 * Interface for the response from the recipe text import API
 */
export interface TextImportRecipeResponse {
  status: string;
  task_id: string;
  message: string;
}

/**
 * Text recipe import API functions
 */
const textImportRecipeApi = {
  /**
   * Import a recipe from plain text
   * @param text The plain text content of the recipe to import
   * @returns A promise that resolves to the import response
   */
  importFromText: async (text: string): Promise<TextImportRecipeResponse> => {
    return api.post<TextImportRecipeResponse>(
      'api/recipes/from-text/',
      { text },
      true // authenticated request
    );
  },
};

export default textImportRecipeApi; 