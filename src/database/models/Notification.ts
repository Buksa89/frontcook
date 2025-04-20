import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  writer,
  date
} from '@nozbe/watermelondb/decorators';
import type { Database, Collection } from '@nozbe/watermelondb';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import AuthService from '../../services/auth/authService';

export default class Notification extends Model {
  static table = 'notifications';

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('content') content!: string;
  @text('type') type!: string; // np. 'success', 'error', 'info'
  @text('link') link?: string | null;
  @field('is_read') isRead!: boolean;
  @field('order') order!: number;

  // --- Metody Statyczne ---

  /** Obserwuje wszystkie powiadomienia dla zalogowanego użytkownika, sortując wg stanu i kolejności. */
  static observeAll(database: Database): Observable<Notification[]> {
    return from(AuthService.getActiveUserId()).pipe(
      switchMap(activeUserId => {
        if (!activeUserId) return of([]);
        return database.get<Notification>(this.table)
          .query(Q.where('user_id', activeUserId))
          .observe()
          .pipe(
            // Sortowanie po stronie klienta dla złożonej logiki (nieprzeczytane na górze, potem wg order)
            map(notifications =>
              [...notifications].sort((a, b) => {
                // Nieprzeczytane najpierw
                if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
                // Potem sortuj wg 'order' malejąco (nowsze wyżej)
                return b.order - a.order;
              })
            )
          );
      })
    );
  }

  /** Obserwuje tylko nieprzeczytane powiadomienia. */
  static observeUnread(database: Database): Observable<Notification[]> {
    return from(AuthService.getActiveUserId()).pipe(
      switchMap(activeUserId => {
        if (!activeUserId) return of([]);
        return database.get<Notification>(this.table)
          .query(
              Q.where('user_id', activeUserId),
              Q.where('is_read', false),
              Q.sortBy('order', Q.desc) // Sortuj od razu wg kolejności malejąco
            )
          .observe();
      })
    );
  }

  /** Pobiera następną wartość 'order'. */
  static async getNextOrder(database: Database, userId: string): Promise<number> {
    if (!userId) { console.error("[DB Notification] Brak userId..."); return Date.now(); }
    try {
      const lastNotification = await database.get<Notification>(this.table)
        .query(Q.where('user_id', userId), Q.sortBy('order', Q.desc), Q.take(1)).fetch();
      return (lastNotification.length > 0 ? lastNotification[0].order : -1) + 1;
    } catch (error) {
      console.error(`[DB Notification] Błąd getNextOrder dla ${userId}:`, error);
      return Date.now();
    }
  }

  /** Oznacza wszystkie powiadomienia użytkownika jako przeczytane. */
  static async markAllAsRead(database: Database, userId: string): Promise<void> {
     if (!userId) return;
     try {
       const unreadNotifications = await database.get<Notification>(this.table)
         .query(Q.where('user_id', userId), Q.where('is_read', false)).fetch();
       if (unreadNotifications.length === 0) {
           console.log("[DB Notification] Brak nieprzeczytanych powiadomień do oznaczenia.");
           return;
       }
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

  /** Usuwa wszystkie przeczytane powiadomienia użytkownika. */
  static async deleteAllRead(database: Database, userId: string): Promise<void> {
    if (!userId) return;
    try {
      const readNotifications = await database.get<Notification>(this.table)
        .query(Q.where('user_id', userId), Q.where('is_read', true)).fetch();
      if (readNotifications.length === 0) {
           console.log("[DB Notification] Brak przeczytanych powiadomień do usunięcia.");
           return;
      }
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

  /** Tworzy nowe powiadomienie. */
  static async createNotification(
      database: Database,
      data: {
          userId: string;
          content: string;
          type: string;
          link?: string | null;
          isRead?: boolean;
      }): Promise<Notification> {

    const notificationsCollection = database.get<Notification>(this.table);
    const nextOrder = await this.getNextOrder(database, data.userId);
    let newNotification: Notification | null = null;

    await database.write(async () => {
      newNotification = await notificationsCollection.create(notification => {
        notification.userId = data.userId;
        notification.content = data.content;
        notification.type = data.type;
        notification.link = data.link ?? null;
        notification.isRead = data.isRead ?? false;
        notification.order = nextOrder;
      });
    });

    if (!newNotification) throw new Error("Nie udało się utworzyć powiadomienia.");

    console.log(`[DB Notification] Utworzono nowe powiadomienie lokalnie: ${newNotification.id}`);
    return newNotification;
  }

  // --- Metody Instancji ---

  /** Oznacza powiadomienie jako przeczytane. */
  @writer async markAsRead() {
    if (!this.isRead) {
        await this.update(notification => { notification.isRead = true; });
        console.log(`[DB Notification] Oznaczono ${this.id} jako przeczytane.`);
      }
  }

  /** Oznacza powiadomienie jako usunięte. */
  @writer async deleteNotification() {
      console.log(`[DB Notification] Oznaczanie powiadomienia ${this.id} jako usunięte.`);
      await this.markAsDeleted();
  }

   // --- Przygotowanie do batch ---
   prepareMarkAsRead(): Notification | null {
      if (this.isRead) return null; // Nie przygotowuj, jeśli już przeczytane
      return this.prepareUpdate(notification => {
          notification.isRead = true;
      });
   }

   prepareDeleteNotification(): Notification {
       return this.prepareMarkAsDeleted();
   }
}