import { Q } from '@nozbe/watermelondb';
import database from '../../../database';
import { 
  SyncItemType,
  ShoppingItemSync,
  RecipeSync,
  IngredientSync,
  TagSync,
  UserSettingsSync
} from '../../api/sync';
import { Model } from '@nozbe/watermelondb';
import { AppState, AppStateStatus, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { asyncStorageService } from '../storage';
import { getTokens } from '../auth/authStorage';
import api from '../../api/api';

// Interface for the pull response items
interface PullResponseItem {
  object_type: 'recipe' | 'tag' | 'recipe_tag' | 'ingredient' | 'shopping_item' | 'user_settings';
  sync_id: string;
  last_update: string;
  is_deleted: boolean;
  name?: string;
  description?: string | null;
  image?: string | null;
  rating?: number | null;
  is_approved?: boolean;
  prep_time?: number | null;
  total_time?: number | null;
  servings?: number | null;
  instructions?: string;
  notes?: string | null;
  nutrition?: string | null;
  video?: string | null;
  source?: string | null;
  amount?: number | null;
  unit?: string | null;
  type?: string | null;
  order?: number;
  is_checked?: boolean;
  recipe_id?: string;
  original_str?: string;
  recipe?: string;
  tag?: string;
  language?: string;
  auto_translate_recipes?: boolean;
  allow_friends_views_recipes?: boolean;
  [key: string]: any;
}

// Helper function to normalize URL
const normalizeUrl = (baseUrl: string, path: string): string => {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

const BATCH_SIZE = 20;
const SYNC_INTERVAL = 30000//5 * 60 * 1000; // 5 minut
const MIN_SYNC_INTERVAL = 30 * 1000; // 30 sekund - minimalny czas między synchronizacjami
const IS_DEBUG = __DEV__; // Sprawdzenie czy aplikacja jest w trybie debug

type TableName = 'shopping_items' | 'recipes' | 'ingredients' | 'tags' | 'user_settings' | 'recipe_tags';

// Rozszerzony interfejs dla _RawRecord
interface ExtendedRawRecord {
  [key: string]: any;
  sync_status: string;
  last_update: string;
  is_deleted: boolean;
  owner: string | null;
  name?: string;
  amount?: number | string;
  unit?: string | null;
  type?: string | null;
  order?: number;
  is_checked?: boolean;
  description?: string | null;
  image?: string | null;
  rating?: number | null;
  is_approved?: boolean;
  prep_time?: number | null;
  total_time?: number | null;
  servings?: number | null;
  instructions?: string;
  notes?: string | null;
  nutrition?: string | null;
  video?: string | null;
  source?: string | null;
  recipe_id?: string;
  original_str?: string;
  language?: string;
  auto_translate_recipes?: boolean;
  allow_friends_views_recipes?: boolean;
}

class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  private lastSyncTime: number = 0;
  private pendingSync: boolean = false;
  private appStateSubscription: any = null;
  private netInfoSubscription: any = null;

  constructor() {
    // Nasłuchuj zmian stanu aplikacji
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    
    // Nasłuchuj zmian stanu połączenia tylko w trybie produkcyjnym
    if (!IS_DEBUG) {
      this.netInfoSubscription = NetInfo.addEventListener(this.handleConnectivityChange);
    }
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active' && this.pendingSync) {
      const activeUser = await asyncStorageService.getActiveUser();
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
      const activeUser = await asyncStorageService.getActiveUser();
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

  // Konwertuje model do formatu synchronizacji
  private modelToSyncItem(model: Model & { _raw: ExtendedRawRecord }, table: TableName): SyncItemType {
    const raw = model._raw;
    
    const baseFields = {
      sync_status: raw.sync_status,
      last_update: raw.last_update,
      is_deleted: raw.is_deleted,
      sync_id: raw.sync_id,
      owner: raw.owner
    };

    switch (table) {
      case 'shopping_items':
        return {
          ...baseFields,
          name: raw.name!,
          amount: raw.amount!,
          unit: raw.unit ?? null,
          type: raw.type ?? null,
          order: raw.order!,
          is_checked: raw.is_checked ?? false
        } as ShoppingItemSync;

      case 'recipes':
        return {
          ...baseFields,
          name: raw.name!,
          description: raw.description ?? null,
          image: raw.image ?? null,
          rating: raw.rating ?? null,
          is_approved: raw.is_approved ?? false,
          prep_time: raw.prep_time ?? null,
          total_time: raw.total_time ?? null,
          servings: raw.servings ?? null,
          instructions: raw.instructions!,
          notes: raw.notes ?? null,
          nutrition: raw.nutrition ?? null,
          video: raw.video ?? null,
          source: raw.source ?? null
        } as RecipeSync;

      case 'ingredients':
        return {
          ...baseFields,
          name: raw.name!,
          amount: raw.amount as number | null ?? null,
          unit: raw.unit ?? null,
          type: raw.type ?? null,
          order: raw.order!,
          recipe_id: raw.recipe_id!,
          original_str: raw.original_str!
        } as IngredientSync;

      case 'tags':
        return {
          ...baseFields,
          name: raw.name!,
          order: raw.order!
        } as TagSync;

      case 'user_settings':
        return {
          ...baseFields,
          language: raw.language!,
          auto_translate_recipes: raw.auto_translate_recipes!,
          allow_friends_views_recipes: raw.allow_friends_views_recipes!
        } as UserSettingsSync;

      default:
        throw new Error(`Unsupported table: ${table}`);
    }
  }

  // Pobiera pending rekordy z danej tabeli
  private async getPendingRecords(table: TableName, owner: string, lastSync: string): Promise<(Model & { _raw: ExtendedRawRecord })[]> {
    return await database.get(table).query(
      Q.and(
        Q.where('owner', owner),
        Q.or(
          Q.where('sync_status', 'pending'),
          Q.where('last_update', Q.gt(lastSync))
        )
      )
    ).fetch() as (Model & { _raw: ExtendedRawRecord })[];
  }

  // Aktualizuje rekordy po synchronizacji
  private async updateSyncedRecords(table: TableName, syncedItems: SyncItemType[]): Promise<void> {
    await database.write(async () => {
      for (const item of syncedItems) {
        const records = await database.get(table).query(
          Q.where('sync_id', item.sync_id)
        ).fetch();
        
        if (records.length > 0) {
          const record = records[0] as (Model & { _raw: ExtendedRawRecord });
          await record.update(rec => {
            const rawRecord = (rec as any)._raw;
            Object.entries(item).forEach(([key, value]) => {
              rawRecord[key] = value;
            });
          });
        }
      }
    });
  }

  // Główna funkcja synchronizacji
  private async syncPendingRecords(owner: string): Promise<void> {
    if (this.isSyncing) return;

    // Sprawdź czy można wykonać synchronizację
    if (!(await this.canSync())) {
      return;
    }

    try {
      this.isSyncing = true;
      this.lastSyncTime = Date.now();
      console.log('[Sync Service] Starting sync for owner:', owner);

      // Pobierz timestamp ostatniej synchronizacji
      const lastSync = await asyncStorageService.getLastSync() || new Date(0).toISOString();

      // Pull changes from server
      await this.syncPull(lastSync);

      // Push pending changes to server
      await this.syncPush();

      // Continue with the rest of the sync process...
    } catch (error) {
      console.error('[Sync Service] Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncPull(initialLastSync: string): Promise<void> {
    let lastSync = initialLastSync;
    let hasMoreData = true;

    // Get active user
    const activeUser = await asyncStorageService.getActiveUser();
    if (!activeUser) {
      console.error('[Sync Service] No active user found');
      return;
    }

    while (hasMoreData) {
      try {
        const payload = {
          lastSync,
          limit: BATCH_SIZE
        };

        console.log('[Sync Service] Making sync request with payload:', payload);
        const data = await api.post<PullResponseItem[]>('/api/sync/pull/', payload, true);

        if (data.length === 0) {
          hasMoreData = false;
          continue;
        }

        // Process each received item
        await database.write(async () => {
          for (const item of data) {
            const table = this.getTableName(item.object_type);
            const collection = database.get(table);
            
            // Try to find existing record
            const existingRecords = await collection.query(
              Q.where('sync_id', item.sync_id)
            ).fetch();

            // Deserialize data before creating/updating record
            const deserializedData = await collection.modelClass.deserialize(item);

            if (existingRecords.length === 0) {
              // Record doesn't exist - create new one
              console.log(`[Sync Service] Creating new ${item.object_type} with sync_id: ${item.sync_id}`);
              await collection.create(record => {
                Object.assign(record._raw, deserializedData);
                record._raw.owner = activeUser;
              });
            } else {
              // Record exists - check if update needed
              const existingRecord = existingRecords[0];
              if (new Date(item.last_update) > new Date(existingRecord._raw.last_update)) {
                console.log(`[Sync Service] Updating ${item.object_type} with sync_id: ${item.sync_id}`);
                await existingRecord.update(record => {
                  Object.assign(record._raw, deserializedData);
                  record._raw.owner = activeUser;
                });
              }
            }
          }
        });

        // Update lastSync for next iteration
        const mostRecentUpdate = data.reduce((latest, item) => {
          return item.last_update > latest ? item.last_update : latest;
        }, lastSync);
        lastSync = mostRecentUpdate;

      } catch (error) {
        console.error('[Sync Service] Pull sync failed:', error);
        hasMoreData = false;
      }
    }
  }

  private async getPendingRecordsForPush(table: TableName): Promise<(Model & { _raw: ExtendedRawRecord, serialize: () => any })[]> {
    return await database.get(table).query(
      Q.where('sync_status', 'pending'),
      Q.sortBy('last_update', Q.asc)
    ).fetch() as (Model & { _raw: ExtendedRawRecord, serialize: () => any })[];
  }

  private async syncPush(): Promise<void> {
    try {
      // Get oldest pending records from all tables at once
      const tables: TableName[] = ['recipes', 'ingredients', 'tags', 'recipe_tags', 'shopping_items', 'user_settings'];
      const allRecords = [];
      
      for (const table of tables) {
        const records = await this.getPendingRecordsForPush(table);
        allRecords.push(...records.slice(0, BATCH_SIZE));
      }

      // Sort all records by last_update
      allRecords.sort((a, b) => new Date(a._raw.last_update).getTime() - new Date(b._raw.last_update).getTime());

      // Serialize records
      const serializedRecords = allRecords.map(record => record.serialize());

      // If there are no pending records, return
      if (serializedRecords.length === 0) {
        return;
      }

      console.log('[Sync Service] Pushing changes to server:', serializedRecords);
      
      // Send changes to server
      await api.post('/api/sync/push/', serializedRecords, true);

      // Update status of sent records to 'synced' while preserving their last_update
      await database.write(async () => {
        for (const record of allRecords) {
          const originalLastUpdate = record._raw.last_update;
          await record.update(rec => {
            rec._raw.sync_status = 'synced';
            rec._raw.last_update = originalLastUpdate;
          });
        }
      });

      console.log('[Sync Service] Successfully pushed changes to server');
    } catch (error) {
      console.error('[Sync Service] Push sync failed:', error);
      throw error;
    }
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
      default:
        throw new Error(`Unknown object type: ${objectType}`);
    }
  }

  // Rozpoczyna proces synchronizacji w tle
  startBackgroundSync(owner: string): void {
    if (this.syncInterval) {
      this.stopBackgroundSync();
    }

    console.log('[Sync Service] Starting background sync for owner:', owner);
    
    // Natychmiastowa pierwsza synchronizacja
    this.syncPendingRecords(owner);
    
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
    }

    // Czyścimy subskrypcję NetInfo tylko jeśli była utworzona
    if (!IS_DEBUG && this.netInfoSubscription) {
      this.netInfoSubscription();
    }

    console.log('[Sync Service] Background sync stopped');
  }
}

export const syncService = new SyncService();
export default syncService; 