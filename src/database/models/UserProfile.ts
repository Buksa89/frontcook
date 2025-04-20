// src/database/models/UserProfile.ts
import { Model, Q } from '@nozbe/watermelondb';
import { field, date, text } from '@nozbe/watermelondb/decorators';
import type { Database } from '@nozbe/watermelondb';
import { Observable, of, from } from 'rxjs';
import { map, switchMap, distinctUntilChanged } from 'rxjs/operators';
import { getCurrentUserId } from '../../services/auth/authUserIdProvider'; // ZMIANA IMPORTU

export default class UserProfile extends Model {
  static table = 'user_profile';

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('subscription_end') subscriptionEnd?: string | null;
  @text('csv_lock') csvLock?: string | null;

  // --- Metody Statyczne ---

  static observeSubscriptionStatus(database: Database): Observable<{ isActive: boolean, endDate: Date | null }> {
    // Używamy nowej funkcji
    return from(getCurrentUserId()).pipe( // ZMIANA WYWOŁANIA
      switchMap(activeUserId => {
        if (!activeUserId) { return of({ isActive: false, endDate: null }); }
        return database.get<UserProfile>(this.table)
          .query(Q.where('user_id', activeUserId))
          .observe()
          .pipe(
            map(userProfiles => {
              if (userProfiles.length === 0) { return { isActive: false, endDate: null }; }
              const userProfile = userProfiles[0]; const subEndString = userProfile.subscriptionEnd; let isActive = false; let endDate: Date | null = null;
              if (subEndString) { try { const subEndDate = new Date(subEndString); const now = new Date(); if (!isNaN(subEndDate.getTime()) && subEndDate > now) { isActive = true; endDate = subEndDate; } else if (!isNaN(subEndDate.getTime())) { endDate = subEndDate; } } catch (e) { console.error(`[UserProfile] Błąd parsowania daty subscriptionEnd "${subEndString}" dla ${activeUserId}:`, e); } }
              return { isActive, endDate };
            }),
            distinctUntilChanged((prev, curr) => prev.isActive === curr.isActive && prev.endDate?.getTime() === curr.endDate?.getTime())
          );
      })
    );
  }
}