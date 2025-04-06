import { Q } from '@nozbe/watermelondb';
import database from '../../../database';
import SyncModel from '../../../database/models/SyncModel';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import RecipeTag from '../../../database/models/RecipeTag';
import Ingredient from '../../../database/models/Ingredient';
import ShoppingItem from '../../../database/models/ShoppingItem';
import UserSettings from '../../../database/models/UserSettings';
import Notification from '../../../database/models/Notification';
import api from '../../api/api';
import AppData from '../../../database/models/AppData';
import syncApi from '../../api/sync';
import { SyncItemType, SyncResponse } from '../../api/sync';
import RecipeImage from '../../../database/models/RecipeImage';

// Batch size for data synchronization
const BATCH_SIZE = 20;

// Map of object types to model classes
const MODEL_CLASSES = {
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
 * Updates or creates an object in the local database based on the data from server
 * @param item The item data from server
 */
async function upsertItem(item: SyncItemType): Promise<void> {
  try {
    // Extract the object type from the item
    const objectType = item.object_type;
    
    // Map the object type to the corresponding model class
    const ModelClass = MODEL_CLASSES[objectType as keyof typeof MODEL_CLASSES];
    
    if (!ModelClass) {
      console.error(`[SyncService] Unknown object type: ${objectType}`);
      return;
    }
    
    // All our models extend SyncModel, so they should have pullSyncUpdate
    // We use 'any' here to bypass TypeScript's type checking for method access
    const result = await (ModelClass as any).pullSyncUpdate(database, item);
    
    // Log the result (can be removed in production)
    console.log(`[SyncService] ${result.message}`);
    
  } catch (error) {
    throw error;
  }
}

/**
 * Sorts the response items in the order they should be processed
 * Tags and recipes first, then the rest
 * @param items The items array from the server
 * @returns An array of sorted items
 */
function sortResponseItems(items: SyncItemType[]): SyncItemType[] {
  // Group items by object_type
  const groupedItems: Record<string, SyncItemType[]> = {};
  
  for (const item of items) {
    const objectType = item.object_type;
    if (!groupedItems[objectType]) {
      groupedItems[objectType] = [];
    }
    groupedItems[objectType].push(item);
  }
  
  const sortedItems: SyncItemType[] = [];
  
  // Add tags first
  if (groupedItems['tag']) {
    sortedItems.push(...groupedItems['tag']);
  }
  
  // Add recipes next
  if (groupedItems['recipe']) {
    sortedItems.push(...groupedItems['recipe']);
  }
  
  // Add the rest of the items
  for (const objectType in groupedItems) {
    if (objectType !== 'tag' && objectType !== 'recipe') {
      sortedItems.push(...groupedItems[objectType]);
    }
  }
  
  return sortedItems;
}

/**
 * Process a single batch of items from the server
 * @param user The active user
 * @param currentLastSync The current last sync timestamp as Date object
 * @param batchCount The current batch number
 * @param allFailedItems Array to collect failed items
 * @returns The updated last sync timestamp and whether there are more items to process
 */
async function processBatch(
  user: string,
  currentLastSync: Date,
  batchCount: number,
  allFailedItems: SyncItemType[]
): Promise<{ updatedLastSync: Date, hasMoreItems: boolean }> {
  // console.log(`[SyncService] Processing batch ${batchCount} with lastSync=${currentLastSync.toISOString()}`);
  
  // Call the getChanges API to get updated data from the server with batch size
  const response = await syncApi.getChanges(currentLastSync, BATCH_SIZE) as SyncItemType[];
  
  
  // If no more items, we're done with the loop
  if (response.length === 0) {
    // console.log('[SyncService] No more items to synchronize');
    return { updatedLastSync: currentLastSync, hasMoreItems: false };
  }
  
  console.log(`[SyncService] Received ${response.length} items in batch ${batchCount}`);
  
  // Update last_sync to the most recent last_update from the received items
  let updatedLastSync = currentLastSync;
  if (response.length > 0) {
    // Find the most recent last_update timestamp and convert to a Date object
    let mostRecentUpdate = new Date(response[0].last_update);
    
    for (const item of response) {
      const itemDate = new Date(item.last_update);
      if (itemDate > mostRecentUpdate) {
        mostRecentUpdate = itemDate;
      }
    }
    
    // Update the lastSync value if needed
    if (mostRecentUpdate > currentLastSync) {
      // console.log(`[SyncService] Updating last_sync from ${currentLastSync.toISOString()} to ${mostRecentUpdate.toISOString()}`);
      
      // Ensure date is valid
      if (!isNaN(mostRecentUpdate.getTime())) {
        await AppData.updateLastSync(database, mostRecentUpdate);
        updatedLastSync = mostRecentUpdate;
      } else {
        console.warn(`[SyncService] Invalid timestamp encountered, skipping update`);
      }
    }
  }
  
  // Sort the items in the correct order for processing
  const sortedItems = sortResponseItems(response);
  
  console.log(`[SyncService] Processing ${sortedItems.length} items in batch ${batchCount}`);
  
  // Process each item in the sorted order
  for (const item of sortedItems) {
    try {
      await upsertItem(item);
    } catch (error) {
      // No error logging here since failures are expected
      // Store the failed item for later reprocessing
      allFailedItems.push(item);
    }
  }
  
  // console.log(`[SyncService] Batch ${batchCount} completed successfully`);
  
  return { updatedLastSync, hasMoreItems: true };
}

/**
 * Handles pulling data from the server to update the local database
 * @param user The active user for whom to sync data
 * @param lastSync The timestamp of the last successful synchronization as Date object
 */
export async function pullSynchronization(user: string, lastSync: Date): Promise<void> {
  // console.log('[SyncService] Pull synchronization started');
  
  // Array to store all items that failed to process across all batches
  const allFailedItems: SyncItemType[] = [];
  
  // Keep fetching batches until we get an empty response
  let currentLastSync = lastSync;
  let batchCount = 0;
  
  try {
    let hasMoreItems = true;
    
    while (hasMoreItems) {
      
      // Process a single batch
      const result = await processBatch(user, currentLastSync, batchCount, allFailedItems);
      // Update variables for next iteration
      currentLastSync = result.updatedLastSync;
      hasMoreItems = result.hasMoreItems;
      if (hasMoreItems) {
        batchCount++;
      }
    }
    
    // Process all failed items after all batches are complete
    if (allFailedItems.length > 0) {
      console.log(`[SyncService] Processing ${allFailedItems.length} failed items from all batches`);
      
      // Sort failed items to ensure proper processing order (recipes first, then tags, etc.)
      const sortedFailedItems = sortResponseItems(allFailedItems);
            
      // Try processing the items again
      for (const item of sortedFailedItems) {
        try {
          await upsertItem(item);
          console.log(`[SyncService] Successfully processed previously failed item: ${item.object_type} with sync_id ${item.sync_id}`);
        } catch (error) {
          console.warn(`[SyncService] Failed to process item on retry: ${item.object_type} with sync_id ${item.sync_id}`, error);
        }
      }
    }
    
    // console.log(`[SyncService] Pull synchronization completed successfully. Processed ${batchCount} batches.`);
    
  } catch (error) {
    console.error('[SyncService] Pull synchronization error:', error);
    throw error;
  }
}

export default pullSynchronization; 