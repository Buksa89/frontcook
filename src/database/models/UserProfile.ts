// src/database/models/UserProfile.ts
import { Model, Q } from '@nozbe/watermelondb';
import { field, date, text } from '@nozbe/watermelondb/decorators';
import type { Database } from '@nozbe/watermelondb';
import { Observable, of, from } from 'rxjs';
import { map, switchMap, distinctUntilChanged } from 'rxjs/operators';
import { getCurrentUserId } from '../../services/auth/authUserIdProvider';

export default class UserProfile extends Model {
  static table = 'user_profile';

  // --- Pola ---
  // ID jest ustalane przez serwer (powinno być UUID) i przychodzi z PULL
  @field('user_id') userId!: string; // Oczekuje string (UUID) z serwera
  @date('last_modified') lastModified!: number; // Oczekuje number (timestamp)
  @date('created_at') createdAt!: number;     // Oczekuje number (timestamp)
  @text('subscription_end') subscriptionEnd?: string | null; // Data jako string ISO lub null
  @text('csv_lock') csvLock?: string | null; // Data jako string ISO lub null

  // UWAGA: Ten model jest zazwyczaj tylko do odczytu po stronie klienta.
  // Dane są zarządzane na serwerze i synchronizowane przez PULL.
  // Klient nie tworzy ani nie modyfikuje bezpośrednio tych rekordów.
  // ID (będące UUID) pochodzi z serwera.

  // --- Metody Statyczne ---

  /**
   * Obserwuje status subskrypcji (aktywna/nieaktywna) i datę zakończenia
   * dla aktualnie zalogowanego użytkownika.
   */
  static observeSubscriptionStatus(database: Database): Observable<{ isActive: boolean, endDate: Date | null }> {
    return from(getCurrentUserId()).pipe(
      switchMap(activeUserId => {
        if (!activeUserId) {
            // Jeśli użytkownik nie jest zalogowany, subskrypcja jest nieaktywna
            return of({ isActive: false, endDate: null });
        }
        // Użyj poprawnego userClause
        const userClause = Q.where('user_id', activeUserId); // userId w UserProfile to PK
        return database.get<UserProfile>(this.table)
          .query(userClause) // Znajdź profil po userId (PK)
          .observe()
          .pipe(
            map(userProfiles => {
              // Powinien być maksymalnie jeden profil dla danego userId
              if (userProfiles.length === 0) {
                  console.warn(`[UserProfile observe] Nie znaleziono profilu dla użytkownika ${activeUserId}`);
                  return { isActive: false, endDate: null };
              }
              if (userProfiles.length > 1) {
                   console.warn(`[UserProfile observe] Znaleziono wiele (${userProfiles.length}) profili dla użytkownika ${activeUserId}. Używam pierwszego.`);
              }

              const userProfile = userProfiles[0];
              const subEndString = userProfile.subscriptionEnd;
              let isActive = false;
              let endDate: Date | null = null;

              if (subEndString) {
                try {
                  const subEndDate = new Date(subEndString); // Spróbuj sparsować datę ISO
                  const now = new Date();
                  if (!isNaN(subEndDate.getTime())) { // Sprawdź czy data jest poprawna
                      endDate = subEndDate; // Zapisz sparsowaną datę
                      if (subEndDate > now) {
                          isActive = true; // Subskrypcja jest aktywna, jeśli data jest w przyszłości
                      }
                  } else {
                      console.error(`[UserProfile observe] Niepoprawny format daty subscriptionEnd "${subEndString}" dla ${activeUserId}.`);
                  }
                } catch (e) {
                  console.error(`[UserProfile observe] Błąd parsowania daty subscriptionEnd "${subEndString}" dla ${activeUserId}:`, e);
                }
              }
              return { isActive, endDate };
            }),
            // Emituj tylko, gdy zmieni się status aktywności lub data (czas)
            distinctUntilChanged((prev, curr) =>
                prev.isActive === curr.isActive && prev.endDate?.getTime() === curr.endDate?.getTime()
            )
          );
      })
    );
  }

    /**
     * Obserwuje status blokady CSV dla aktualnie zalogowanego użytkownika.
     * Zwraca true, jeśli blokada jest aktywna (data w przyszłości).
     */
    static observeCsvLockStatus(database: Database): Observable<boolean> {
        return from(getCurrentUserId()).pipe(
            switchMap(activeUserId => {
                if (!activeUserId) { return of(false); } // Nie ma blokady, jeśli nie ma użytkownika
                const userClause = Q.where('user_id', activeUserId);
                return database.get<UserProfile>(this.table)
                    .query(userClause)
                    .observe()
                    .pipe(
                        map(userProfiles => {
                            if (userProfiles.length === 0) { return false; } // Brak profilu = brak blokady
                            const userProfile = userProfiles[0];
                            const lockEndString = userProfile.csvLock;
                            if (!lockEndString) { return false; } // Brak daty = brak blokady

                            try {
                                const lockEndDate = new Date(lockEndString);
                                const now = new Date();
                                // Blokada jest aktywna, jeśli data jest poprawna i w przyszłości
                                return !isNaN(lockEndDate.getTime()) && lockEndDate > now;
                            } catch (e) {
                                console.error(`[UserProfile observe] Błąd parsowania daty csvLock "${lockEndString}" dla ${activeUserId}:`, e);
                                return false; // Błąd parsowania = brak blokady
                            }
                        }),
                        distinctUntilChanged() // Emituj tylko przy zmianie statusu blokady
                    );
            })
        );
    }
}