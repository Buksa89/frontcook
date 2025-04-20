// src/database/models/Notification.ts

import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  writer,
  date
} from '@nozbe/watermelondb/decorators';
import type { Database } from '@nozbe/watermelondb'; // Importuj Database
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import AuthService from '../../app/services/auth/authService';

// --- NOWA IMPLEMENTACJA ---

export class Notification extends Model {
  static table = 'notifications'; // Standardowa definicja

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  // @date('created_at') createdAt!: number; // Opcjonalne
  @text('content') content!: string;
  @text('type') type!: string;
  @text('link') link?: string | null; // Używamy ? i null
  @field('is_read') isRead!: boolean; // Poprawiony dekorator
  @field('order') order!: number;

  // --- Metody Statyczne ---
  static observeAll(database: Database): Observable<Notification[]> {
     // Użyj getActiveUserId zamiast getActiveUser
    return from(AuthService.getActiveUserId()).pipe(
        switchMap(activeUserId => {
          if (!activeUserId) return of([]);
          return database.get<Notification>(this.table)
            .query(Q.where('user_id', activeUserId))
            .observe()
            .pipe(
              map(notifications =>
                notifications.sort((a, b) => { /* ... logika sortowania ... */
                    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
                    return b.order - a.order;
                })
              )
            );
        })
      );
  }

  static observeUnread(database: Database): Observable<Notification[]> {
    // Użyj getActiveUserId
    return from(AuthService.getActiveUserId()).pipe(
        switchMap(activeUserId => {
          if (!activeUserId) return of([]);
          return database.get<Notification>(this.table)
            .query(Q.where('user_id', activeUserId), Q.where('is_read', false), Q.sortBy('order', Q.desc))
            .observe();
          // Usunięto sortowanie w map, bo jest w query
        })
      );
  }

  static async getNextOrder(database: Database, userId: string): Promise<number> {
      // ... (bez zmian w logice)
      if (!userId) { console.error("[DB Notification] Brak userId..."); return Date.now(); }
      try {
        const lastNotification = await database.get<Notification>(this.table)
          .query(Q.where('user_id', userId), Q.sortBy('order', Q.desc), Q.take(1)).fetch();
        const maxOrder = lastNotification.length > 0 ? lastNotification[0].order : -1;
        return maxOrder + 1;
      } catch (error) { console.error(`[DB Notification] Błąd getNextOrder dla ${userId}: ${error}`); return Date.now(); }
  }

  static async markAllAsRead(database: Database, userId: string): Promise<void> {
       // ... (bez zmian w logice)
       if (!userId) return;
       try {
         const unreadNotifications = await database.get<Notification>(this.table)
           .query(Q.where('user_id', userId), Q.where('is_read', false)).fetch();
         if (unreadNotifications.length === 0) return;
         console.log(`[DB Notification] Oznaczanie ${unreadNotifications.length} jako przeczytane...`);
         await database.write(async () => {
           await database.batch(...unreadNotifications.map(n => n.prepareMarkAsRead())); // Użyj prepareMarkAsRead dla batch
         });
       } catch (error) { console.error(`[DB Notification] Błąd markAllAsRead: ${error}`); throw error; }
  }

  static async deleteAllRead(database: Database, userId: string): Promise<void> {
      // ... (bez zmian w logice)
      if (!userId) return;
      try {
        const readNotifications = await database.get<Notification>(this.table)
          .query(Q.where('user_id', userId), Q.where('is_read', true)).fetch();
        if (readNotifications.length === 0) return;
        console.log(`[DB Notification] Usuwanie ${readNotifications.length} przeczytanych...`);
        await database.write(async () => {
          await database.batch(...readNotifications.map(n => n.prepareDeleteNotification())); // Użyj prepare dla batch
        });
      } catch (error) { console.error(`[DB Notification] Błąd deleteAllRead: ${error}`); throw error; }
  }

  static async createNotification(database: Database, data: { userId: string; content: string; type: string; link?: string | null; isRead?: boolean; }): Promise<Notification> {
      // ... (bez zmian w logice)
      const notificationsCollection = database.get<Notification>(this.table);
      const nextOrder = await this.getNextOrder(database, data.userId);
      const newNotification = await database.write(async () => {
        return await notificationsCollection.create(notification => {
          notification.userId = data.userId;
          notification.content = data.content;
          notification.type = data.type;
          notification.link = data.link ?? null; // Użyj ?? null
          notification.isRead = data.isRead ?? false;
          notification.order = nextOrder;
        });
      });
      console.log(`[DB Notification] Utworzono nowe powiadomienie lokalnie: ${newNotification.id}`);
      return newNotification;
  }

  // --- Metody Instancji ---
  @writer async markAsRead() {
    // ... (bez zmian w logice)
    if (!this.isRead) {
        await this.update(notification => { notification.isRead = true; });
        console.log(`[DB Notification] Oznaczono ${this.id} jako przeczytane.`);
      }
  }

  @writer async deleteNotification() {
      // ... (bez zmian w logice)
      console.log(`[DB Notification] Oznaczanie ${this.id} jako usunięte.`);
      await this.markAsDeleted();
  }

   // --- Przygotowanie do batch (dodane) ---
   prepareMarkAsRead(): Notification {
      return this.prepareUpdate(notification => {
         if (!notification.isRead) {
             notification.isRead = true;
         }
      });
   }

   prepareDeleteNotification(): Notification {
       return this.prepareMarkAsDeleted();
   }

}

export default Notification;