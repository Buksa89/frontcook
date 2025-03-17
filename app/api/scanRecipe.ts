import api from './api';
import authService from '../services/auth';

/**
 * Interface for the response from the recipe scan API
 */
export interface ScanRecipeResponse {
  status: string;
  task_id: string;
  message: string;
}

/**
 * Recipe scanning API functions
 */
const scanRecipeApi = {
  /**
   * Scan a recipe from a screenshot
   * @param imageUri The URI of the screenshot to scan
   * @returns A promise that resolves to the scan response
   */
  scanFromImage: async (imageUri: string): Promise<ScanRecipeResponse> => {
    try {
      // Create a FormData object to send the image
      const formData = new FormData();
      
      // Get the filename from the URI
      const filename = imageUri.split('/').pop() || 'screenshot.jpg';
      
      // Log the image URI for debugging
      console.log('Image URI:', imageUri);
      
      // Append the image to the FormData with the correct format for React Native
      formData.append('screenshot', {
        uri: imageUri,
        type: 'image/jpeg',
        name: filename,
      } as any);
      
      // Get the auth token
      const { accessToken } = await authService.getAuthData();
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      // Make a direct fetch request
      const url = 'https://smartcook.addev.pl/api/recipes/from-screenshot/';
      console.log('Sending request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          // Do NOT set Content-Type header for FormData
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', response.status, errorText);
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      return data;
    } catch (error) {
      console.error('Scan recipe error:', error);
      throw error;
    }
  },
};

export default scanRecipeApi;
export { scanRecipeApi }; 