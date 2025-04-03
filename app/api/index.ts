import api from './api';
import AuthApi from './auth';
import webImportRecipeApi from './webImportRecipe';
import scanRecipeApi from './scanRecipe';
import { pdfUploadApi } from './pdfUpload';
import textImportRecipeApi from './textImportRecipe';

export { 
  AuthApi, 
  webImportRecipeApi, 
  scanRecipeApi,
  pdfUploadApi,
  textImportRecipeApi
};

export default api; 