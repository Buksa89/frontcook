import { Model } from '@nozbe/watermelondb';
import { field, date, text } from '@nozbe/watermelondb/decorators'; // Dodano text

export default class UserProfile extends Model {
  static table = 'user_profile';

  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  // Zmieniono na text zgodnie ze schematem
  @text('subscription_end') subscriptionEnd?: string | null;
  @text('csv_lock') csvLock?: string | null;

  // TODO: Dodać metody statyczne (observeSubscriptionStatus) później
}