// src/database/models/Notification.ts
import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  writer,
  date
} from '@nozbe/watermelondb/decorators';
import type { Database, Collection, Model as WDBModel } from '@nozbe/watermelondb';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { getCurrentUserId } from '../../services/auth/authUserIdProvider';
// --- DODAJ IMPORT UUID ---
import { v4 as uuidv4 } from 'uuid';
// -----------------------

export default class Notification extends Model {
  static table = 'notifications';

  // --- Pola ---
  @field('user_id') userId!: string | null; // Oczekuje string | null
  @date('last_modified') lastModified!: number; // Oczekuje number (timestamp)
  @date('created_at') createdAt!: number;     // Oczekuje number (timestamp)
  @text('content') content!: string;
  @text('type') type!: string;
  @text('link') link?: string | null;
  @field('is_read') isRead!: boolean;
  @field('order') order!: number;

  // --- Metody Statyczne ---

  static observeAll(database: Database): Observable<Notification[]> {
    return from(getCurrentUserId()).pipe(
      switchMap(activeUserId => {
        if (!activeUserId) return of([]);
        // Użyj poprawnego userClause
        const userClause = activeUserId === null ? Q.where('user_id', null) : Q.where('user_id', activeUserId);
        return database.get<Notification>(this.table)
          .query(userClause) // Usunięto Q.where('user_id', activeUserId) bo jest w userClause
          .observe()
          .pipe( map(notifications => [...notifications].sort((a, b) => { if (a.isRead !== b.isRead) return a.isRead ? 1 : -1; return b.order - a.order; })) );
      })
    );
  }

  static observeUnread(database: Database): Observable<Notification[]> {
    return from(getCurrentUserId()).pipe(
      switchMap(activeUserId => {
        if (!activeUserId) return of([]);
        // Użyj poprawnego userClause
        const userClause = activeUserId === null ? Q.where('user_id', null) : Q.where('user_id', activeUserId);
        return database.get<Notification>(this.table)
          .query( userClause, Q.where('is_read', false), Q.sortBy('order', Q.desc) )
          .observe();
      })
    );
  }

  static async getNextOrder(database: Database, userId: string | null): Promise<number> {
    // Użyj poprawnego userClause
    const userClause = userId === null ? Q.where('user_id', null) : Q.where('user_id', userId);
    try {
        const lastNotification = await database.get<Notification>(this.table)
            .query(userClause, Q.sortBy('order', Q.desc), Q.take(1)).fetch();
        return (lastNotification.length > 0 ? lastNotification[0].order : -1) + 1;
    } catch (error) {
        console.error(`[DB Notification] Błąd getNextOrder dla ${userId ?? 'null'}:`, error);
        return Date.now();
    }
  }

  static async markAllAsRead(database: Database, userId: string): Promise<void> {
     if (!userId) return;
     try {
       // Użyj poprawnego userClause
       const userClause = Q.where('user_id', userId);
       const unreadNotifications = await database.get<Notification>(this.table)
         .query(userClause, Q.where('is_read', false)).fetch();
       if (unreadNotifications.length === 0) { return; }
       console.log(`[DB Notification] Oznaczanie ${unreadNotifications.length} powiadomień jako przeczytane dla ${userId}...`);
       await database.write(async () => {
         await database.batch(...unreadNotifications.map(n => n.prepareMarkAsRead()));
       });
       console.log(`[DB Notification] Oznaczanie zakończone.`);
     } catch (error) {
       console.error(`[DB Notification] Błąd markAllAsRead dla ${userId}:`, error);
       throw error;
     }
  }

  static async deleteAllRead(database: Database, userId: string): Promise<void> {
    if (!userId) return;
    try {
      // Użyj poprawnego userClause
      const userClause = Q.where('user_id', userId);
      const readNotifications = await database.get<Notification>(this.table)
        .query(userClause, Q.where('is_read', true)).fetch();
      if (readNotifications.length === 0) { return; }
      console.log(`[DB Notification] Usuwanie ${readNotifications.length} przeczytanych powiadomień dla ${userId}...`);
      await database.write(async () => {
        await database.batch(...readNotifications.map(n => n.prepareDeleteNotification()));
      });
      console.log(`[DB Notification] Usuwanie zakończone.`);
    } catch (error) {
      console.error(`[DB Notification] Błąd deleteAllRead dla ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Tworzy nowe powiadomienie lokalnie z UUID.
   */
  static async createNotification(
      database: Database,
      data: { userId: string | null; content: string; type: string; link?: string | null; isRead?: boolean; }
  ): Promise<Notification> {
    const notificationsCollection = database.get<Notification>(this.table);
    const nextOrder = await this.getNextOrder(database, data.userId);
    // --- GENERUJ UUID ---
    const newId = uuidv4();
    // -------------------

    return database.write(async () => {
      const newNotification = await notificationsCollection.create(notification => {
        // --- PRZYPISZ UUID ---
        notification._raw.id = newId;
        // -------------------
        notification.userId = data.userId; // Przypisz string | null
        notification.content = data.content;
        notification.type = data.type;
        notification.link = data.link ?? null;
        notification.isRead = data.isRead ?? false;
        notification.order = nextOrder;
        // last_modified i created_at są zarządzane przez WatermelonDB/sync
      });
      console.log(`[DB Notification] Utworzono nowe powiadomienie lokalnie z UUID: ${newNotification.id}`);
      return newNotification;
    });
  }

  // --- Metody Instancji ---
  @writer async markAsRead() {
    if (!this.isRead) {
        await this.update(notification => { notification.isRead = true; });
        console.log(`[DB Notification] Oznaczono ${this.id} jako przeczytane.`);
    }
  }
  @writer async deleteNotification() {
      console.log(`[DB Notification] Oznaczanie powiadomienia ${this.id} jako usunięte.`);
      await this.markAsDeleted();
  }
   // --- Przygotowanie do batch ---
   prepareMarkAsRead(): Notification | null {
       if (this.isRead) return null;
       return this.prepareUpdate(notification => { notification.isRead = true; });
   }
   prepareDeleteNotification(): Notification {
       return this.prepareMarkAsDeleted();
   }
}