// src/database/models/UserProfile.ts

import { Model, Q } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';
import type { Database } from '@nozbe/watermelondb'; // Poprawiony import
import { Observable, of, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import AuthService from '../../app/services/auth/authService';

// --- NOWA IMPLEMENTACJA ---

export class UserProfile extends Model {
  static table = 'user_profile'; // Standardowa definicja

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  // @date('created_at') createdAt!: number; // Opcjonalne
  @date('subscription_end') subscriptionEnd!: number;
  @date('csv_lock') csvLock!: number; // Zmieniono na number (timestamp)

  // --- Metody Statyczne ---
  static observeSubscriptionStatus(database: Database): Observable<{ isActive: boolean, endDate: Date | null }> {
    // Użyj getActiveUserId
    return from(AuthService.getActiveUserId()).pipe(
        switchMap(activeUserId => {
          if (!activeUserId) {
            console.log('[UserProfile] Brak aktywnego użytkownika dla observeSubscriptionStatus.');
            return of({ isActive: false, endDate: null });
          }
          return database.get<UserProfile>(this.table)
            .query(Q.where('user_id', activeUserId)) // Usunięto Q.take(1), bo user_id powinno być unikalne
            .observe()
            .pipe(
              map(userProfiles => {
                if (userProfiles.length === 0) {
                  console.warn(`[UserProfile] Nie znaleziono lokalnego profilu dla użytkownika ${activeUserId}.`);
                  return { isActive: false, endDate: null };
                }
                const userProfile = userProfiles[0];
                const subscriptionEndTimestamp = userProfile.subscriptionEnd;
                const nowTimestamp = Date.now();
                const isActive = subscriptionEndTimestamp > 0 && subscriptionEndTimestamp > nowTimestamp;
                const endDate = isActive || subscriptionEndTimestamp > 0 ? new Date(subscriptionEndTimestamp) : null;
                return { isActive, endDate };
              })
            );
        })
      );
  }

  // Usunięto metody create/upsert/getOrCreate - zarządzane przez serwer/sync
}

export default UserProfile;