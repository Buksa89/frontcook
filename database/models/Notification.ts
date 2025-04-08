import { field, text, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { Database } from '@nozbe/watermelondb'
import { Observable } from 'rxjs'
import SyncModel from './SyncModel'
import AuthService from '../../app/services/auth/authService'
import { v4 as uuidv4 } from 'uuid'
import { map } from 'rxjs/operators'

export default class Notification extends SyncModel {
  static table = 'notifications'

  // Fields specific to Notification
  @text('content') content!: string
  @text('type') type!: string // 'warn' or 'info'
  @text('link') link!: string | null
  @field('is_readed') isReaded!: boolean
  @field('order') order!: number
    
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

  // Get the next order value (highest existing order + 1)
  static async getNextOrder(database: Database): Promise<number> {
    try {
      const activeUser = await AuthService.getActiveUser();
      
      // Query to get the notification with the highest order
      const notifications = await database
        .get<Notification>('notifications')
        .query(
          Q.and(
            Q.where('owner', activeUser),
            Q.where('is_deleted', false)
          ),
          Q.sortBy('order', Q.desc),
          Q.take(1)
        )
        .fetch();
      
      // If no notifications exist, start with order 0
      const maxOrder = notifications.length > 0 ? notifications[0].order : 0;
      
      // Return the next order value
      return maxOrder + 1;
    } catch (error) {
      console.error(`[DB Notification] Error getting next order value: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Return a fallback value in case of error
      return Date.now(); // Use timestamp as fallback to ensure uniqueness
    }
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
      
      // Process updates using markAsRead method
      for (const notification of unreadNotifications) {
        await notification.markAsRead();
      }
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
      
      // Process updates in batches using update method and markAsDeleted
      for (const notification of readNotifications) {
        await notification.markAsDeleted();
      }
    } catch (error) {
      console.error(`[DB Notification] Error deleting read notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  static async create(
    database: Database,
    content: string,
    type: string,
    isReaded?: boolean,
    link?: string,
    order?: number,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: Date,
    isDeleted?: boolean
  ): Promise<Notification> {
    // If no order is provided, get the next available order
    if (order === undefined) {
      order = await this.getNextOrder(database);
    }
    
    // Use the parent SyncModel.create method which will handle all common fields
    return await SyncModel.create.call(
      this as unknown as (new () => SyncModel) & typeof SyncModel,
      database,
      (record: SyncModel) => {
        const notification = record as Notification;
        
        // Set notification-specific fields
        notification.content = content;
        notification.type = type;
        notification.link = link || null;
        notification.isReaded = isReaded ?? false;
        notification.order = order as number;
        
        // Set optional SyncModel fields if provided
        if (syncId !== undefined) notification.syncId = syncId;
        if (syncStatusField !== undefined) notification.syncStatusField = syncStatusField;
        if (lastUpdate !== undefined) notification.lastUpdate = lastUpdate;
        if (isDeleted !== undefined) notification.isDeleted = isDeleted;
      }
    ) as Notification;
  }

  // Implementacja createFromSyncData dla klasy Notification
  static async createFromSyncData<T extends SyncModel>(
    this: typeof Notification,
    database: Database,
    deserializedData: Record<string, any>,
  ): Promise<T> {
    const syncId = deserializedData.syncId;

    // Przygotuj argumenty dla Notification.create na podstawie deserializedData
    const content = deserializedData.content || 'No content'; // Wymagane pole
    const type = deserializedData.type || 'info'; // Wymagane pole, domyślnie 'info'?
    const isReaded = !!deserializedData.isReaded;
    const link = deserializedData.link || null;
    // 'order' jest opcjonalne w Notification.create, pobierzmy je z danych, jeśli istnieje
    const order = deserializedData.order !== undefined ? Number(deserializedData.order) : undefined;

    // Przygotuj pola synchronizacji do przekazania
    const syncStatus: 'pending' | 'synced' | 'conflict' = 'synced';
    const isDeleted = !!deserializedData.isDeleted;
    let lastUpdate: Date | undefined = undefined;
    if ('lastUpdate' in deserializedData && deserializedData.lastUpdate) {
      try { lastUpdate = new Date(deserializedData.lastUpdate); } catch (e) { lastUpdate = new Date(); }
    } else {
      lastUpdate = new Date(); // Fallback
    }

    // Wywołaj istniejącą metodę Notification.create, przekazując wszystkie dane
    const newNotification = await (Notification.create as any)(
      database,
      content,
      type,
      isReaded,
      link,
      order,
      // Przekaż pola synchronizacji jawnie
      syncId,
      syncStatus,
      lastUpdate,
      isDeleted
    );

    return newNotification as unknown as T;
  }

  async markAsRead() {
    try {
      console.log(`[DB Notification] Marking notification ${this.id} as read`);
      
      // Use the instance update method
      await this.update(record => {
        record.isReaded = true;
      });
    } catch (error) {
      console.error(`[DB Notification] Error marking notification as read: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 