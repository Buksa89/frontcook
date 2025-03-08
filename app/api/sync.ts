import api from './api';
import authService from '../services/auth';

// Base interface for all syncable items
export interface BaseSyncItem {
  sync_status: string;
  last_update: string;
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
  recipe_id: string;
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
  auto_translate_recipes: boolean;
  allow_friends_views_recipes: boolean;
}

export type SyncItemType = ShoppingItemSync | RecipeSync | IngredientSync | TagSync | RecipeTagSync | UserSettingsSync;

export interface SyncRequest {
  shopping_items?: ShoppingItemSync[];
  recipes?: RecipeSync[];
  ingredients?: IngredientSync[];
  tags?: TagSync[];
  recipe_tags?: RecipeTagSync[];
  user_settings?: UserSettingsSync[];
}

export interface SyncResponse {
  shopping_items?: ShoppingItemSync[];
  recipes?: RecipeSync[];
  ingredients?: IngredientSync[];
  tags?: TagSync[];
  recipe_tags?: RecipeTagSync[];
  user_settings?: UserSettingsSync[];
}

export const syncData = async (data: SyncRequest): Promise<SyncResponse> => {
  // Pobierz tokeny
  const { accessToken } = await authService.getTokens();
  
  // Dodaj token do nagłówków
  const headers = {
    'Authorization': `Bearer ${accessToken}`
  };

  return api.post<SyncResponse>('/api/sync', data, true, headers);
};

export const getChanges = async (lastSync: string): Promise<SyncResponse> => {
  // Zakoduj timestamp w URL
  const encodedLastSync = encodeURIComponent(lastSync);
  
  console.log('[Sync API] Fetching changes since:', lastSync);
  const response = await api.get<SyncResponse>(`/api/sync/changes/?last_sync=${encodedLastSync}`, true);
  console.log('[Sync API] Received changes:', response);
  
  return response;
}; 