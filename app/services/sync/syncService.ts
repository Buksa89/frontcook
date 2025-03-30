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
import { SubscriptionApi } from '../../api/subscription';
import pullSynchronization from './pullSynchronization';
import AuthService from '../auth/authService';



const BATCH_SIZE = 20;
const SYNC_INTERVAL = 10000; // Changed to 10 seconds as requested

type TableName = 'shopping_items' | 'recipes' | 'ingredients' | 'tags' | 'user_settings' | 'recipe_tags' | 'notifications';

// Map of object types to model classes
const MODEL_CLASSES = {
  'recipe': Recipe,
  'tag': Tag,
  'recipe_tag': RecipeTag,
  'ingredient': Ingredient,
  'shopping_item': ShoppingItem,
  'user_settings': UserSettings,
  'notification': Notification
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
      await pullSynchronization(activeUser, lastSync.toISOString());
      
      // Execute push synchronization
      await this.pushSynchronization();
      
      // We're not updating the last sync timestamp yet
      // await AppData.updateLastSync(database, activeUser, new Date().toISOString());
      
    } catch (error) {
      console.error('[SyncService] Sync error:', error);
      throw error;
    }
  }

  /**
   * Push local changes to the server
   */
  private async pushSynchronization(): Promise<void> {
    console.log('[SyncService] Push synchronization started');
    // Empty method for now - will push local changes to the server
    return Promise.resolve();
  }
}

export default new SyncService();
