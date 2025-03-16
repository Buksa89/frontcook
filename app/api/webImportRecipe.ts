import api from './api';

/**
 * Interface for the response from the recipe web import API
 */
export interface WebImportRecipeResponse {
  status: string;
  task_id: string;
  message: string;
}

/**
 * Web recipe import API functions
 */
const webImportRecipeApi = {
  /**
   * Import a recipe from a URL
   * @param url The URL of the recipe to import
   * @returns A promise that resolves to the import response
   */
  importFromUrl: async (url: string): Promise<WebImportRecipeResponse> => {
    return api.post<WebImportRecipeResponse>(
      'api/recipes/from-url/',
      { url },
      true // authenticated request
    );
  },
};

export default webImportRecipeApi; 