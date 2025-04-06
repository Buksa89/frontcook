import { Q } from '@nozbe/watermelondb';
import database from '../../../database';
import { Model } from '@nozbe/watermelondb';
import { AppState, AppStateStatus, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import api from '../../api/api';
import SyncModel from '../../../database/models/SyncModel';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import RecipeTag from '../../../database/models/RecipeTag';
import Ingredient from '../../../database/models/Ingredient';
import ShoppingItem from '../../../database/models/ShoppingItem';
import UserSettings from '../../../database/models/UserSettings';
import Notification from '../../../database/models/Notification';
import AppData from '../../../database/models/AppData';
import pullSynchronization from './pullSynchronization';
import pushSynchronization from './pushSynchronization';
import AuthService from '../auth/authService';
import RecipeImage from '../../../database/models/RecipeImage';



const BATCH_SIZE = 20;
const SYNC_INTERVAL = 10000; // Changed to 10 seconds as requested

type TableName = 'shopping_items' | 'recipes' | 'ingredients' | 'tags' | 'user_settings' | 'recipe_tags' | 'notifications' | 'recipe_images';

// Map of object types to model classes
const MODEL_CLASSES = {
  'recipe': Recipe,
  'tag': Tag,
  'recipe_tag': RecipeTag,
  'ingredient': Ingredient,
  'shopping_item': ShoppingItem,
  'user_settings': UserSettings,
  'notification': Notification,
  'recipe_image': RecipeImage
};

class SyncService {
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;

  startBackgroundSync(): void {
    console.log('[SyncService] Starting background sync');
    // If there's already a sync timer running, don't start another one
    if (this.syncTimer) {
      return;
    }
    
    // Start the periodic synchronization
    this.syncTimer = setInterval(async () => {
      // Prevent multiple synchronizations running simultaneously
      if (this.isSyncing) {
        return;
      }

      try {
        this.isSyncing = true;
        await this.synchronizeData();
      } catch (error) {
        console.error('[SyncService] Sync error:', error);
      } finally {
        this.isSyncing = false;
      }
    }, SYNC_INTERVAL);
  }

  stopBackgroundSync(): void {
    console.log('[SyncService] Stopping background sync');
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  async synchronizeData(): Promise<void> {
    try {
      // Get the active user
      const activeUser = await AuthService.getActiveUser();
      
      if (!activeUser) {
        console.log('[SyncService] No active user found, skipping synchronization');
        return;
      }
      
      // Get the last sync timestamp for the user
      const lastSync = await AppData.getLastSync(database);
      
      // Execute pull synchronization with user and lastSync
      await pullSynchronization(activeUser, lastSync);
      
      // Execute push synchronization directly using the imported function
      await pushSynchronization(activeUser);
      
      // We're not updating the last sync timestamp yet
      // await AppData.updateLastSync(database, new Date());
      
    } catch (error) {
      console.error('[SyncService] Sync error:', error);
      throw error;
    }
  }
}

export default new SyncService();
