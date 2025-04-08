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
  static async getByShoppingData(
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
  static async create(
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
    lastUpdate?: Date,
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

  static async upsertByShoppingList(
    database: Database,
    text: string
  ): Promise<ShoppingItem> {
    try {
      const parsed = parseIngredient(text);

      const existingItem = await this.getByShoppingData(
        database,
        parsed.name,
        parsed.unit,
        false
      );

      if (existingItem) {
        console.log(`[DB ShoppingItem] Found existing item ${existingItem.id}, updating amount`);
        
        // Używamy metody update bezpośrednio na istniejącym elemencie
        await existingItem.update(record => {
          record.amount = existingItem.amount + parsed.amount;
        });
        
        return existingItem;
      } else {
        console.log(`[DB ShoppingItem] No existing item found, creating new item`);
        
        // Use the create method to create a new item
        return await this.create(
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
        // Sprawdzamy czy istnieje już zaznaczony element o tej samej nazwie i jednostce
        const existingCheckedItem = await ShoppingItem.getByShoppingData(
          this.database,
          this.name,
          this.unit,
          !this.isChecked
        );

        if (existingCheckedItem) {
          console.log(`[DB ShoppingItem] Found existing checked item ${existingCheckedItem.id}, merging amounts`);
          // Używamy metody update bezpośrednio na istniejącym elemencie
          await existingCheckedItem.update(record => {
            record.amount = existingCheckedItem.amount + this.amount;
          });
          
          await this.markAsDeleted();
          return;
        }else{
          await this.update(record => {
            record.isChecked = !this.isChecked;
          });
        }
      }

     catch (error) {
      console.error(`[DB ShoppingItem] Error toggling checked status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async updateWithParsing(text: string) {
    try {
      const parsed = parseIngredient(text);
      console.log(`[DB ShoppingItem] Updating item ${this.id} with parsed text: "${text}" -> name=${parsed.name}, amount=${parsed.amount}, unit=${parsed.unit}`);
      
      // Sprawdzamy czy istnieje już taki sam element (inny niż ten)
      const existingItem = await ShoppingItem.getByShoppingData(
        this.database,
        parsed.name,
        parsed.unit,
        this.isChecked
      );

      if (existingItem && existingItem.id !== this.id) {
        console.log(`[DB ShoppingItem] Found existing item ${existingItem.id}, merging amounts`);
        // Use update to update the amount of the existing item
        await existingItem.update(record => {
          record.amount = existingItem.amount + parsed.amount;
        });
        await this.markAsDeleted();
        return;
      }
      
      // Update this item with the parsed values
      await this.update(record => {
        record.name = parsed.name;
        record.amount = parsed.amount;
        record.unit = parsed.unit;
        record.type = null;
      });

      console.log(`[DB ShoppingItem] Successfully updated item ${this.id}`);
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating with parsed text: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Implementacja createFromSyncData dla klasy ShoppingItem
  static async createFromSyncData<T extends SyncModel>(
    this: typeof ShoppingItem,
    database: Database,
    deserializedData: Record<string, any>,
  ): Promise<T> {

    // Przygotuj argumenty dla ShoppingItem.create na podstawie deserializedData
    const name = deserializedData.name || 'Unnamed Item'; // Wymagane pole
    const amount = Number(deserializedData.amount) || 1; // Wymagane pole, domyślnie 1?
    const unit = deserializedData.unit || null;
    const isChecked = !!deserializedData.isChecked;
    const type = deserializedData.type || null;
    const syncId = deserializedData.syncId;
    // 'order' jest opcjonalne w ShoppingItem.create, pobierzmy je z danych, jeśli istnieje
    const order = deserializedData.order !== undefined ? Number(deserializedData.order) : undefined;

    // Przygotuj pola synchronizacji do przekazania
    const syncStatus: 'pending' | 'synced' | 'conflict' = 'synced';
    const isDeleted = !!deserializedData.isDeleted;
    let lastUpdate: Date | undefined = undefined;
    if ('lastUpdate' in deserializedData && deserializedData.lastUpdate) {
      try { lastUpdate = new Date(deserializedData.lastUpdate); } catch (e) { lastUpdate = new Date(); }
    } else {
      lastUpdate = new Date(); // Fallback
    }

    // Wywołaj istniejącą metodę ShoppingItem.create, przekazując wszystkie dane
    const newShoppingItem = await (ShoppingItem.create as any)(
      database,
      name,
      amount,
      unit,
      isChecked,
      type,
      order,
      // Przekaż pola synchronizacji jawnie
      syncId,
      syncStatus,
      lastUpdate,
      isDeleted
    );

    return newShoppingItem as unknown as T;
  }
} 