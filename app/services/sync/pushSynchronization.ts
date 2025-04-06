import database from '../../../database';
import { Q } from '@nozbe/watermelondb';
import { Model } from '@nozbe/watermelondb';
import SyncModel from '../../../database/models/SyncModel';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import RecipeTag from '../../../database/models/RecipeTag';
import Ingredient from '../../../database/models/Ingredient';
import ShoppingItem from '../../../database/models/ShoppingItem';
import UserSettings from '../../../database/models/UserSettings';
import Notification from '../../../database/models/Notification';
import AppData from '../../../database/models/AppData';
import syncApi from '../../api/sync';
import { SyncItemType } from '../../api/sync';
import RecipeImage from '../../../database/models/RecipeImage';

// Bezpośrednie mapowanie klas modeli na typy obiektów
const MODEL_CLASS_TO_OBJECT_TYPE = new Map<any, string>([
  [Recipe, 'recipe'],
  [Tag, 'tag'],
  [RecipeTag, 'recipe_tag'],
  [Ingredient, 'ingredient'],
  [ShoppingItem, 'shopping_item'],
  [UserSettings, 'user_settings'],
  [Notification, 'notification'],
  [RecipeImage, 'recipe_image']
]);

// Mapowanie typów obiektów na klasy modeli (odwrotne mapowanie)
const OBJECT_TYPE_TO_MODEL_CLASS = {
  'recipe': Recipe,
  'tag': Tag,
  'recipe_tag': RecipeTag,
  'ingredient': Ingredient,
  'shopping_item': ShoppingItem,
  'user_settings': UserSettings,
  'notification': Notification,
  'app_data': AppData,
  'recipe_image': RecipeImage
};

/**
 * Retrieves pending items from the database based on the specified model classes and batch size
 * @param modelClasses Array of model classes to check for pending items
 * @param batchSize Maximum number of items to retrieve
 * @param user The user owning the items
 * @returns Array of pending SyncModel items
 */
async function getPendingItems(modelClasses: any[], batchSize: number, user: string): Promise<SyncModel[]> {
  // Array to collect all pending items
  const pendingItems: SyncModel[] = [];
  
  // Check each model for pending items
  for (const ModelClass of modelClasses) {
    try {
      // Query for pending items in the current model for the specific user
      const modelPendingItems = await database.get(ModelClass.table)
        .query(
          Q.and(
            Q.where('sync_status', 'pending'),
            Q.where('owner', user)
          )
        )
        .fetch();
      
      // Add pending items to our collection
      if (modelPendingItems.length > 0) {
        console.log(`[SyncService] Found ${modelPendingItems.length} pending items in ${ModelClass.table} for user ${user}`);
        // Cast the items to SyncModel since we know all our models extend SyncModel
        pendingItems.push(...(modelPendingItems as unknown as SyncModel[]));
        
        // If we've reached or exceeded the batch size, we can stop collecting
        if (pendingItems.length >= batchSize) {
          break;
        }
      }
    } catch (error) {
      console.error(`[SyncService] Error checking pending items in ${ModelClass.table}:`, error);
    }
  }
  
  return pendingItems;
}

/**
 * Gets the object type for a model instance
 * @param model The model instance
 * @returns The corresponding object type string
 */
function getObjectTypeForModel(model: SyncModel): string {
  // Find the model class for this instance
  for (const [ModelClass, objectType] of MODEL_CLASS_TO_OBJECT_TYPE.entries()) {
    if (model instanceof ModelClass) {
      return objectType;
    }
  }
  
  // Fallback: extract from table name
  return model.table.replace('_collection', '');
}

/**
 * Updates or creates an object in the local database based on the data from server
 * @param item The item data from server
 */
