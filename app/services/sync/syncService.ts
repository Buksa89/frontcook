import { Q } from '@nozbe/watermelondb';
import database from '../../../database';
import { Model } from '@nozbe/watermelondb';
import { AppState, AppStateStatus, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { asyncStorageService } from '../storage';
import api from '../../api/api';
import { ApiError } from '../../api/api';

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


const BATCH_SIZE = 20;
const SYNC_INTERVAL = 30000//5 * 60 * 1000; // 5 minut
const MIN_SYNC_INTERVAL = 30 * 1000; // 30 sekund - minimalny czas między synchronizacjami
const IS_DEBUG = Constants.expoConfig?.extra?.isDebug || false;

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
      console.log('[Sync Service] Sync already in progress, skipping');
      return;
    }

    // Sprawdź czy można wykonać synchronizację
    if (!(await this.canSync())) {
      console.log('[Sync Service] Cannot sync right now, conditions not met');
      return;
    }
    
    try {
      this.isSyncing = true;
      console.log('[Sync Service] Starting sync process for owner:', owner);

      // Pobierz timestamp ostatniej synchronizacji
      const lastSync = await asyncStorageService.getLastSync() || new Date(0).toISOString();
      console.log('[Sync Service] Last sync timestamp:', lastSync);

      // First push local changes to server
      console.log('[Sync Service] Starting push phase...');
      await this.syncPush();

      // Then pull changes from server and get the most recent update timestamp
      console.log('[Sync Service] Starting pull phase...');
      const mostRecentUpdate = await this.syncPull(lastSync);

      // Only update the last sync time if both push and pull completed successfully
      // and we have a valid most recent update time
      if (mostRecentUpdate) {
        await asyncStorageService.storeLastSync(mostRecentUpdate);
        this.lastSyncTime = Date.now();
        console.log('[Sync Service] Updated last sync to:', mostRecentUpdate);
      }
      
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
    let mostRecentUpdate = null;

    // Get active user
    const activeUser = await this.activeUserGetter?.();
    if (!activeUser) {
      console.error('[Sync Service] No active user found');
      return null;
    }

    // Kolekcja obiektów, które nie udało się zsynchronizować
    const failedItems: { [key: string]: PullResponseItem[] } = {
      recipe: [],
      tag: [],
      ingredient: [],
      recipe_tag: [],
      shopping_item: [],
      user_settings: []
    };

    while (hasMoreData) {
      try {
        const payload = {
          lastSync,
          limit: BATCH_SIZE
        };

        console.log('[Sync Service] Making sync request with payload:', payload);
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

        // Process each received item
        await database.write(async () => {
          for (const item of data) {
            try {
              // Update most recent update time if this item is newer
              if (!mostRecentUpdate || new Date(item.last_update) > new Date(mostRecentUpdate)) {
                mostRecentUpdate = item.last_update;
              }

              const table = this.getTableName(item.object_type);
              const collection = database.get(table);
              
              // Try to find existing record
              const existingRecords = await collection.query(
                Q.where('sync_id', item.sync_id)
              ).fetch();

              // Deserialize data before creating/updating record
              const deserializedData = await collection.modelClass.deserialize(item, database);

              if (existingRecords.length === 0) {
                // Record doesn't exist - create new one
                await collection.create(record => {
                  Object.assign(record._raw, deserializedData);
                  record._raw.owner = activeUser;
                });
              } else {
                // Record exists - check if update needed
                const existingRecord = existingRecords[0];
                if (new Date(item.last_update) > new Date(existingRecord._raw.last_update)) {
                  await existingRecord.update(record => {
                    Object.assign(record._raw, deserializedData);
                    record._raw.owner = activeUser;
                  });
                }
              }
            } catch (itemError) {
              console.error('[Sync Service] Failed to process item:', item, itemError);
              failedItems[item.object_type].push(item);
            }
          }
        });

        // Update lastSync for next iteration
        const batchMostRecent = data.reduce((latest, item) => {
          const itemDate = new Date(item.last_update).getTime();
          const latestDate = new Date(latest).getTime();
          return itemDate > latestDate ? item.last_update : latest;
        }, lastSync);

        if (batchMostRecent === lastSync) {
          console.log('[Sync Service] No new updates found, stopping sync');
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

    // Próba ponownej synchronizacji nieudanych obiektów w odpowiedniej kolejności
    const retryOrder: (keyof typeof failedItems)[] = ['recipe', 'tag', 'ingredient', 'recipe_tag', 'shopping_item', 'user_settings'];
    
    for (const objectType of retryOrder) {
      const items = failedItems[objectType];
      if (items.length === 0) continue;

      await database.write(async () => {
        for (const item of items) {
          try {
            const table = this.getTableName(item.object_type);
            const collection = database.get(table);
            
            const existingRecords = await collection.query(
              Q.where('sync_id', item.sync_id)
            ).fetch();

            const deserializedData = await collection.modelClass.deserialize(item, database);

            if (existingRecords.length === 0) {
              await collection.create(record => {
                Object.assign(record._raw, deserializedData);
                record._raw.owner = activeUser;
              });
            } else {
              const existingRecord = existingRecords[0];
              if (new Date(item.last_update) > new Date(existingRecord._raw.last_update)) {
                await existingRecord.update(record => {
                  Object.assign(record._raw, deserializedData);
                  record._raw.owner = activeUser;
                });
              }
            }
          } catch (retryError) {
            // Loguj błąd tylko jeśli druga próba się nie powiedzie
            console.error(`[Sync Service] Failed to sync ${item.object_type} with sync_id ${item.sync_id} after retry:`, retryError);
          }
        }
      });
    }

    return mostRecentUpdate || lastSync;
  }

  private async getPendingRecordsForPush(table: TableName): Promise<(Model & { _raw: ExtendedRawRecord, serialize: () => any })[]> {
    const activeUser = await this.activeUserGetter?.();
    if (!activeUser) {
      console.error('[Sync Service] No active user found');
      return [];
    }

    console.log(`[Sync Service] Querying ${table} for pending records with owner: ${activeUser}`);
    
    const records = await database.get(table).query(
      Q.and(
        Q.where('sync_status', 'pending'),
        Q.where('owner', activeUser)
      ),
      Q.sortBy('last_update', Q.asc)
    ).fetch() as (Model & { _raw: ExtendedRawRecord, serialize: () => any })[];

    console.log(`[Sync Service] Found ${records.length} pending records in ${table} for owner ${activeUser}`);
    if (records.length > 0) {
      console.log(`[Sync Service] Sample record from ${table}:`, records[0]._raw);
    }

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
      const pushOrder: TableName[] = ['recipes', 'tags', 'ingredients', 'recipe_tags', 'shopping_items', 'user_settings'];
      
      // Kolekcja obiektów do wysłania wraz z informacją o tabeli
      const recordsToSync: { record: Model & { _raw: ExtendedRawRecord, serialize: () => any }, table: TableName }[] = [];

      console.log('[Sync Service] Starting push sync, checking for pending records...');

      // Pobierz rekordy w odpowiedniej kolejności
      for (const table of pushOrder) {
        console.log(`[Sync Service] Checking table ${table} for pending records...`);
        const records = await this.getPendingRecordsForPush(table);
        console.log(`[Sync Service] Found ${records.length} pending records in ${table}`);
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
        return new Date(a.record._raw.last_update).getTime() - new Date(b.record._raw.last_update).getTime();
      });

      // Serializuj rekordy
      const serializedRecords = recordsToSync.map(({ record }) => record.serialize());

      console.log('[Sync Service] Pushing changes to server:', serializedRecords);
      
      // Wyślij zmiany na serwer i odbierz zaktualizowane obiekty
      const response = await api.post<PullResponseItem[]>('/api/sync/push/', serializedRecords, true);

      // Kolekcja obiektów, które nie udało się zsynchronizować
      const failedItems: { [key: string]: PullResponseItem[] } = {
        recipe: [],
        tag: [],
        ingredient: [],
        recipe_tag: [],
        shopping_item: [],
        user_settings: []
      };

      // Zapisz zaktualizowane obiekty z odpowiedzi serwera
      await database.write(async () => {
        for (const item of response) {
          try {
            const table = this.getTableName(item.object_type);
            const collection = database.get(table);
            
            // Try to find existing record
            const existingRecords = await collection.query(
              Q.where('sync_id', item.sync_id)
            ).fetch();

            // Deserialize data before creating/updating record
            const deserializedData = await collection.modelClass.deserialize(item, database);

            if (existingRecords.length === 0) {
              // Record doesn't exist - create new one
              await collection.create(record => {
                Object.assign(record._raw, deserializedData);
                record._raw.owner = activeUser;
                record._raw.sync_status = 'synced';
              });
            } else {
              // Record exists - update it
              const existingRecord = existingRecords[0];
              await existingRecord.update(record => {
                Object.assign(record._raw, deserializedData);
                record._raw.owner = activeUser;
                record._raw.sync_status = 'synced';
              });
            }
          } catch (itemError) {
            // Dodaj obiekt do kolekcji nieudanych synchronizacji
            failedItems[item.object_type].push(item);
          }
        }
      });

      // Próba ponownej synchronizacji nieudanych obiektów w odpowiedniej kolejności
      const retryOrder: (keyof typeof failedItems)[] = ['recipe', 'tag', 'ingredient', 'recipe_tag', 'shopping_item', 'user_settings'];
      
      for (const objectType of retryOrder) {
        const items = failedItems[objectType];
        if (items.length === 0) continue;

        await database.write(async () => {
          for (const item of items) {
            try {
              const table = this.getTableName(item.object_type);
              const collection = database.get(table);
              
              const existingRecords = await collection.query(
                Q.where('sync_id', item.sync_id)
              ).fetch();

              const deserializedData = await collection.modelClass.deserialize(item, database);

              if (existingRecords.length === 0) {
                await collection.create(record => {
                  Object.assign(record._raw, deserializedData);
                  record._raw.owner = activeUser;
                  record._raw.sync_status = 'synced';
                });
              } else {
                const existingRecord = existingRecords[0];
                await existingRecord.update(record => {
                  Object.assign(record._raw, deserializedData);
                  record._raw.owner = activeUser;
                  record._raw.sync_status = 'synced';
                });
              }
            } catch (retryError) {
              // Loguj błąd tylko jeśli druga próba się nie powiedzie
              console.error(`[Sync Service] Failed to sync ${item.object_type} with sync_id ${item.sync_id} after retry:`, retryError);
            }
          }
        });
      }

      console.log('[Sync Service] Successfully pushed changes to server');
    } catch (error) {
      console.error('[Sync Service] Push sync failed:', error);
      throw error;
    }
  }

  // Helper method to get object type from raw record
  private getObjectType(raw: ExtendedRawRecord, table?: TableName): string {
    const tableToType: { [key in TableName]: string } = {
      'recipes': 'recipe',
      'tags': 'tag',
      'ingredients': 'ingredient',
      'shopping_items': 'shopping_item',
      'user_settings': 'user_settings',
      'recipe_tags': 'recipe_tag'
    };

    // If table is provided directly, use it
    if (table) {
      return tableToType[table];
    }

    // If record has table information, use it
    if (raw._raw?.table) {
      const tableType = Object.entries(tableToType).find(([t]) => t === raw._raw.table);
      if (tableType) {
        return tableType[1];
      }
    }

    // If we still can't determine, log and throw error
    console.error('[Sync Service] Failed to determine object type. Record details:', {
      available_fields: Object.keys(raw),
      raw_record: raw
    });

    throw new Error(`Cannot determine object type for record: ${raw.sync_id}`);
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