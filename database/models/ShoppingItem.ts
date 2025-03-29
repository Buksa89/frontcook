import { field, text, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { Database } from '@nozbe/watermelondb'
import { Observable } from 'rxjs'
import SyncModel from './SyncModel'
import AuthService from '../../app/services/auth/authService'
import { map } from 'rxjs/operators'
import { parseIngredient } from '../../app/utils/ingredientParser'
import { v4 as uuidv4 } from 'uuid'

export default class ShoppingItem extends SyncModel {
  static table = 'shopping_items'

  // Fields specific to ShoppingItem
  @field('amount') amount!: number
  @text('unit') unit!: string | null
  @text('name') name!: string
  @text('type') type!: string | null
  @field('order') order!: number
  @field('is_checked') isChecked!: boolean
  


  static observeUnchecked(database: Database): Observable<ShoppingItem[]> {
    return new Observable<ShoppingItem[]>(subscriber => {
      let subscription: any;
      
      AuthService.getActiveUser().then(activeUser => {
        subscription = database
          .get<ShoppingItem>('shopping_items')
          .query(
            Q.and(
              Q.where('owner', activeUser),
              Q.where('is_checked', false),
              Q.where('is_deleted', false)
            )
          )
          .observe()
          .pipe(map(items => items.sort((a, b) => b.order - a.order)))
          .subscribe(subscriber);
      });

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    });
  }

  static observeChecked(database: Database): Observable<ShoppingItem[]> {
    return new Observable<ShoppingItem[]>(subscriber => {
      let subscription: any;
      
      AuthService.getActiveUser().then(activeUser => {
        subscription = database
          .get<ShoppingItem>('shopping_items')
          .query(
            Q.and(
              Q.where('owner', activeUser),
              Q.where('is_checked', true),
              Q.where('is_deleted', false)
            )
          )
          .observe()
          .pipe(map(items => items.sort((a, b) => b.order - a.order))) // Note: descending order for checked items
          .subscribe(subscriber);
      });

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    });
  }

  // Helper method to get the next order value
  static async getNextOrder(database: Database): Promise<number> {
    try {
      const activeUser = await AuthService.getActiveUser();
      const lastItem = await database
        .get<ShoppingItem>('shopping_items')
        .query(
          Q.where('is_deleted', false),
          Q.sortBy('order', Q.desc),
          Q.where('owner', activeUser),
          Q.take(1)
        )
        .fetch();
      
      const maxOrder = lastItem.length > 0 ? lastItem[0].order : -1;
      return maxOrder + 1;
    } catch (error) {
      console.error(`[DB ShoppingItem] Error getting next order value: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return Date.now(); // Use timestamp as fallback
    }
  }

  // Helper method to find existing item with same name and unit
  static async findExisting(
    database: Database,
    name: string,
    unit: string | null,
    isChecked: boolean
  ): Promise<ShoppingItem | null> {
    try {
      const activeUser = await AuthService.getActiveUser();
      console.log(`[DB ShoppingItem] Searching for existing item: name=${name}, unit=${unit}, isChecked=${isChecked}, owner=${activeUser}`)
      
      const items = await database
        .get<ShoppingItem>('shopping_items')
        .query(
          Q.and(
            Q.where('owner', activeUser),
            Q.where('name', Q.eq(name)),
            Q.where('unit', Q.eq(unit)),
            Q.where('is_checked', Q.eq(isChecked)),
            Q.where('is_deleted', false)
          )
        )
        .fetch()

      if (items.length > 0) {
        console.log(`[DB ShoppingItem] Found existing item: ${items[0].id}`)
        return items[0]
      }

      console.log('[DB ShoppingItem] No existing item found')
      return null
    } catch (error) {
      console.error(`[DB ShoppingItem] Error finding existing item: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  // New method: Simple create without parsing
  static async createShoppingItem(
    database: Database,
    name: string,
    amount: number,
    unit: string | null,
    isChecked: boolean = false,
    type: string | null = null,
    order?: number,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: string,
    isDeleted?: boolean
  ): Promise<ShoppingItem> {
    // If no order is provided, get the next available order
    if (order === undefined) {
      order = await this.getNextOrder(database);
    }
    
    // Use the parent SyncModel.create method
    return await SyncModel.create.call(
      this as unknown as (new () => SyncModel) & typeof SyncModel,
      database,
      async (record: SyncModel) => {
        const shoppingItem = record as ShoppingItem;
        
        // Set shopping item-specific fields
        shoppingItem.name = name;
        shoppingItem.amount = amount;
        shoppingItem.unit = unit;
        shoppingItem.type = type;
        shoppingItem.order = order as number;
        shoppingItem.isChecked = isChecked;
        
        // Set optional SyncModel fields if provided
        if (syncId !== undefined) shoppingItem.syncId = syncId;
        if (syncStatusField !== undefined) shoppingItem.syncStatusField = syncStatusField;
        if (lastUpdate !== undefined) shoppingItem.lastUpdate = lastUpdate;
        if (isDeleted !== undefined) shoppingItem.isDeleted = isDeleted;
      }
    ) as ShoppingItem;
  }

  // New method: Simple update without parsing
  static async updateShoppingItem(
    database: Database,
    itemId: string,
    name?: string,
    amount?: number,
    unit?: string | null,
    type?: string | null,
    isChecked?: boolean,
    order?: number,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: string,
    isDeleted?: boolean
  ): Promise<ShoppingItem | null> {
    try {
      const item = await database
        .get<ShoppingItem>('shopping_items')
        .find(itemId);
      
      if (!item) {
        console.log(`[DB ShoppingItem] Item with id ${itemId} not found`);
        return null;
      }
      
      console.log(`[DB ShoppingItem] Updating item ${itemId} with provided fields`);
      
      // Use the update method directly from the model instance
      await item.update(record => {
        // Update only provided fields
        if (name !== undefined) record.name = name;
        if (amount !== undefined) record.amount = amount;
        if (unit !== undefined) record.unit = unit;
        if (type !== undefined) record.type = type;
        if (isChecked !== undefined) record.isChecked = isChecked;
        if (order !== undefined) record.order = order;
        
        // Update SyncModel fields if provided
        if (syncId !== undefined) record.syncId = syncId;
        if (syncStatusField !== undefined) record.syncStatusField = syncStatusField;
        if (lastUpdate !== undefined) record.lastUpdate = lastUpdate;
        if (isDeleted !== undefined) record.isDeleted = isDeleted;
      });
      
      console.log(`[DB ShoppingItem] Successfully updated item ${itemId}`);
      return item;
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating item: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  static async createOrUpdate(
    database: Database,
    text: string
  ): Promise<ShoppingItem> {
    try {
      const parsed = parseIngredient(text);

      const existingItem = await this.findExisting(
        database,
        parsed.name,
        parsed.unit,
        false
      );

      if (existingItem) {
        console.log(`[DB ShoppingItem] Found existing item ${existingItem.id}, updating amount`);
        
        // Use the updateShoppingItem method to update the existing item
        return await this.updateShoppingItem(
          database,
          existingItem.id,
          undefined, // name - keep existing
          existingItem.amount + parsed.amount, // amount - add the new amount
          undefined, // unit - keep existing
          undefined, // type - keep existing
          undefined, // isChecked - keep existing
          undefined, // order - keep existing
          undefined, // syncId - keep existing
          undefined, // syncStatusField - keep existing
          undefined, // lastUpdate - keep existing
          undefined  // isDeleted - keep existing
        ) as ShoppingItem; // We know it exists so we can safely cast
      } else {
        console.log(`[DB ShoppingItem] No existing item found, creating new item`);
        
        // Use the createShoppingItem method to create a new item
        return await this.createShoppingItem(
          database,
          parsed.name,
          parsed.amount,
          parsed.unit,
          false, // isChecked
          null,  // type
          undefined, // order - get next available
          undefined, // syncId - generate new
          undefined, // syncStatusField - default to 'pending'
          undefined, // lastUpdate - current timestamp
          undefined  // isDeleted - default to false
        );
      }
    } catch (error) {
      console.error(`[DB ShoppingItem] Error creating/updating item: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async toggleChecked() {
    try {
      if (!this.isChecked) {
        // Sprawdzamy czy istnieje już zaznaczony element o tej samej nazwie i jednostce
        const existingCheckedItem = await ShoppingItem.findExisting(
          this.database,
          this.name,
          this.unit,
          true
        );

        if (existingCheckedItem) {
          console.log(`[DB ShoppingItem] Found existing checked item ${existingCheckedItem.id}, merging amounts`);
          // Use updateShoppingItem to update the amount of the existing checked item
          await ShoppingItem.updateShoppingItem(
            this.database,
            existingCheckedItem.id,
            undefined, // name - keep existing
            existingCheckedItem.amount + this.amount, // amount - add the current amount
            undefined, // unit - keep existing
            undefined, // type - keep existing
            undefined, // isChecked - keep existing
            undefined, // order - keep existing
            undefined, // syncId - keep existing
            undefined, // syncStatusField - keep existing
            undefined, // lastUpdate - keep existing
            undefined  // isDeleted - keep existing
          );
          
          await this.markAsDeleted();
          return;
        }
      }

      console.log(`[DB ShoppingItem] Toggling checked status for item ${this.id}: ${this.isChecked} -> ${!this.isChecked}`);
      // Use updateShoppingItem to toggle the checked status
      await ShoppingItem.updateShoppingItem(
        this.database,
        this.id,
        undefined, // name - keep existing
        undefined, // amount - keep existing
        undefined, // unit - keep existing
        undefined, // type - keep existing
        !this.isChecked, // isChecked - toggle
        undefined, // order - keep existing
        undefined, // syncId - keep existing
        undefined, // syncStatusField - keep existing
        undefined, // lastUpdate - keep existing
        undefined  // isDeleted - keep existing
      );
    } catch (error) {
      console.error(`[DB ShoppingItem] Error toggling checked status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async updateWithParsing(text: string) {
    try {
      const parsed = parseIngredient(text);
      console.log(`[DB ShoppingItem] Updating item ${this.id} with parsed text: "${text}" -> name=${parsed.name}, amount=${parsed.amount}, unit=${parsed.unit}`);
      
      // Sprawdzamy czy istnieje już taki sam element (inny niż ten)
      const existingItem = await ShoppingItem.findExisting(
        this.database,
        parsed.name,
        parsed.unit,
        this.isChecked
      );

      if (existingItem && existingItem.id !== this.id) {
        console.log(`[DB ShoppingItem] Found existing item ${existingItem.id}, merging amounts`);
        // Use updateShoppingItem to update the amount of the existing item
        await ShoppingItem.updateShoppingItem(
          this.database,
          existingItem.id,
          undefined, // name - keep existing
          existingItem.amount + parsed.amount, // amount - add the parsed amount
          undefined, // unit - keep existing
          undefined, // type - keep existing
          undefined, // isChecked - keep existing
          undefined, // order - keep existing
          undefined, // syncId - keep existing
          undefined, // syncStatusField - keep existing
          undefined, // lastUpdate - keep existing
          undefined  // isDeleted - keep existing
        );
        
        // Mark this item as deleted
        await this.markAsDeleted();
        return;
      }
      
      // Update this item with the parsed values
      await ShoppingItem.updateShoppingItem(
        this.database,
        this.id,
        parsed.name,    // name - update with parsed name
        parsed.amount,  // amount - update with parsed amount
        parsed.unit,    // unit - update with parsed unit
        null,           // type - set to null
        undefined,      // isChecked - keep existing
        undefined,      // order - keep existing
        undefined,      // syncId - keep existing
        undefined,      // syncStatusField - keep existing
        undefined,      // lastUpdate - keep existing
        undefined       // isDeleted - keep existing
      );

      console.log(`[DB ShoppingItem] Successfully updated item ${this.id}`);
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating with parsed text: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 