async function upsertItem(item: SyncItemType): Promise<void> {
  try {
    // Extract the object type from the item
    const objectType = item.object_type;
    
    // Map the object type to the corresponding model class
    const ModelClass = OBJECT_TYPE_TO_MODEL_CLASS[objectType as keyof typeof OBJECT_TYPE_TO_MODEL_CLASS];
    
    if (!ModelClass) {
      console.error(`[SyncService] Unknown object type: ${objectType}`);
      return;
    }
    
    // All our models extend SyncModel, so they should have pullSyncUpdate
    // We use 'any' here to bypass TypeScript's type checking for method access
    const result = await (ModelClass as any).pullSyncUpdate(database, item);
    
    // Log the result
    console.log(`[SyncService] ${result.message}`);
    
  } catch (error) {
    console.error(`[SyncService] Error upserting item:`, error);
    throw error;
  }
}

/**
 * Processes the server response after pushing items
 * @param response Items returned from the server
 * @param pendingItems Original pending items that were sent
 */
async function processServerResponse(response: SyncItemType[], pendingItems: SyncModel[]): Promise<void> {
  // Check if server returned any items
  if (response && response.length > 0) {
    console.log(`[SyncService] Processing ${response.length} items returned from server`);
    
    // Process each returned item
    for (const item of response) {
      try {
        // Use the same upsert function as in pull synchronization
        await upsertItem(item);
      } catch (error) {
        console.error(`[SyncService] Error processing server response item:`, error);
      }
    }
    
    console.log(`[SyncService] Finished processing server response items`);
  } else {
    // If server returned empty array or no items, just mark our items as synced
    console.log(`[SyncService] No items returned from server, marking local items as synced`);
    
    for (const item of pendingItems) {
      await item.updateAsSynced();
    }
    
    console.log('[SyncService] Successfully updated local items to synced status');
  }
}

/**
 * Handles pushing data from the local database to the server
 * @param user The active user for whom to sync data
 */
export async function pushSynchronization(user: string): Promise<void> {
  // console.log('[SyncService] Push synchronization started');
  
  // The batch size for data synchronization
  const BATCH_SIZE = 20;
  
  // The order of models to check as specified
  const modelClasses = [
    Recipe,
    Tag,
    RecipeTag,
    Ingredient,
    Notification,
    UserSettings,
    ShoppingItem,
    RecipeImage
  ];
  
  let hasMoreItems = true;
  let batchCount = 0;
  
  // Process batches until no more pending items
  while (hasMoreItems) {
    batchCount++;
    // console.log(`[SyncService] Processing batch ${batchCount}`);
    
    // Get pending items for this batch
    const pendingItems = await getPendingItems(modelClasses, BATCH_SIZE, user);
    
    // If no more pending items, we're done
    if (pendingItems.length === 0) {
      // console.log(`[SyncService] No more pending items found`);
      hasMoreItems = false;
      continue;
    }
    
    console.log(`[SyncService] Sending ${pendingItems.length} items to server in batch ${batchCount}`);
    
    try {
      // Convert each item to the format expected by the API
      const syncItems: SyncItemType[] = pendingItems.map(item => {
        // Get base data from model - zawiera już wszystkie pola oprócz tych wykluczonych
        const baseData = item.prepareForPush();
        
        // Get object_type using direct class instance check
        const objectType = getObjectTypeForModel(item);
        
        // Create a sync item with the required properties
        return {
          ...baseData,
          object_type: objectType as any, // Cast to satisfy TypeScript
        } as SyncItemType;
      });
      
      // Send data to the server
      const response = await syncApi.pushChanges(syncItems);
      // console.log(`[SyncService] Server returned ${response.length} items for batch ${batchCount}`);
      
      // Process the server response
      await processServerResponse(response, pendingItems);
      
    } catch (error) {
      console.error(`[SyncService] Error pushing batch ${batchCount} to server:`, error);
      // Continue with next batch even if this one failed
    }
  }
  
  // console.log(`[SyncService] Push synchronization completed. Processed ${batchCount} batches.`);
}

export default pushSynchronization; 