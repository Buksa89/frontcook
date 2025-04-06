import api from './api';
import authService from '../services/auth';

// Base interface for all syncable items
export interface BaseSyncItem {
  sync_status: string;
  last_update: number; // Liczba milisekund od 1970-01-01 (timestamp z milisekundową precyzją)
  is_deleted: boolean;
  sync_id: string;
  owner: string | null;
}

export interface ShoppingItemSync extends BaseSyncItem {
  object_type: 'shopping_item';
  name: string;
  amount: string | number;
  unit: string | null;
  type: string | null;
  order: number;
  is_checked: boolean;
}

export interface RecipeSync extends BaseSyncItem {
  object_type: 'recipe';
  name: string;
  description: string | null;
  image: string | null;
  rating: number | null;
  is_approved: boolean;
  prep_time: number | null;
  total_time: number | null;
  servings: number | null;
  instructions: string;
  notes: string | null;
  nutrition: string | null;
  video: string | null;
  source: string | null;
}

export interface IngredientSync extends BaseSyncItem {
  object_type: 'ingredient';
  name: string;
  amount: number | null;
  unit: string | null;
  type: string | null;
  order: number;
  recipe: string;
  original_str: string;
}

export interface TagSync extends BaseSyncItem {
  object_type: 'tag';
  name: string;
  order: number;
}

export interface RecipeTagSync extends BaseSyncItem {
  object_type: 'recipe_tag';
  recipe: string;  // This is sync_id of the recipe
  tag: string;     // This is sync_id of the tag
}

export interface UserSettingsSync extends BaseSyncItem {
  object_type: 'user_settings';
  language: string;
}

export interface AppDataSync extends BaseSyncItem {
  object_type: 'app_data';
  subscription_end?: number | null; // Zmienione na number, ponieważ to też timestamp
  csv_lock?: number | null; // Zmienione na number, ponieważ to też timestamp
}

export interface RecipeImageSync extends BaseSyncItem {
  object_type: 'recipe_image';
  image: string | null;
  thumbnail: string | null;
  recipe_sync_id: string; // Referencja do syncId przepisu, do którego należy obraz
}

export type SyncItemType = ShoppingItemSync | RecipeSync | IngredientSync | TagSync | RecipeTagSync | UserSettingsSync | AppDataSync | RecipeImageSync;

export interface SyncRequest {
  shopping_items?: ShoppingItemSync[];
  recipes?: RecipeSync[];
  ingredients?: IngredientSync[];
  tags?: TagSync[];
  recipe_tags?: RecipeTagSync[];
  user_settings?: UserSettingsSync[];
  recipe_images?: RecipeImageSync[];
}

export interface SyncResponse {
  shopping_items?: ShoppingItemSync[];
  recipes?: RecipeSync[];
  ingredients?: IngredientSync[];
  tags?: TagSync[];
  recipe_tags?: RecipeTagSync[];
  user_settings?: UserSettingsSync[];
  app_data?: AppDataSync[];
  recipe_images?: RecipeImageSync[];
}

// Przyjmuje tylko obiekt Date
export const getChanges = async (lastSync: Date, batchSize: number = 20): Promise<SyncResponse> => {
  // Konwertuj Date na timestamp (liczba milisekund od 1970-01-01) dla API
  const lastSyncTimestamp = lastSync.getTime();
  
  // console.log('[Sync API] Fetching changes since timestamp:', lastSyncTimestamp, 'with batch size:', batchSize);
  
  // Prepare the payload for the API call
  const payload = {
    lastSync: lastSyncTimestamp,
    limit: batchSize,
  };

  // Call the API to get updated data from the server
  const response = await api.post<SyncResponse>('/api/sync/pull/', payload, true);
  
  // Just log that we received changes without printing the response
  // console.log('[Sync API] Received changes');
  
  return response;
};

// Add push method using existing interface types
export const pushChanges = async (changes: SyncItemType[]): Promise<SyncItemType[]> => {
  console.log('[Sync API] Pushing changes to server');
  
  // Get authentication data for the API call
  const authData = await authService.getAuthData();
  
  // Add authentication token to headers
  const headers = {
    'Authorization': `Bearer ${authData.accessToken}`
  };

  // Call the API to push data to the server
  const response = await api.post<SyncItemType[]>('/api/sync/push/', changes, true, headers);
  
  console.log('[Sync API] Push completed');
  
  return response;
};

// Add default export for Expo Router compatibility
export default {
  getChanges,
  pushChanges
}; 