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
    await database.write(async () => {
      const records = await database.get<UserData>('user_data')
        .query(Q.where('user', user))
        .fetch()

      if (records.length > 0) {
        await records[0].update(record => { record.lastSync = new Date(timestamp) })
      } else {
        await database.get<UserData>('user_data').create(record => {
          record.user = user
          record.lastSync = new Date(timestamp)
        })
      }
    })
  }

  static async updateSubscriptionData(database: Database, user: string, subscriptionEnd: string | null, csvLock: string | null) {
    await database.write(async () => {
      const records = await database.get<UserData>('user_data')
        .query(Q.where('user', user))
        .fetch()

      if (records.length > 0) {
        await records[0].update(record => {
          record.subscriptionEnd = subscriptionEnd ? new Date(subscriptionEnd) : null
          record.csvLock = csvLock
        })
      } else {
        await database.get<UserData>('user_data').create(record => {
          record.user = user
          record.lastSync = null
          record.subscriptionEnd = subscriptionEnd ? new Date(subscriptionEnd) : null
          record.csvLock = csvLock
        })
      }
    })
  }

  static async getSubscriptionDataByUser(database: Database, user: string) {
    const records = await database.get<UserData>('user_data')
      .query(Q.where('user', user))
      .fetch()

    const record = records[0]
    return {
      subscriptionEnd: record?.subscriptionEnd || null,
      csvLock: record?.csvLock || null,
      isSubscriptionActive: record?.subscriptionEnd ? record.subscriptionEnd.getTime() > Date.now() : false
    }
  }
}
