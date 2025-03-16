import { field, text, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { Database } from '@nozbe/watermelondb'
import { Observable } from 'rxjs'
import BaseModel from './BaseModel'
import AuthService from '../../app/services/auth/authService'
import { v4 as uuidv4 } from 'uuid'
import { map } from 'rxjs/operators'

export default class Notification extends BaseModel {
  static table = 'notifications'

  // Fields specific to Notification
  @text('content') content!: string
  @text('type') type!: string // 'warn' or 'info'
  @text('link') link!: string | null
  @field('is_readed') isReaded!: boolean
  @field('order') order!: number
  
  // Helper method to get sync data for this notification
  getSyncData(): Record<string, any> {
    const baseData = super.getSyncData();
    return {
      ...baseData,
      object_type: 'notification',
      content: this.content,
      type: this.type,
      link: this.link,
      is_readed: this.isReaded,
      order: this.order
    };
  }
  
  // Query methods
  static observeAll(database: Database): Observable<Notification[]> {
    return new Observable<Notification[]>(subscriber => {
      let subscription: any;
      
      AuthService.getActiveUser().then(activeUser => {
        subscription = database
          .get<Notification>('notifications')
          .query(
            Q.and(
              Q.where('owner', activeUser),
              Q.where('is_deleted', false)
            )
          )
          .observe()
          .pipe(
            map(notifications => 
              // Najpierw sortujemy po statusie przeczytania (nieprzeczytane na górze)
              notifications.sort((a, b) => {
                // Jeśli jeden jest przeczytany a drugi nie, nieprzeczytany idzie na górę
                if (a.isReaded !== b.isReaded) {
                  return a.isReaded ? 1 : -1;
                }
                // Jeśli oba mają ten sam status przeczytania, sortujemy po order (malejąco)
                return b.order - a.order;
              })
            )
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

  static observeUnread(database: Database): Observable<Notification[]> {
    return new Observable<Notification[]>(subscriber => {
      let subscription: any;
      
      AuthService.getActiveUser().then(activeUser => {
        subscription = database
          .get<Notification>('notifications')
          .query(
            Q.and(
              Q.where('owner', activeUser),
              Q.where('is_readed', false),
              Q.where('is_deleted', false)
            )
          )
          .observe()
          .pipe(
            map(notifications => notifications.sort((a, b) => b.order - a.order))
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

  // Helper method to mark all notifications as read
  static async markAllAsRead(database: Database): Promise<void> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      const unreadNotifications = await database
        .get<Notification>('notifications')
        .query(
          Q.and(
            Q.where('owner', activeUser),
            Q.where('is_readed', false),
            Q.where('is_deleted', false)
          )
        )
        .fetch();
      
      if (unreadNotifications.length === 0) {
        return;
      }
      
      console.log(`[DB Notification] Marking ${unreadNotifications.length} notifications as read`);
      
      await database.write(async () => {
        const updates = unreadNotifications.map(notification => 
          notification.prepareUpdate(record => {
            record.isReaded = true;
          })
        );
        
        await database.batch(...updates);
      });
    } catch (error) {
      console.error(`[DB Notification] Error marking all notifications as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Helper method to delete all read notifications
  static async deleteAllRead(database: Database): Promise<void> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      const readNotifications = await database
        .get<Notification>('notifications')
        .query(
          Q.and(
            Q.where('owner', activeUser),
            Q.where('is_readed', true),
            Q.where('is_deleted', false)
          )
        )
        .fetch();
      
      if (readNotifications.length === 0) {
        return;
      }
      
      console.log(`[DB Notification] Deleting ${readNotifications.length} read notifications`);
      
      await database.write(async () => {
        const updates = readNotifications.map(notification => 
          notification.prepareUpdate(record => {
            record.isDeleted = true;
            record.syncStatus = 'pending';
            record.lastUpdate = new Date().toISOString();
          })
        );
        
        await database.batch(...updates);
      });
    } catch (error) {
      console.error(`[DB Notification] Error deleting read notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Metoda do tworzenia powiadomień
  static async createNotification(
    database: Database,
    content: string,
    type: 'warn' | 'info',
    link?: string
  ): Promise<Notification> {
    return await database.write(async () => {
      try {
        console.log(`[DB Notification] Creating notification: content=${content}, type=${type}, link=${link || 'null'}`);
        
        const activeUser = await AuthService.getActiveUser();
        
        return await database.get<Notification>('notifications').create((record: Notification) => {
          // Initialize base fields
          record.syncStatus = 'pending';
          record.lastUpdate = new Date().toISOString();
          record.isDeleted = false;
          record.syncId = uuidv4();
          record.owner = activeUser;
          
          // Set notification specific fields
          record.content = content;
          record.type = type;
          record.link = link || null;
          record.isReaded = false;
          record.order = Date.now(); // Używamy timestamp jako order, nowsze powiadomienia będą miały wyższy order
        });
      } catch (error) {
        console.error(`[DB Notification] Error creating notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    });
  }

  @writer async markAsRead() {
    try {
      console.log(`[DB Notification] Marking notification ${this.id} as read`);
      
      await this.callWriter(() => 
        this.update(record => {
          record.isReaded = true;
        })
      );
    } catch (error) {
      console.error(`[DB Notification] Error marking notification as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  @writer async markAsUnread() {
    try {
      console.log(`[DB Notification] Marking notification ${this.id} as unread`);
      
      await this.callWriter(() => 
        this.update(record => {
          record.isReaded = false;
        })
      );
    } catch (error) {
      console.error(`[DB Notification] Error marking notification as unread: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 