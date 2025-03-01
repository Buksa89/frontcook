import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'

export default class ShoppingItem extends Model {
  static table = 'shopping_items'

  @field('remote_id') remoteId!: string | null
  @field('amount') amount!: number | null
  @text('unit') unit!: string | null
  @text('name') name!: string
  @text('type') type!: string | null
  @field('order') order!: number
  @field('is_checked') isChecked!: boolean
} 