import { Model } from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  writer
} from '@nozbe/watermelondb/decorators';

export default class ShoppingItem extends Model {
  static table = 'shopping_items';

  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('amount') amount?: string | null; // Zmieniono na text
  @text('unit') unit?: string | null;
  @text('name') name!: string;
  @text('type') type?: string | null;
  @field('order') order!: number;
  @field('is_checked') isChecked!: boolean;

  // TODO: Dodać metody statyczne i instancyjne później
}