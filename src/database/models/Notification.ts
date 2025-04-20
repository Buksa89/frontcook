// src/database/models/Notification.ts
import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  writer,
  date
} from '@nozbe/watermelondb/decorators';
import type { Database, Collection, Model as WDBModel } from '@nozbe/watermelondb'; // Dodano WDBModel
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { getCurrentUserId } from '../../services/auth/authUserIdProvider'; // ZMIANA IMPORTU

export default class Notification extends Model {
  static table = 'notifications';

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('content') content!: string;
  @text('type') type!: string;
  @text('link') link?: string | null;
  @field('is_read') isRead!: boolean;
  @field('order') order!: number;

  // --- Metody Statyczne ---

  static observeAll(database: Database): Observable<Notification[]> {
    // Używamy nowej funkcji
    return from(getCurrentUserId()).pipe( // ZMIANA WYWOŁANIA
      switchMap(activeUserId => {
        if (!activeUserId) return of([]);
        return database.get<Notification>(this.table)
          .query(Q.where('user_id', activeUserId))
          .observe()
          .pipe( map(notifications => [...notifications].sort((a, b) => { /* ... logika sortowania ... */ if (a.isRead !== b.isRead) return a.isRead ? 1 : -1; return b.order - a.order; })) );
      })
    );
  }

  static observeUnread(database: Database): Observable<Notification[]> {
    // Używamy nowej funkcji
    return from(getCurrentUserId()).pipe( // ZMIANA WYWOŁANIA
      switchMap(activeUserId => {
        if (!activeUserId) return of([]);
        return database.get<Notification>(this.table)
          .query( Q.where('user_id', activeUserId), Q.where('is_read', false), Q.sortBy('order', Q.desc) )
          .observe();
      })
    );
  }

  static async getNextOrder(database: Database, userId: string): Promise<number> {
    // Logika bez zmian
    if (!userId) { console.error("[DB Notification] Brak userId..."); return Date.now(); }
    try { const lastNotification = await database.get<Notification>(this.table).query(Q.where('user_id', userId), Q.sortBy('order', Q.desc), Q.take(1)).fetch(); return (lastNotification.length > 0 ? lastNotification[0].order : -1) + 1; }
    catch (error) { console.error(`[DB Notification] Błąd getNextOrder dla ${userId}:`, error); return Date.now(); }
  }

  static async markAllAsRead(database: Database, userId: string): Promise<void> {
    // Logika bez zmian
     if (!userId) return; try { const unreadNotifications = await database.get<Notification>(this.table).query(Q.where('user_id', userId), Q.where('is_read', false)).fetch(); if (unreadNotifications.length === 0) { return; }
       console.log(`[DB Notification] Oznaczanie ${unreadNotifications.length} powiadomień jako przeczytane dla ${userId}...`); await database.write(async () => { await database.batch(...unreadNotifications.map(n => n.prepareMarkAsRead())); }); console.log(`[DB Notification] Oznaczanie zakończone.`); }
     catch (error) { console.error(`[DB Notification] Błąd markAllAsRead dla ${userId}:`, error); throw error; }
  }

  static async deleteAllRead(database: Database, userId: string): Promise<void> {
    // Logika bez zmian
    if (!userId) return; try { const readNotifications = await database.get<Notification>(this.table).query(Q.where('user_id', userId), Q.where('is_read', true)).fetch(); if (readNotifications.length === 0) { return; }
      console.log(`[DB Notification] Usuwanie ${readNotifications.length} przeczytanych powiadomień dla ${userId}...`); await database.write(async () => { await database.batch(...readNotifications.map(n => n.prepareDeleteNotification())); }); console.log(`[DB Notification] Usuwanie zakończone.`); }
    catch (error) { console.error(`[DB Notification] Błąd deleteAllRead dla ${userId}:`, error); throw error; }
  }

  static async createNotification( database: Database, data: { userId: string; content: string; type: string; link?: string | null; isRead?: boolean; }): Promise<Notification> {
    // Logika bez zmian
    const notificationsCollection = database.get<Notification>(this.table); const nextOrder = await this.getNextOrder(database, data.userId);
    return database.write(async () => { const newNotification = await notificationsCollection.create(notification => { notification.userId = data.userId; notification.content = data.content; notification.type = data.type; notification.link = data.link ?? null; notification.isRead = data.isRead ?? false; notification.order = nextOrder; });
      console.log(`[DB Notification] Utworzono nowe powiadomienie lokalnie: ${newNotification.id}`); return newNotification; });
  }

  // --- Metody Instancji ---
  @writer async markAsRead() {
    // Logika bez zmian
    if (!this.isRead) { await this.update(notification => { notification.isRead = true; }); console.log(`[DB Notification] Oznaczono ${this.id} jako przeczytane.`); }
  }
  @writer async deleteNotification() {
    // Logika bez zmian
      console.log(`[DB Notification] Oznaczanie powiadomienia ${this.id} jako usunięte.`); await this.markAsDeleted();
  }
   // --- Przygotowanie do batch ---
   prepareMarkAsRead(): Notification | null {
    // Logika bez zmian
       if (this.isRead) return null; return this.prepareUpdate(notification => { notification.isRead = true; });
   }
   prepareDeleteNotification(): Notification {
    // Logika bez zmian
       return this.prepareMarkAsDeleted();
   }
}