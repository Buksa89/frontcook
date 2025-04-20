// src/api/recipeImage.ts
import api from './api';
import authService from '../services/auth/authService'; // Potrzebny do pobrania tokenu dla fetch
import { API_URL } from '../constants/env'; // Potrzebny do pełnego URL dla fetch

// Usunięto interfejs, bo metoda zwraca Blob

const recipeImageApi = { // Zmieniono na obiekt literalny
  /**
   * Retrieve image for a recipe by recipe ID (zmieniono z syncId na recipeId)
   * @param recipeId The ID of the recipe whose image to retrieve
   * @returns A promise that resolves to the image blob
   */
  async retrieveImage(recipeId: string): Promise<Blob> { // Zmieniono argument na recipeId
    console.log(`[RecipeImage API] Pobieranie obrazka dla przepisu ID: ${recipeId}`);
    try {
      // Endpoint powinien prawdopodobnie przyjmować ID przepisu
      const endpoint = `/api/recipes/${recipeId}/image/retrieve/`; // Przykładowy endpoint - DOSTOSUJ
      const url = `${API_URL.endsWith('/') ? API_URL : API_URL + '/'}${endpoint.startsWith('/') ? endpoint.substring(1) : endpoint}`; // Zbuduj pełny URL

      const accessToken = await authService.getAccessToken();
      if (!accessToken) {
        throw new Error('Brak tokenu dostępu do pobrania obrazka.');
      }

      // Używamy fetch bezpośrednio, bo api.post może oczekiwać JSON
      // Metoda GET jest bardziej odpowiednia do pobierania zasobu
      const response = await fetch(url, {
        method: 'GET', // Użyj GET do pobrania obrazka
        headers: {
          // 'Accept': 'image/*', // Opcjonalnie, jeśli serwer to respektuje
          'Authorization': `Bearer ${accessToken}`
        },
        // Usunięto body - GET nie ma ciała
      });

      if (!response.ok) {
         const errorText = await response.text().catch(() => 'Nie można odczytać błędu.');
         console.error(`[RecipeImage API] Błąd HTTP pobierania obrazka (${response.status}): ${errorText}`);
        throw new Error(`Błąd HTTP ${response.status} podczas pobierania obrazka.`);
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
           console.warn(`[RecipeImage API] Otrzymano pusty blob dla przepisu ID: ${recipeId}`);
           throw new Error('Otrzymano pustą odpowiedź obrazka z serwera.');
      }

      console.log(`[RecipeImage API] Otrzymano blob obrazka dla przepisu ID: ${recipeId}, rozmiar: ${blob.size}`);
      return blob;

    } catch (error) {
      console.error(`[RecipeImage API] Błąd podczas pobierania obrazka dla przepisu ID ${recipeId}:`, error);
      throw error;
    }
  }
};

export default recipeImageApi; // Eksportuj obiekt singletona
// Usunięto podwójny eksport