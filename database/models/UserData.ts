import { Model } from '@nozbe/watermelondb'
import { field, text, date } from '@nozbe/watermelondb/decorators'
import { Database } from '@nozbe/watermelondb'
import { Q } from '@nozbe/watermelondb'
import { Observable, from, of } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import AuthService from '../../app/services/auth/authService'

export default class UserData extends Model {
  static table = 'user_data'

  @text('user') user!: string
  @date('last_sync') lastSync!: Date | null
  @date('subscription_end') subscriptionEnd!: Date | null
  @text('csv_lock') csvLock!: string | null

  static async create(
    database: Database,
    user: string,
    lastSync: Date | null = null,
    subscriptionEnd: Date | null = null,
    csvLock: string | null = null
  ): Promise<UserData> {
    console.log(`[DB UserData] Creating user data for user: ${user}`);
    
    try {
      return await database.write(async () => {
        const record = await database.get<UserData>(this.table).create(userData => {
          userData.user = user;
          userData.lastSync = lastSync;
          userData.subscriptionEnd = subscriptionEnd;
          userData.csvLock = csvLock;
        });
        
        console.log(`[DB UserData] Created user data record: ${record.id}`);
        return record;
      });
    } catch (error) {
      console.error(`[DB UserData] Error creating user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  static async update(
    database: Database,
    record: UserData,
    lastSync?: Date | null,
    subscriptionEnd?: Date | null,
    csvLock?: string | null
  ): Promise<UserData> {
    console.log(`[DB UserData] Updating user data for record: ${record.id}`);
    
    try {
      await database.write(async () => {
        await record.update(userData => {
          if (lastSync !== undefined) userData.lastSync = lastSync;
          if (subscriptionEnd !== undefined) userData.subscriptionEnd = subscriptionEnd;
          if (csvLock !== undefined) userData.csvLock = csvLock;
        });
      });
      
      console.log(`[DB UserData] Updated user data record: ${record.id}`);
      return record;
    } catch (error) {
      console.error(`[DB UserData] Error updating user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  static async getUserData(database: Database): Promise<UserData> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      if (!activeUser) {
        throw new Error('No active user found');
      }
      
      console.log(`[DB UserData] Getting user data for active user: ${activeUser}`);
      
      const records = await database.get<UserData>('user_data')
        .query(Q.where('user', activeUser))
        .fetch();
      
      if (records.length > 0) {
        console.log(`[DB UserData] Found existing user data record: ${records[0].id}`);
        return records[0];
      } else {
        console.log(`[DB UserData] No user data found, creating new record for user: ${activeUser}`);
        return await this.create(database, activeUser);
      }
    } catch (error) {
      console.error(`[DB UserData] Error getting user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  static observeSubscriptionStatus(database: Database): Observable<{ isActive: boolean, endDate: Date | null }> {
    return new Observable<{ isActive: boolean, endDate: Date | null }>(subscriber => {
      let subscription: any;
      
      AuthService.getActiveUser().then(activeUser => {
        if (!activeUser) {
          subscriber.next({ isActive: false, endDate: null });
          return;
        }
        
        subscription = database
          .get<UserData>('user_data')
          .query(Q.where('user', activeUser))
          .observe()
          .pipe(
            map(records => {
              const endDate = records[0]?.subscriptionEnd || null;
              const now = new Date();
              return { 
                isActive: endDate ? endDate.getTime() > now.getTime() : false, 
                endDate 
              };
            })
          )
          .subscribe(subscriber);
      });
      
      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    });
  }

  static observeForUser(database: Database, user: string): Observable<UserData | null> {
    return database.get<UserData>('user_data')
      .query(Q.where('user', user))
      .observe()
      .pipe(map(records => records[0] || null))
  }

  static async getLastSyncByUser(database: Database, user: string) {
    const records = await database.get<UserData>('user_data')
      .query(Q.where('user', user))
      .fetch()

    return records[0]?.lastSync?.toISOString() || new Date(0).toISOString()
  }

  static async updateLastSyncByUser(database: Database, user: string, timestamp: string) {
    console.log(`[DB UserData] Updating last sync for user: ${user} to ${timestamp}`);
    
    try {
      const records = await database.get<UserData>('user_data')
        .query(Q.where('user', user))
        .fetch();

      if (records.length > 0) {
        await this.update(database, records[0], new Date(timestamp));
      } else {
        await this.create(database, user, new Date(timestamp));
      }
      
      console.log(`[DB UserData] Successfully updated last sync for user: ${user}`);
    } catch (error) {
      console.error(`[DB UserData] Error updating last sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  static async updateSubscriptionData(database: Database, user: string, subscriptionEnd: string | null, csvLock: string | null) {
    console.log(`[DB UserData] Updating subscription data for user: ${user}`);
    
    try {
      const records = await database.get<UserData>('user_data')
        .query(Q.where('user', user))
        .fetch();

      if (records.length > 0) {
        await this.update(
          database, 
          records[0], 
          undefined, // lastSync - keep existing
          subscriptionEnd ? new Date(subscriptionEnd) : null,
          csvLock
        );
      } else {
        await this.create(
          database,
          user,
          null, // lastSync
          subscriptionEnd ? new Date(subscriptionEnd) : null,
          csvLock
        );
      }
      
      console.log(`[DB UserData] Successfully updated subscription data for user: ${user}`);
    } catch (error) {
      console.error(`[DB UserData] Error updating subscription data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  static async getSubscriptionDataByUser(database: Database, user: string) {
    try {
      console.log(`[DB UserData] Getting subscription data for user: ${user}`);
      const records = await database.get<UserData>('user_data')
        .query(Q.where('user', user))
        .fetch();

      const record = records[0];
      const result = {
        subscriptionEnd: record?.subscriptionEnd || null,
        csvLock: record?.csvLock || null,
        isSubscriptionActive: record?.subscriptionEnd ? record.subscriptionEnd.getTime() > Date.now() : false
      };
      
      console.log(`[DB UserData] Subscription data for user ${user}: isActive=${result.isSubscriptionActive}, endDate=${result.subscriptionEnd?.toISOString() || 'null'}`);
      return result;
    } catch (error) {
      console.error(`[DB UserData] Error getting subscription data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}
