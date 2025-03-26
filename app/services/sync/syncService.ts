import { Q } from '@nozbe/watermelondb';
import database from '../../../database';
import { Model } from '@nozbe/watermelondb';
import { AppState, AppStateStatus, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import api from '../../api/api';
import BaseModel from '../../../database/models/BaseModel';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import RecipeTag from '../../../database/models/RecipeTag';
import Ingredient from '../../../database/models/Ingredient';
import ShoppingItem from '../../../database/models/ShoppingItem';
import UserSettings from '../../../database/models/UserSettings';
import Notification from '../../../database/models/Notification';
import UserData from '../../../database/models/UserData';
import { SubscriptionApi } from '../../api/subscription';

// Interface for the pull response items
interface PullResponseItem {
  object_type: 'recipe' | 'tag' | 'recipe_tag' | 'ingredient' | 'shopping_item' | 'user_settings' | 'notification';
  sync_id: string;
  last_update: string;
  is_deleted: boolean;
  owner: string;
  [key: string]: any;
}

const BATCH_SIZE = 20;
const SYNC_INTERVAL = 30000; // 30 seconds
const MIN_SYNC_INTERVAL = 30 * 1000; // 30 seconds - minimalny czas między synchronizacjami
const IS_DEBUG = Constants.expoConfig?.extra?.isDebug || false;

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
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private lastSyncTime: number = 0;
  private pendingSync: boolean = false;
  private appStateSubscription: any = null;
  private netInfoSubscription: any = null;
  private IS_DEBUG = Constants.expoConfig?.extra?.isDebug || false;
  private accessTokenGetter: (() => Promise<string | null>) | null = null;
  private activeUserGetter: (() => Promise<string | null>) | null = null;

  constructor() {
    // Nasłuchuj zmian stanu aplikacji
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    
    // Nasłuchuj zmian stanu połączenia tylko w trybie produkcyjnym
    if (!IS_DEBUG) {
      this.netInfoSubscription = NetInfo.addEventListener(this.handleConnectivityChange);
    }
  }

  // New method to set access token getter
  setAccessTokenGetter(getter: () => Promise<string | null>) {
    this.accessTokenGetter = getter;
  }

  // New method to set active user getter
  setActiveUserGetter(getter: () => Promise<string | null>) {
    this.activeUserGetter = getter;
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active' && this.pendingSync) {
      const activeUser = await this.activeUserGetter?.();
      if (activeUser) {
        this.syncPendingRecords(activeUser);
      }
      this.pendingSync = false;
    }
  };

  private handleConnectivityChange = async (state: any) => {
    // Pomijamy sprawdzanie połączenia w trybie debug
    if (IS_DEBUG) return;

    if (state.isConnected && this.pendingSync) {
      const activeUser = await this.activeUserGetter?.();
      if (activeUser) {
        this.syncPendingRecords(activeUser);
      }
      this.pendingSync = false;
    }
  };

  // Sprawdza czy można wykonać synchronizację
  private async canSync(): Promise<boolean> {
    // Sprawdź czy minął minimalny czas od ostatniej synchronizacji
    const now = Date.now();
    if (now - this.lastSyncTime < MIN_SYNC_INTERVAL) {
      return false;
    }

    // W trybie debug pomijamy sprawdzanie połączenia
    if (!IS_DEBUG) {
      // Sprawdź stan połączenia
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        this.pendingSync = true;
        return false;
      }
    }

    // Sprawdź stan aplikacji
    if (Platform.OS !== 'web' && AppState.currentState !== 'active') {
      this.pendingSync = true;
      return false;
    }

    return true;
  }
  
  // Główna funkcja synchronizacji
  private async syncPendingRecords(owner: string): Promise<void> {
    if (this.isSyncing) {
      return;
    }

    // Sprawdź czy można wykonać synchronizację
    if (!(await this.canSync())) {
      return;
    }
    
    try {
      this.isSyncing = true;

      // Get active user for last sync operations
      const activeUser = await this.activeUserGetter?.();
      if (!activeUser) {
        console.error('[Sync Service] No active user found');
        return;
      }

      // Pobierz timestamp ostatniej synchronizacji
      const lastSync = await UserData.getLastSyncByUser(database, activeUser);
      console.log('[Sync Service] Last sync timestamp:', lastSync);

      // First push local changes to server
      await this.syncPush();

      // Then pull changes from server and get the most recent update timestamp
      const mostRecentUpdate = await this.syncPull(lastSync);

      // Only update the last sync time if both push and pull completed successfully
      // and we have a valid most recent update time
      if (mostRecentUpdate) {
        await UserData.updateLastSyncByUser(database, activeUser, mostRecentUpdate);
        this.lastSyncTime = Date.now();
      }
      
      // Update subscription status after successful sync
      await this.updateSubscriptionStatus(activeUser);
      
      console.log('[Sync Service] Sync process completed successfully');
    } catch (error) {
      console.error('[Sync Service] Sync failed:', error);
      // Don't update last sync time on failure
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncPull(initialLastSync: string): Promise<string | null> {
    let lastSync = initialLastSync;
    let hasMoreData = true;
    let mostRecentUpdate: string | null = null;

    // Get active user
    const activeUser = await this.activeUserGetter?.();
    if (!activeUser) {
      console.error('[Sync Service] No active user found');
      return null;
    }

    // Collection of objects that failed to sync and should be retried
    const objectsToRetry: { [key: string]: PullResponseItem[] } = {
      recipe: [],
      tag: [],
      ingredient: [],
      recipe_tag: [],
      shopping_item: [],
      user_settings: [],
      notification: []
    };

    console.log('[Sync Service] Starting pull phase...');

    while (hasMoreData) {
      try {
        const payload = {
          lastSync,
          limit: BATCH_SIZE
        };

        const data = await api.post<PullResponseItem[]>('/api/sync/pull/', payload, true);

        if (!Array.isArray(data)) {
          console.error('[Sync Service] Invalid response format:', data);
          hasMoreData = false;
          break;
        }

        if (data.length === 0) {
          console.log('[Sync Service] No more data to sync, stopping');
          hasMoreData = false;
          break;
        }

        // Log the received data for debugging
        console.log(`[Sync Service] Received ${data.length} items from server`);

        // Group server objects by object type
        const groupedObjects: { [key: string]: PullResponseItem[] } = {
          recipe: [],
          tag: [],
          ingredient: [],
          recipe_tag: [],
          shopping_item: [],
          user_settings: [],
          notification: []
        };

        // Update most recent update time and group objects
        for (const item of data) {
          // Update most recent update time if this item is newer
          if (!mostRecentUpdate || new Date(item.last_update) > new Date(mostRecentUpdate)) {
            mostRecentUpdate = item.last_update;
          }

          // Add to the appropriate group
          if (groupedObjects[item.object_type]) {
            groupedObjects[item.object_type].push(item);
          }
        }

        // Process each object type in the correct order
        const syncOrder = ['recipe', 'tag', 'ingredient', 'recipe_tag', 'shopping_item', 'user_settings', 'notification'];
        
        for (const objectType of syncOrder) {
          const objectsToSync = groupedObjects[objectType];
          if (objectsToSync.length === 0) continue;

          try {
            // Process each object type with the appropriate model class
            let result;
            
            switch (objectType) {
              case 'recipe':
                result = await (Recipe as any).pullSync(database, objectsToSync);
                break;
              case 'tag':
                result = await (Tag as any).pullSync(database, objectsToSync);
                break;
              case 'ingredient':
                try {
                  result = await (Ingredient as any).pullSync(database, objectsToSync);
                } catch (error) {
                  console.log(`[Sync Service] Collecting ingredients that failed to sync for retry`);
                  objectsToRetry[objectType].push(...objectsToSync);
                }
                break;
              case 'recipe_tag':
                try {
                  result = await (RecipeTag as any).pullSync(database, objectsToSync);
                } catch (error) {
                  console.log(`[Sync Service] Collecting recipe_tags that failed to sync for retry`);
                  objectsToRetry[objectType].push(...objectsToSync);
                }
                break;
              case 'shopping_item':
                try {
                  result = await (ShoppingItem as any).pullSync(database, objectsToSync);
                } catch (error) {
                  console.log(`[Sync Service] Collecting shopping_items that failed to sync for retry`);
                  objectsToRetry[objectType].push(...objectsToSync);
                }
                break;
              case 'user_settings':
                result = await (UserSettings as any).pullSync(database, objectsToSync);
                break;
              case 'notification':
                result = await (Notification as any).pullSync(database, objectsToSync);
                break;
            }
          } catch (error) {
            console.log(`[Sync Service] Object type ${objectType} will be retried later`);
            // Add failed objects to retry collection
            objectsToRetry[objectType].push(...objectsToSync);
          }
        }

        // Update lastSync for next iteration
        const batchMostRecent = data.reduce((latest, item) => {
          const itemDate = new Date(item.last_update).getTime();
          const latestDate = new Date(latest).getTime();
          return itemDate > latestDate ? item.last_update : latest;
        }, lastSync);

        if (batchMostRecent === lastSync) {
          hasMoreData = false;
          break;
        }

        lastSync = batchMostRecent;

      } catch (error) {
        console.error('[Sync Service] Error during sync:', error);
        hasMoreData = false;
        break;
      }
    }

    // Retry objects that failed to sync
    console.log('[Sync Service] Starting retry phase...');
    
    // We'll retry multiple times to handle dependencies between objects
    const MAX_RETRY_ATTEMPTS = 3;
    
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      const isLastAttempt = attempt === MAX_RETRY_ATTEMPTS - 1;
      console.log(`[Sync Service] Retry attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}`);
      
      // Count objects to retry
      const totalObjectsToRetry = Object.values(objectsToRetry).reduce(
        (sum, objects) => sum + objects.length, 0
      );
      
      if (totalObjectsToRetry === 0) {
        console.log('[Sync Service] No objects to retry, skipping retry phase');
        break;
      }
      
      console.log(`[Sync Service] Retrying ${totalObjectsToRetry} objects`);
      
      // Create a copy of the objects to retry
      const currentRetryBatch: { [key: string]: PullResponseItem[] } = {
        recipe: [...objectsToRetry.recipe],
        tag: [...objectsToRetry.tag],
        ingredient: [...objectsToRetry.ingredient],
        recipe_tag: [...objectsToRetry.recipe_tag],
        shopping_item: [...objectsToRetry.shopping_item],
        user_settings: [...objectsToRetry.user_settings],
        notification: [...objectsToRetry.notification]
      };
      
      // Clear the retry collection for this attempt
      Object.keys(objectsToRetry).forEach(key => {
        objectsToRetry[key] = [];
      });
      
      // Retry in the correct order
      const retryOrder = ['recipe', 'tag', 'ingredient', 'recipe_tag', 'shopping_item', 'user_settings', 'notification'];
      
      for (const objectType of retryOrder) {
        const objectsToProcess = currentRetryBatch[objectType];
        if (objectsToProcess.length === 0) continue;
        
        console.log(`[Sync Service] Retrying ${objectsToProcess.length} ${objectType} objects`);
        
        try {
          // Process each object type with the appropriate model class
          switch (objectType) {
            case 'recipe':
              await (Recipe as any).pullSync(database, objectsToProcess);
              break;
            case 'tag':
              await (Tag as any).pullSync(database, objectsToProcess);
              break;
            case 'ingredient':
              try {
                await (Ingredient as any).pullSync(database, objectsToProcess);
              } catch (error) {
                // If still failing, add back to retry collection
                objectsToRetry[objectType].push(...objectsToProcess);
                // Only log error on the last attempt
                if (isLastAttempt) {
                  console.error(`[Sync Service] Error processing ${objectType} objects after all retry attempts:`, error);
                }
              }
              break;
            case 'recipe_tag':
              try {
                await (RecipeTag as any).pullSync(database, objectsToProcess);
              } catch (error) {
                // If still failing, add back to retry collection
                objectsToRetry[objectType].push(...objectsToProcess);
                // Only log error on the last attempt
                if (isLastAttempt) {
                  console.error(`[Sync Service] Error processing ${objectType} objects after all retry attempts:`, error);
                }
              }
              break;
            case 'shopping_item':
              try {
                await (ShoppingItem as any).pullSync(database, objectsToProcess);
              } catch (error) {
                // If still failing, add back to retry collection
                objectsToRetry[objectType].push(...objectsToProcess);
                // Only log error on the last attempt
                if (isLastAttempt) {
                  console.error(`[Sync Service] Error processing ${objectType} objects after all retry attempts:`, error);
                }
              }
              break;
            case 'user_settings':
              await (UserSettings as any).pullSync(database, objectsToProcess);
              break;
            case 'notification':
              await (Notification as any).pullSync(database, objectsToProcess);
              break;
          }
        } catch (error) {
          // Add failed objects back to retry collection
          objectsToRetry[objectType].push(...objectsToProcess);
          // Only log error on the last attempt
          if (isLastAttempt) {
            console.error(`[Sync Service] Error processing ${objectType} objects after all retry attempts:`, error);
          } else {
            console.log(`[Sync Service] Will retry ${objectsToProcess.length} ${objectType} objects in next attempt`);
          }
        }
      }
    }
    
    // Log any objects that still failed after all retry attempts
    const remainingFailedObjects = Object.entries(objectsToRetry)
      .filter(([_, objects]) => objects.length > 0);
    
    if (remainingFailedObjects.length > 0) {
      console.log('[Sync Service] Some objects still failed to sync after all retry attempts:');
      remainingFailedObjects.forEach(([objectType, objects]) => {
        console.log(`- ${objectType}: ${objects.length} objects`);
        // Log the first few objects for debugging
        objects.slice(0, 3).forEach(obj => {
          console.log(`  - sync_id: ${obj.sync_id}, related to: ${(obj as any).recipe || (obj as any).tag || 'unknown'}`);
        });
      });
    } else {
      console.log('[Sync Service] All objects synced successfully after retries');
    }

    return mostRecentUpdate || lastSync;
  }

  private async getPendingRecordsForPush(table: TableName): Promise<BaseModel[]> {
    const activeUser = await this.activeUserGetter?.();
    if (!activeUser) {
      console.error('[Sync Service] No active user found');
      return [];
    }
    
    const records = await database.get(table).query(
      Q.and(
        Q.where('sync_status', 'pending'),
        Q.where('owner', activeUser)
      ),
      Q.sortBy('last_update', Q.asc)
    ).fetch() as BaseModel[];

    return records;
  }

  private async syncPush(): Promise<void> {
    try {
      // First check if we have a valid access token for API calls
      const accessToken = await this.accessTokenGetter?.();
      if (!accessToken) {
        console.error('[Sync Service] No access token available for API calls');
        return;
      }

      // Then get the active user for record ownership
      const activeUser = await this.activeUserGetter?.();
      if (!activeUser) {
        console.error('[Sync Service] No active user found');
        return;
      }

      // Kolejność synchronizacji
      const pushOrder: TableName[] = ['recipes', 'tags', 'ingredients', 'recipe_tags', 'shopping_items', 'user_settings', 'notifications'];
      
      // Kolekcja obiektów do wysłania wraz z informacją o tabeli
      const recordsToSync: { record: BaseModel, table: TableName }[] = [];

      console.log('[Sync Service] Starting push phase...');

      // Pobierz rekordy w odpowiedniej kolejności
      for (const table of pushOrder) {
        const records = await this.getPendingRecordsForPush(table);
        if (records.length > 0) {
          // Store records with their table information
          recordsToSync.push(...records.map(record => ({ record, table })));
        }
      }

      // Jeśli nie ma rekordów do synchronizacji, zakończ
      if (recordsToSync.length === 0) {
        console.log('[Sync Service] No pending records found to push');
        return;
      }

      console.log(`[Sync Service] Total records to sync: ${recordsToSync.length}`);

      // Sortuj rekordy po last_update w ramach każdego typu
      recordsToSync.sort((a, b) => {
        // Najpierw porównaj typ (kolejność z pushOrder)
        const orderDiff = pushOrder.indexOf(a.table) - pushOrder.indexOf(b.table);
        if (orderDiff !== 0) return orderDiff;
        
        // Jeśli ten sam typ, sortuj po last_update
        return new Date(a.record.lastUpdate || '').getTime() - new Date(b.record.lastUpdate || '').getTime();
      });

      // Uzupełnij brakujące pola recipe i tag dla Ingredient i RecipeTag
      await this.enrichRelationFields(recordsToSync);

      // Serializuj rekordy używając metody getSyncData
      const serializedRecords = recordsToSync.map(({ record, table }) => {
        const syncData = record.getSyncData();
        // Dodaj informację o typie obiektu do danych synchronizacji
        return {
          ...syncData,
          object_type: this.getObjectTypeFromTable(table)
        };
      });

      // Przygotuj payload jako tablicę
      const payload = serializedRecords;
      
      // Wyślij zmiany na serwer i odbierz zaktualizowane obiekty
      const response = await api.post<PullResponseItem[]>('/api/sync/push/', payload, true);

      // Zbierz sync_id rekordów zwróconych przez serwer (te, które wygrały konflikt)
      const returnedSyncIds = new Set(response.map(item => item.sync_id));

      // Group server objects by object type
      const groupedObjects: { [key: string]: PullResponseItem[] } = {
        recipe: [],
        tag: [],
        ingredient: [],
        recipe_tag: [],
        shopping_item: [],
        user_settings: [],
        notification: []
      };

      // Group objects by type
        for (const item of response) {
        if (groupedObjects[item.object_type]) {
          groupedObjects[item.object_type].push(item);
        }
      }

      // Process each object type in the correct order
      const syncOrder = ['recipe', 'tag', 'ingredient', 'recipe_tag', 'shopping_item', 'user_settings', 'notification'];
      
      for (const objectType of syncOrder) {
        const objectsToSync = groupedObjects[objectType];
        if (objectsToSync.length === 0) continue;

        try {
          // Process each object type with the appropriate model class
          switch (objectType) {
            case 'recipe':
              await (Recipe as any).pullSync(database, objectsToSync);
              break;
            case 'tag':
              await (Tag as any).pullSync(database, objectsToSync);
              break;
            case 'ingredient':
              await (Ingredient as any).pullSync(database, objectsToSync);
              break;
            case 'recipe_tag':
              await (RecipeTag as any).pullSync(database, objectsToSync);
              break;
            case 'shopping_item':
              await (ShoppingItem as any).pullSync(database, objectsToSync);
              break;
            case 'user_settings':
              await (UserSettings as any).pullSync(database, objectsToSync);
              break;
            case 'notification':
              await (Notification as any).pullSync(database, objectsToSync);
              break;
          }
        } catch (error) {
          console.error(`[Sync Service] Error processing ${objectType} objects from server response:`, error);
        }
      }

      // Oznacz jako zsynchronizowane te rekordy, które zostały wysłane, ale nie zostały zwrócone przez serwer
      // (czyli te, które serwer zaakceptował)
      await database.write(async () => {
        // Collect all update operations
        const updateOperations = [];
        
        for (const { record } of recordsToSync) {
          // Jeśli rekord nie został zwrócony przez serwer, oznacz go jako zsynchronizowany
          if (!returnedSyncIds.has(record.syncId)) {
            try {
              // Use prepareUpdate instead of calling markAsSynced directly
              updateOperations.push(
                record.prepareUpdate(rec => {
                  rec.syncStatusField = 'synced';
                  // Don't update lastUpdate, keep the existing value
                })
              );
            } catch (error) {
              console.error(`[Sync Service] Error preparing update for record ${record.id}:`, error);
            }
          }
        }
        
        // Execute all update operations in a single batch
        if (updateOperations.length > 0) {
          await database.batch(...updateOperations);
        }
      });

      console.log('[Sync Service] Successfully pushed changes to server');
    } catch (error) {
      console.error('[Sync Service] Push sync failed:', error);
      throw error;
    }
  }

  // Metoda do uzupełniania brakujących pól recipe i tag dla Ingredient i RecipeTag
  private async enrichRelationFields(recordsToSync: { record: BaseModel, table: TableName }[]): Promise<void> {
    // Znajdź wszystkie Ingredient i RecipeTag rekordy
    const ingredients = recordsToSync.filter(({ table }) => table === 'ingredients');
    const recipeTags = recordsToSync.filter(({ table }) => table === 'recipe_tags');
    
    if (ingredients.length === 0 && recipeTags.length === 0) {
      return; // Nie ma nic do uzupełnienia
    }
    
    console.log(`[Sync Service] Enriching relation fields for ${ingredients.length} ingredients and ${recipeTags.length} recipe_tags`);
    
    // Uzupełnij pola recipe dla Ingredient
    for (const { record } of ingredients) {
      const ingredient = record as any; // Używamy any, aby uniknąć problemów z typami
      
      // Jeśli ingredient ma recipeId, ale nie ma recipe.syncId
      if (ingredient.recipeId && (!ingredient.recipe || !ingredient.recipe.syncId)) {
        try {
          // Znajdź przepis po ID
          const recipe = await database.get<Recipe>('recipes').find(ingredient.recipeId);
          if (recipe) {
            // Ustaw pole recipe w getSyncData
            console.log(`[Sync Service] Found recipe with syncId ${recipe.syncId} for ingredient ${ingredient.id}`);
            // Przypisujemy bezpośrednio do obiektu, aby getSyncData mogło z tego skorzystać
            ingredient._recipe = recipe;
          } else {
            console.log(`[Sync Service] Recipe with id ${ingredient.recipeId} for ingredient ${ingredient.id} not found yet, will be handled during retry`);
          }
        } catch (error) {
          console.log(`[Sync Service] Error finding recipe for ingredient ${ingredient.id}, will be handled during retry`);
        }
      }
    }
    
    // Uzupełnij pola recipe i tag dla RecipeTag
    for (const { record } of recipeTags) {
      const recipeTag = record as any; // Używamy any, aby uniknąć problemów z typami
      
      // Jeśli recipeTag ma recipeId, ale nie ma recipe.syncId
      if (recipeTag.recipeId && (!recipeTag.recipe || !recipeTag.recipe.syncId)) {
        try {
          // Znajdź przepis po ID
          const recipe = await database.get<Recipe>('recipes').find(recipeTag.recipeId);
          if (recipe) {
            // Ustaw pole recipe w getSyncData
            console.log(`[Sync Service] Found recipe with syncId ${recipe.syncId} for recipeTag ${recipeTag.id}`);
            // Przypisujemy bezpośrednio do obiektu, aby getSyncData mogło z tego skorzystać
            recipeTag._recipe = recipe;
          } else {
            console.log(`[Sync Service] Recipe with id ${recipeTag.recipeId} for recipeTag ${recipeTag.id} not found yet, will be handled during retry`);
          }
        } catch (error) {
          console.log(`[Sync Service] Error finding recipe for recipeTag ${recipeTag.id}, will be handled during retry`);
        }
      }
      
      // Jeśli recipeTag ma tagId, ale nie ma tag.syncId
      if (recipeTag.tagId && (!recipeTag.tag || !recipeTag.tag.syncId)) {
        try {
          // Znajdź tag po ID
          const tag = await database.get<Tag>('tags').find(recipeTag.tagId);
          if (tag) {
            // Ustaw pole tag w getSyncData
            console.log(`[Sync Service] Found tag with syncId ${tag.syncId} for recipeTag ${recipeTag.id}`);
            // Przypisujemy bezpośrednio do obiektu, aby getSyncData mogło z tego skorzystać
            recipeTag._tag = tag;
          } else {
            console.log(`[Sync Service] Tag with id ${recipeTag.tagId} for recipeTag ${recipeTag.id} not found yet, will be handled during retry`);
          }
        } catch (error) {
          console.log(`[Sync Service] Error finding tag for recipeTag ${recipeTag.id}, will be handled during retry`);
        }
      }
    }
  }

  // Helper method to get object type from table name
  private getObjectTypeFromTable(tableName: string): string {
    // Remove trailing 's' from table name to get object type
    // e.g. 'recipes' -> 'recipe', 'tags' -> 'tag'
    // Special case for 'recipe_tags' which should be 'recipe_tag'
    if (tableName === 'recipe_tags') {
      return 'recipe_tag';
    }
    
    // Special case for 'user_settings' which should be 'user_settings' (pozostaje w liczbie mnogiej)
    if (tableName === 'user_settings') {
      return 'user_settings';
    }
    
    // Special case for 'shopping_items' which should be 'shopping_item'
    if (tableName === 'shopping_items') {
      return 'shopping_item';
    }
    
    // Special case for 'notifications' which should be 'notification'
    if (tableName === 'notifications') {
      return 'notification';
    }
    
    // Remove trailing 's' for other tables
    return tableName.endsWith('s') ? tableName.slice(0, -1) : tableName;
  }

  // Helper method to get table name from object type
  private getTableName(objectType: string): TableName {
    switch (objectType) {
      case 'recipe':
        return 'recipes';
      case 'tag':
        return 'tags';
      case 'ingredient':
        return 'ingredients';
      case 'shopping_item':
        return 'shopping_items';
      case 'user_settings':
        return 'user_settings';
      case 'recipe_tag':
        return 'recipe_tags';
      case 'notification':
        return 'notifications';
      default:
        throw new Error(`Unknown object type: ${objectType}`);
    }
  }

  // Sprawdź czy mamy ważne tokeny przed synchronizacją
  private async hasValidTokens(): Promise<boolean> {
    try {
      if (!this.accessTokenGetter) {
        console.error('[Sync Service] No access token getter set');
        return false;
      }
      const accessToken = await this.accessTokenGetter();
      console.log('[Sync Service] Token check result:', !!accessToken);
      return !!accessToken;
    } catch (error) {
      console.error('[Sync Service] Error checking tokens:', error);
      return false;
    }
  }

  // Rozpoczyna proces synchronizacji w tle
  async startBackgroundSync(owner: string): Promise<void> {
    console.log('[Sync Service] Starting background sync attempt for owner:', owner);
    
    // Sprawdź czy mamy ważne tokeny
    const hasTokens = await this.hasValidTokens();
    if (!hasTokens) {
      console.log('[Sync Service] No valid tokens found, skipping sync');
      return;
    }

    if (this.syncInterval) {
      this.stopBackgroundSync();
    }

    console.log('[Sync Service] Starting background sync for owner:', owner);
    
    // Natychmiastowa pierwsza synchronizacja
    await this.syncPendingRecords(owner);
    
    // Ustawienie interwału dla kolejnych synchronizacji
    this.syncInterval = setInterval(() => {
      this.syncPendingRecords(owner);
    }, SYNC_INTERVAL);
  }

  // Zatrzymuje proces synchronizacji w tle
  stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // Czyścimy subskrypcję NetInfo tylko jeśli była utworzona
    if (!IS_DEBUG && this.netInfoSubscription) {
      this.netInfoSubscription();
      this.netInfoSubscription = null;
    }
    
    // Reset the pending sync flag
    this.pendingSync = false;

    console.log('[Sync Service] Background sync stopped');
  }

  // After successful synchronization, update the subscription status if user is authenticated
  private async updateSubscriptionStatus(owner: string): Promise<void> {
    try {
      // Check if we have access token (which means user is authenticated)
      const accessToken = await this.accessTokenGetter?.();
      if (!accessToken) {
        console.log('[Sync Service] No access token, skipping subscription status update');
        return;
      }

      // Get subscription status from API
      const subscriptionData = await SubscriptionApi.getSubscriptionStatus();
      
      // Save to database for future offline access
      await UserData.updateSubscriptionData(
        database,
        owner,
        subscriptionData.subscription_end,
        subscriptionData.csv_lock
      );
      
      console.log('[Sync Service] Updated subscription data in database');
    } catch (error) {
      console.error('[Sync Service] Error updating subscription status:', error);
      // We don't throw an error here, as this is not critical for sync
    }
  }
}

export const syncService = new SyncService();
export default syncService; 