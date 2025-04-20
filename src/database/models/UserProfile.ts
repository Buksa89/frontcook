import { Model, Q } from '@nozbe/watermelondb';
import { field, date, text } from '@nozbe/watermelondb/decorators';
import type { Database } from '@nozbe/watermelondb';
import { Observable, of, from } from 'rxjs';
import { map, switchMap, distinctUntilChanged } from 'rxjs/operators'; // Dodano distinctUntilChanged
import AuthService from '../../services/auth/authService';

export default class UserProfile extends Model {
  static table = 'user_profile';

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  // Zgodnie ze schematem i API (string ISO 8601 lub null)
  @text('subscription_end') subscriptionEnd?: string | null;
  @text('csv_lock') csvLock?: string | null;

  // --- Metody Statyczne ---

  /** Obserwuje status subskrypcji dla zalogowanego użytkownika. */
  static observeSubscriptionStatus(database: Database): Observable<{ isActive: boolean, endDate: Date | null }> {
    return from(AuthService.getActiveUserId()).pipe(
      switchMap(activeUserId => {
        if (!activeUserId) {
          // console.log('[UserProfile] Brak aktywnego użytkownika dla observeSubscriptionStatus.');
          return of({ isActive: false, endDate: null });
        }
        // console.log(`[UserProfile] Obserwacja profilu dla użytkownika ${activeUserId}`);
        return database.get<UserProfile>(this.table)
          .query(Q.where('user_id', activeUserId))
          .observe()
          .pipe(
            map(userProfiles => {
              if (userProfiles.length === 0) {
                // console.warn(`[UserProfile] Nie znaleziono lokalnego profilu dla ${activeUserId}. Zakładanie braku subskrypcji.`);
                return { isActive: false, endDate: null };
              }
              const userProfile = userProfiles[0];
              const subEndString = userProfile.subscriptionEnd;
              let isActive = false;
              let endDate: Date | null = null;

              if (subEndString) {
                  try {
                      const subEndDate = new Date(subEndString);
                      const now = new Date();
                      // Sprawdź czy data jest poprawna i w przyszłości
                      if (!isNaN(subEndDate.getTime()) && subEndDate > now) {
                          isActive = true;
                          endDate = subEndDate;
                      } else if (!isNaN(subEndDate.getTime())) {
                          // Data jest poprawna, ale w przeszłości
                          endDate = subEndDate;
                      }
                  } catch (e) {
                       console.error(`[UserProfile] Błąd parsowania daty subscriptionEnd "${subEndString}" dla ${activeUserId}:`, e);
                  }
              }
              // console.log(`[UserProfile] Status subskrypcji dla ${activeUserId}: Aktywna=${isActive}, Koniec=${endDate?.toISOString() ?? 'null'}`);
              return { isActive, endDate };
            }),
            // Emituj tylko wtedy, gdy obiekt {isActive, endDate} się zmienił
            distinctUntilChanged((prev, curr) => prev.isActive === curr.isActive && prev.endDate?.getTime() === curr.endDate?.getTime())
          );
      })
    );
  }

  // Ten model jest read-only dla klienta, więc nie dodajemy metod @writer ani create/update.
  // Dane są zarządzane przez backend i mechanizm synchronizacji PULL.
}