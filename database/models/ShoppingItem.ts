import { field, text, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { Database } from '@nozbe/watermelondb'
import { Observable } from 'rxjs'
import BaseModel from './BaseModel'
import { asyncStorageService } from '../../app/services/storage'
import { map } from 'rxjs/operators'

export default class ShoppingItem extends BaseModel {
  static table = 'shopping_items'

  @field('remote_id') remoteId!: string | null
  @field('amount') amount!: number | null
  @text('unit') unit!: string | null
  @text('name') name!: string
  @text('type') type!: string | null
  @field('order') order!: number
  @field('is_checked') isChecked!: boolean

  // Query methods
  static async observeAll(database: Database): Promise<Observable<ShoppingItem[]>> {
    const activeUser = await asyncStorageService.getActiveUser();
    return database
      .get<ShoppingItem>('shopping_items')
      .query(
        Q.where('owner', activeUser)
      )
      .observe()
      .pipe(map(items => items.sort((a, b) => a.order - b.order)));
  }

  static async observeUnchecked(database: Database): Promise<Observable<ShoppingItem[]>> {
    const activeUser = await asyncStorageService.getActiveUser();
    return database
      .get<ShoppingItem>('shopping_items')
      .query(
        Q.and(
          Q.where('owner', activeUser),
          Q.where('is_checked', false)
        )
      )
      .observe()
      .pipe(map(items => items.sort((a, b) => a.order - b.order)));
  }

  static async observeChecked(database: Database): Promise<Observable<ShoppingItem[]>> {
    const activeUser = await asyncStorageService.getActiveUser();
    return database
      .get<ShoppingItem>('shopping_items')
      .query(
        Q.and(
          Q.where('owner', activeUser),
          Q.where('is_checked', true)
        )
      )
      .observe()
      .pipe(map(items => items.sort((a, b) => b.order - a.order))); // Note: descending order for checked items
  }

  // Helper method to find existing item with same name and unit
  static async findExisting(
    database: Database,
    name: string,
    unit: string | null,
    isChecked: boolean
  ): Promise<ShoppingItem | null> {
    try {
      const activeUser = await asyncStorageService.getActiveUser();
      console.log(`[DB ShoppingItem] Searching for existing item: name=${name}, unit=${unit}, isChecked=${isChecked}, owner=${activeUser}`)
      
      const items = await database
        .get<ShoppingItem>('shopping_items')
        .query(
          Q.and(
            Q.where('owner', activeUser),
            Q.where('name', Q.eq(name.toLowerCase())),
            Q.where('unit', Q.eq(unit)),
            Q.where('is_checked', Q.eq(isChecked))
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

  // Create or update an item
  static async createOrUpdate(
    database: Database,
    {
      name,
      amount = 1,
      unit,
      type = null,
      order,
      isChecked = false
    }: {
      name: string
      amount?: number | null
      unit: string | null
      type?: string | null
      order: number
      isChecked?: boolean
    },
    forceCreate: boolean = false
  ): Promise<ShoppingItem> {
    try {
      const activeUser = await asyncStorageService.getActiveUser();
      const normalizedName = name.toLowerCase().trim()
      const finalAmount = amount === null ? 1 : amount

      // Try to find existing item if not forcing create
      let existingItem: ShoppingItem | null = null
      if (!forceCreate) {
        existingItem = await this.findExisting(database, normalizedName, unit, isChecked)
      }

      return await database.write(async () => {
        if (existingItem) {
          console.log(`[DB ShoppingItem] Updating existing item: ${existingItem.id}`)
          await existingItem.update(record => {
            record.amount = (record.amount || 0) + finalAmount
            record.syncStatus = 'pending'
            record.lastSync = new Date().toISOString()
            record.isLocal = true
          })
          return existingItem
        } else {
          console.log(`[DB ShoppingItem] Creating new item: name=${normalizedName}, amount=${finalAmount}, owner=${activeUser}`)
          return await database.get<ShoppingItem>('shopping_items').create(record => {
            record.name = normalizedName
            record.amount = finalAmount
            record.unit = unit
            record.type = type
            record.order = order
            record.isChecked = isChecked
            record.owner = activeUser
            record.syncStatus = 'pending'
            record.lastSync = new Date().toISOString()
            record.isLocal = true
          })
        }
      })
    } catch (error) {
      console.error(`[DB ShoppingItem] Error creating/updating item: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  @writer async updateAmount(newAmount: number | null) {
    try {
      console.log(`[DB ShoppingItem] Updating amount for item ${this.id}: ${this.amount} -> ${newAmount}`)
      await this.update(record => {
        record.amount = newAmount
        record.syncStatus = 'pending'
        record.lastSync = new Date().toISOString()
        record.isLocal = true
      })
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating amount: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  @writer async updateUnit(newUnit: string | null) {
    try {
      console.log(`[DB ShoppingItem] Updating unit for item ${this.id}: ${this.unit} -> ${newUnit}`)
      await this.update(record => {
        record.unit = newUnit
        record.syncStatus = 'pending'
        record.lastSync = new Date().toISOString()
        record.isLocal = true
      })
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating unit: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  @writer async updateName(newName: string) {
    try {
      console.log(`[DB ShoppingItem] Updating name for item ${this.id}: ${this.name} -> ${newName}`)
      await this.update(record => {
        record.name = newName.toLowerCase().trim()
        record.syncStatus = 'pending'
        record.lastSync = new Date().toISOString()
        record.isLocal = true
      })
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating name: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  @writer async updateType(newType: string | null) {
    try {
      console.log(`[DB ShoppingItem] Updating type for item ${this.id}: ${this.type} -> ${newType}`)
      await this.update(record => {
        record.type = newType
        record.syncStatus = 'pending'
        record.lastSync = new Date().toISOString()
        record.isLocal = true
      })
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating type: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  @writer async updateOrder(newOrder: number) {
    try {
      console.log(`[DB ShoppingItem] Updating order for item ${this.id}: ${this.order} -> ${newOrder}`)
      await this.update(record => {
        record.order = newOrder
        record.syncStatus = 'pending'
        record.lastSync = new Date().toISOString()
        record.isLocal = true
      })
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating order: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  @writer async toggleChecked() {
    try {
      console.log(`[DB ShoppingItem] Toggling checked status for item ${this.id}: ${this.isChecked} -> ${!this.isChecked}`)
      await this.update(record => {
        record.isChecked = !record.isChecked
        record.syncStatus = 'pending'
        record.lastSync = new Date().toISOString()
        record.isLocal = true
      })
    } catch (error) {
      console.error(`[DB ShoppingItem] Error toggling checked status: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }
} 