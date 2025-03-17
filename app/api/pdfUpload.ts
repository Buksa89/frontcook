import api from './api';
import authService from '../services/auth';

/**
 * Interface for the response from the PDF upload API
 */
export interface PDFUploadResponse {
  status: string;
  task_id: string;
  message: string;
}

/**
 * PDF upload API functions
 */
const pdfUploadApi = {
  /**
   * Upload a PDF file containing recipes
   * @param pdfUri The URI of the PDF file to upload
   * @param fileName The name of the PDF file
   * @returns A promise that resolves to the upload response
   */
  uploadPDF: async (pdfUri: string, fileName: string): Promise<PDFUploadResponse> => {
    try {
      // Create a FormData object to send the PDF
      const formData = new FormData();
      
      // Log the PDF URI for debugging
      console.log('PDF URI:', pdfUri);
      
      // Append the PDF to the FormData with the correct format for React Native
      formData.append('pdf_file', {
        uri: pdfUri,
        name: fileName,
        filename: fileName,
        type: 'application/pdf',
      } as any);
      
      try {
        // First attempt using the API module
        const endpoint = 'recipes/from-pdf/';
        console.log('Sending PDF to endpoint:', endpoint);
        
        const response = await api.post<PDFUploadResponse>(
          endpoint,
          formData,
          true // authenticated
        );
        
        console.log('PDF upload response:', response);
        return response;
      } catch (apiError) {
        console.warn('API module error, falling back to direct fetch:', apiError);
        
        // Fallback to direct fetch if API module fails
        return await pdfUploadApi.uploadPDFDirect(pdfUri, fileName);
      }
    } catch (error) {
      console.error('PDF upload error:', error);
      throw error;
    }
  },

  /**
   * Upload a PDF file using direct fetch approach
   * This is used as a fallback if the API module approach fails
   */
  uploadPDFDirect: async (pdfUri: string, fileName: string): Promise<PDFUploadResponse> => {
    try {
      // Create a FormData object to send the PDF
      const formData = new FormData();
      
      // Log the PDF URI for debugging
      console.log('Direct fetch - PDF URI:', pdfUri);
      
      // Append the PDF to the FormData with the correct format for React Native
      formData.append('pdf_file', {
        uri: pdfUri,
        name: fileName,
        filename: fileName,
        type: 'application/pdf',
      } as any);
      
      // Get the auth token
      const { accessToken } = await authService.getAuthData();
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      // Make a direct fetch request
      const url = 'https://smartcook.addev.pl/api/recipes/from-pdf/';
      console.log('Sending request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', response.status, errorText);
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Direct fetch response data:', data);
      return data;
    } catch (error) {
      console.error('Direct fetch PDF upload error:', error);
      throw error;
    }
  }
};

export default pdfUploadApi;
export { pdfUploadApi }; 