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
      
      // Define the correct API endpoint
      const endpoint = 'api/recipes/from-pdf/';
      console.log('Sending PDF to endpoint:', endpoint);
      
      // Send the PDF using the API module
      const response = await api.post<PDFUploadResponse>(
        endpoint,
        formData,
        true // authenticated
      );
      
      console.log('PDF upload response:', response);
      return response;
    } catch (error) {
      console.error('PDF upload error:', error);
      throw error;
    }
  }
};

export default pdfUploadApi;
export { pdfUploadApi }; 