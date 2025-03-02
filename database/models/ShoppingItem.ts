import { Model } from '@nozbe/watermelondb'
import { field, text, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'

export default class ShoppingItem extends Model {
  static table = 'shopping_items'

  @field('remote_id') remoteId!: string | null
  @field('amount') amount!: number | null
  @text('unit') unit!: string | null
  @text('name') name!: string
  @text('type') type!: string | null
  @field('order') order!: number
  @field('is_checked') isChecked!: boolean

  // Helper method to find existing item with same name and unit
  static async findExisting(
    database: any,
    name: string,
    unit: string | null,
    isChecked: boolean
  ): Promise<ShoppingItem | null> {
    try {
      console.log(`[DB ShoppingItem] Searching for existing item: name=${name}, unit=${unit}, isChecked=${isChecked}`)
      const items = await database
        .get<ShoppingItem>('shopping_items')
        .query(
          Q.and(
            Q.where('name', Q.eq(name.toLowerCase())),
            Q.where('unit', Q.eq(unit)),
            Q.where('is_checked', Q.eq(isChecked))
          )
        )
        .fetch()

      if (items.length > 0) {
        console.log(`[DB ShoppingItem] Found existing item with id=${items[0].id}`)
      } else {
        console.log('[DB ShoppingItem] No existing item found')
      }
      return items.length > 0 ? items[0] : null
    } catch (error) {
      console.error('[DB ShoppingItem] Error finding existing item:', error)
      throw error
    }
  }

  // Helper method to create or update shopping item
  static async createOrUpdate(
    database: any,
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
      console.log(`[DB ShoppingItem] Creating/updating item: name=${name}, amount=${amount}, unit=${unit}, type=${type}, order=${order}, isChecked=${isChecked}, forceCreate=${forceCreate}`)
      
      const normalizedName = name.toLowerCase()
      const existingItem = forceCreate ? null : await this.findExisting(database, normalizedName, unit, isChecked)
      const finalAmount = amount ?? 1

      return await database.write(async () => {
        if (existingItem && !forceCreate) {
          console.log(`[DB ShoppingItem] Updating existing item ${existingItem.id}: amount from ${existingItem.amount} to ${(existingItem.amount || 0) + finalAmount}`)
          await existingItem.update(record => {
            record.amount = (record.amount || 0) + finalAmount
          })
          return existingItem
        } else {
          console.log(`[DB ShoppingItem] Creating new item: name=${normalizedName}, amount=${finalAmount}`)
          return await database.get<ShoppingItem>('shopping_items').create(record => {
            record.name = normalizedName
            record.amount = finalAmount
            record.unit = unit
            record.type = type
            record.order = order
            record.isChecked = isChecked
          })
        }
      })
    } catch (error) {
      console.error('[DB ShoppingItem] Error creating/updating item:', error)
      throw error
    }
  }

  @writer async updateAmount(newAmount: number | null) {
    try {
      console.log(`[DB ShoppingItem] Updating amount for item ${this.id}: ${this.amount} -> ${newAmount}`)
      await this.update(record => {
        record.amount = newAmount
      })
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating amount for item ${this.id}:`, error)
      throw error
    }
  }

  @writer async updateUnit(newUnit: string | null) {
    try {
      console.log(`[DB ShoppingItem] Updating unit for item ${this.id}: ${this.unit} -> ${newUnit}`)
      await this.update(record => {
        record.unit = newUnit
      })
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating unit for item ${this.id}:`, error)
      throw error
    }
  }

  @writer async updateName(newName: string) {
    try {
      console.log(`[DB ShoppingItem] Updating name for item ${this.id}: ${this.name} -> ${newName}`)
      await this.update(record => {
        record.name = newName.toLowerCase()
      })
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating name for item ${this.id}:`, error)
      throw error
    }
  }

  @writer async updateType(newType: string | null) {
    try {
      console.log(`[DB ShoppingItem] Updating type for item ${this.id}: ${this.type} -> ${newType}`)
      await this.update(record => {
        record.type = newType
      })
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating type for item ${this.id}:`, error)
      throw error
    }
  }

  @writer async updateOrder(newOrder: number) {
    try {
      console.log(`[DB ShoppingItem] Updating order for item ${this.id}: ${this.order} -> ${newOrder}`)
      await this.update(record => {
        record.order = newOrder
      })
    } catch (error) {
      console.error(`[DB ShoppingItem] Error updating order for item ${this.id}:`, error)
      throw error
    }
  }

  @writer async toggleChecked() {
    try {
      console.log(`[DB ShoppingItem] Toggling checked status for item ${this.id}: ${this.isChecked} -> ${!this.isChecked}`)
      await this.update(record => {
        record.isChecked = !record.isChecked
      })
    } catch (error) {
      console.error(`[DB ShoppingItem] Error toggling checked status for item ${this.id}:`, error)
      throw error
    }
  }
} 