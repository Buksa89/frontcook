import { field, text, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { Database } from '@nozbe/watermelondb'
import { Observable } from 'rxjs'
import BaseModel from './BaseModel'
import AuthService from '../../app/services/auth/authService'
import { map } from 'rxjs/operators'
import { parseIngredient } from '../../app/utils/ingredientParser'
import { v4 as uuidv4 } from 'uuid'

export default class ShoppingItem extends BaseModel {
  static table = 'shopping_items'

  // Fields specific to ShoppingItem
  @field('amount') amount!: number
  @text('unit') unit!: string | null
  @text('name') name!: string
  @text('type') type!: string | null
  @field('order') order!: number
  @field('is_checked') isChecked!: boolean
  
  // Helper method to get sync data for this shopping item
  getSyncData(): Record<string, any> {
    const baseData = super.getSyncData();
    return {
      ...baseData,
      object_type: 'shopping_item',
      name: this.name,
      amount: this.amount,
      unit: this.unit,
      type: this.type,
      order: this.order,
      is_checked: this.isChecked
    };
  }
  
  // Query methods
  static observeAll(database: Database): Observable<ShoppingItem[]> {
    return new Observable<ShoppingItem[]>(subscriber => {
      let subscription: any;
      
      AuthService.getActiveUser().then(activeUser => {
        subscription = database
          .get<ShoppingItem>('shopping_items')
          .query(
            Q.and(
              Q.where('owner', activeUser),
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

  static async createOrUpdate(
    database: Database,
    text: string
  ): Promise<ShoppingItem> {
    return await database.write(async () => {
      try {
        const parsed = parseIngredient(text);
        console.log(`[DB ShoppingItem] Creating/updating item from text: "${text}" -> name=${parsed.name}, amount=${parsed.amount}, unit=${parsed.unit}`);

        const existingItem = await this.findExisting(
          database,
          parsed.name,
          parsed.unit,
          false
        );

        if (existingItem) {
          console.log(`[DB ShoppingItem] Found existing item: ${existingItem.id}, adding amount: ${parsed.amount}`);
          
          // Używamy prepareUpdate zamiast bezpośredniego wywołania update
          await database.batch(
            existingItem.prepareUpdate(record => {
              record.amount = record.amount + parsed.amount;
            })
          );
          
          console.log(`[DB ShoppingItem] Successfully updated item ${existingItem.id}, new amount: ${existingItem.amount}`);
          return existingItem;
        } else {
          const lastItem = await database
            .get<ShoppingItem>('shopping_items')
            .query(
              Q.where('is_deleted', false),
              Q.sortBy('order', Q.desc),
              Q.take(1)
            )
            .fetch();
          
          const maxOrder = lastItem.length > 0 ? lastItem[0].order : -1;
          const activeUser = await AuthService.getActiveUser();
          
          return await database.get<ShoppingItem>('shopping_items').create((record: ShoppingItem) => {
            // Initialize base fields
            record.syncStatus = 'pending';
            record.lastUpdate = new Date().toISOString();
            record.isDeleted = false;
            record.syncId = uuidv4();
            record.owner = activeUser;
            
            // Set shopping item specific fields
            record.name = parsed.name;
            record.amount = parsed.amount;
            record.unit = parsed.unit;
            record.type = null;
            record.order = maxOrder + 1;
            record.isChecked = false;
          });
        }
      } catch (error) {
        console.error(`[DB ShoppingItem] Error creating/updating item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    });
  }

  @writer async toggleChecked() {
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
          // Sumujemy ilości - używamy callWriter aby uniknąć zagnieżdżonych operacji writer
          await this.callWriter(() => 
            existingCheckedItem.update(record => {
              record.amount = record.amount + this.amount;
            })
          );
          // Usuwamy obecny element - używamy callWriter aby uniknąć zagnieżdżonych operacji writer
          await this.callWriter(() => this.markAsDeleted());
          return;
        }
      }

      console.log(`[DB ShoppingItem] Toggling checked status for item ${this.id}: ${this.isChecked} -> ${!this.isChecked}`);
      // Używamy callWriter aby uniknąć zagnieżdżonych operacji writer
      await this.callWriter(() => 
        this.update(record => {
          record.isChecked = !record.isChecked;
        })
      );
    } catch (error) {
      console.error(`[DB ShoppingItem] Error toggling checked status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  @writer async updateWithParsing(text: string) {
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
        // Sumujemy ilości - używamy callWriter aby uniknąć zagnieżdżonych operacji writer
        await this.callWriter(() => 
          existingItem.update(record => {
            record.amount = record.amount + parsed.amount;
          })
        );
        // Usuwamy obecny element - używamy callWriter aby uniknąć zagnieżdżonych operacji writer
        await this.callWriter(() => this.markAsDeleted());
        return;
      }
      
      // Używamy callWriter aby uniknąć zagnieżdżonych operacji writer
      await this.callWriter(() => 
        this.update(record => {
          record.name = parsed.name;
          record.amount = parsed.amount;
          record.unit = parsed.unit;
          record.type = null;
        })
      );

      console.log(`[DB ShoppingItem] Successfully updated item ${this.id}`);
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating with parsed text: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 