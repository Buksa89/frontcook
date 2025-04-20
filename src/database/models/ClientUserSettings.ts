import { Model } from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  writer
} from '@nozbe/watermelondb/decorators';

export default class ClientUserSettings extends Model {
  static table = 'client_user_settings';

  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('language') language!: string;

  // TODO: Dodać metody statyczne i instancyjne później
}