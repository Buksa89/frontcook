// src/api/pdfUpload.ts
import api from './api';
// Usunięto import authService - api samo zarządza tokenem

export interface PDFUploadResponse {
  status: string;
  task_id: string;
  message: string;
}

const pdfUploadApi = { // Zmieniono na obiekt literalny
  /**
   * Upload a PDF file containing recipes
   */
  async uploadPDF(pdfUri: string, fileName: string): Promise<PDFUploadResponse> { // Metoda asynchroniczna
    console.log('[PDF Upload API] Uploading PDF:', fileName, 'URI:', pdfUri);
    try {
      const formData = new FormData();
      formData.append('pdf_file', {
        uri: pdfUri,
        name: fileName,
        type: 'application/pdf',
      } as any);

      const endpoint = '/api/recipes/from-pdf/'; // Poprawiono ścieżkę
      console.log('[PDF Upload API] Sending PDF to endpoint:', endpoint);

      // Użyj api.post, zakładając autoryzację (true)
      const response = await api.post<PDFUploadResponse>(endpoint, formData, true);
      console.log('[PDF Upload API] PDF upload successful response:', response);
      return response;
    } catch (error) {
      console.error('[PDF Upload API] PDF upload error:', error);
      throw error;
    }
  }
};

export default pdfUploadApi; // Eksportuj obiekt singletona
// Usunięto podwójny eksport