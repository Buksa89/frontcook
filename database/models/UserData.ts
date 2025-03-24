import { Model } from '@nozbe/watermelondb'
import { field, text, date, writer } from '@nozbe/watermelondb/decorators'
import { Database } from '@nozbe/watermelondb'
import { Q } from '@nozbe/watermelondb'

/**
 * UserData model stores user-specific data like last sync timestamp.
 * This model does NOT inherit from BaseModel to avoid circular issues with sync functionality.
 */
export default class UserData extends Model {
  static table = 'user_data'

  @text('user') user!: string
  @date('last_sync') lastSync!: Date | null

  /**
   * Get the last sync timestamp for a specific user
   * @param database Database instance
   * @param user User identifier
   * @returns ISO string timestamp of last sync or epoch time 0 if not set
   */
  static async getLastSyncByUser(database: Database, user: string): Promise<string> {
    try {
      // Try to find existing record for this user
      const userData = await database
        .get<UserData>('user_data')
        .query(Q.where('user', user))
        .fetch();
      
      if (userData.length > 0 && userData[0].lastSync) {
        console.log(`[DB UserData] Retrieved last sync for user: ${user}`, userData[0].lastSync.toISOString());
        return userData[0].lastSync.toISOString();
      }
      
      // If no record or no lastSync, return epoch time 0
      console.log(`[DB UserData] No last sync found for user: ${user}, returning epoch time 0`);
      return new Date(0).toISOString();
    } catch (error) {
      console.error(`[DB UserData] Error getting last sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return new Date(0).toISOString();
    }
  }

  /**
   * Update the last sync timestamp for a user
   * @param database Database instance
   * @param user User identifier
   * @param timestamp ISO string timestamp
   */
  static async updateLastSyncByUser(database: Database, user: string, timestamp: string): Promise<void> {
    try {
      // Try to find existing record for this user
      const userData = await database
        .get<UserData>('user_data')
        .query(Q.where('user', user))
        .fetch();
      
      if (userData.length > 0) {
        // Update existing record
        await database.write(async () => {
          await userData[0].update((record) => {
            record.lastSync = new Date(timestamp);
          });
        });
        console.log(`[DB UserData] Updated last sync for user: ${user}`, timestamp);
      } else {
        // Create new record
        await database.write(async () => {
          await database.get<UserData>('user_data').create((record) => {
            record.user = user;
            record.lastSync = new Date(timestamp);
          });
        });
        console.log(`[DB UserData] Created new data with last sync for user: ${user}`, timestamp);
      }
    } catch (error) {
      console.error(`[DB UserData] Error updating last sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 