// src/api/index.ts

import api from './api'; // Główny klient API
import authApi from './auth'; // API Autoryzacji
import webImportRecipeApi from './webImportRecipe';
import scanRecipeApi from './scanRecipe';
import syncApiFunctions from './sync'; // Funkcje pull/push dla WDB sync
import textImportRecipeApi from './textImportRecipe';
import pdfUploadApi from './pdfUpload';
import ninjaAppsApi from './ninjaApps';
import recipeImageApi from './recipeImage';
import clientUserSettingsApi from './userSettings'; // Poprzednio userSettings.ts

// Eksportuj wszystkie instancje/obiekty API
export {
  api, // Główny klient
  authApi,
  webImportRecipeApi,
  scanRecipeApi,
  syncApiFunctions, // Eksportuj obiekt z funkcjami pull/push
  textImportRecipeApi,
  pdfUploadApi,
  ninjaAppsApi,
  recipeImageApi,
  clientUserSettingsApi, // Poprzednio ClientUserSettingsApi
};

// Domyślny eksport głównego klienta API (jeśli jest taka konwencja)
export default api;