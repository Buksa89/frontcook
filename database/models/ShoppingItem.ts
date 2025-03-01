import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'
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

    return items.length > 0 ? items[0] : null
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
    const normalizedName = name.toLowerCase()
    const existingItem = forceCreate ? null : await this.findExisting(database, normalizedName, unit, isChecked)
    const finalAmount = amount ?? 1

    return await database.write(async () => {
      if (existingItem && !forceCreate) {
        // Jeśli element istnieje i nie wymuszamy utworzenia nowego, aktualizujemy ilość
        await existingItem.update(record => {
          record.amount = (record.amount || 0) + finalAmount
        })
        return existingItem
      } else {
        // Jeśli element nie istnieje lub wymuszamy utworzenie nowego
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
  }
} 