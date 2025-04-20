import { Model } from '@nozbe/watermelondb';
import {
  field,
  text,
  writer,
  date
} from '@nozbe/watermelondb/decorators';

export default class Notification extends Model {
  static table = 'notifications';

  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('content') content!: string;
  @text('type') type!: string;
  @text('link') link?: string | null;
  @field('is_read') isRead!: boolean;
  @field('order') order!: number;

  // TODO: Dodać metody statyczne i instancyjne później
}