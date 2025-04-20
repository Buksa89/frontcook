import AuthStorage from './authStorage';
import authApi from '../api/authApi'; // Importuj obiekt z funkcjami API
import type { LoginResponse } from '../api/authApi'; // Importuj typ odpowiedzi logowania
import database from '../../database'; // Importuj instancję bazy danych
import { Q } from '@nozbe/watermelondb';
import { Alert } from 'react-native';
// Importuj wszystkie modele, które mogą mieć `user_id`=null
import Recipe from '../../database/models/Recipe';
import Tag from '../../database/models/Tag';
import RecipeTag from '../../database/models/RecipeTag';
import Ingredient from '../../database/models/Ingredient';
import ShoppingItem from '../../database/models/ShoppingItem';
import ClientUserSettings from '../../database/models/ClientUserSettings';
import Notification from '../../database/models/Notification';
import UserProfile from '../../database/models/UserProfile';

const SYNCHRONIZABLE_TABLES = [
    Recipe.table,
    Tag.table, // Uwaga: Tagi systemowe mają userId=null, ich nie ruszamy
    RecipeTag.table,
    Ingredient.table,
    ShoppingItem.table,
    ClientUserSettings.table,
    Notification.table,
    UserProfile.table,
];

class AuthService {

  /**
   * Loguje użytkownika, zapisuje tokeny i ID, oraz obsługuje przypisanie danych offline.
   */
  async login(loginValue: string, password: string): Promise<LoginResponse> {
    console.log('[AuthService] Rozpoczęcie logowania...');
    try {
      const response = await authApi.login({ login: loginValue, password }); // Użyj `login` zamiast `username`
      console.log('[AuthService] Odpowiedź API logowania otrzymana:', { userId: response.userId, isFirst: response.is_first_ever_login });

      // Krok 1: Zapisz nowe dane
      await Promise.all([
        AuthStorage.storeAccessToken(response.access),
        AuthStorage.storeRefreshToken(response.refresh),
        AuthStorage.storeActiveUserId(response.userId)
      ]);
      console.log('[AuthService] Tokeny i User ID zapisane.');

      // Krok 2: Sprawdź flagę pierwszego logowania i przypisz dane offline
      if (response.is_first_ever_login) {
        console.log('[AuthService] Wykryto pierwsze logowanie użytkownika. Rozpoczynanie przypisywania danych offline...');
        const success = await this.assignOrphanedDataToUser(response.userId);
        if (success) {
          console.log('[AuthService] Przypisywanie danych offline zakończone sukcesem.');
        } else {
          console.error('[AuthService] Wystąpił błąd podczas przypisywania danych offline.');
          // Można rozważyć, czy wylogować użytkownika, czy kontynuować z ostrzeżeniem
          Alert.alert('Błąd krytyczny', 'Nie udało się przypisać danych offline do konta. Skontaktuj się z pomocą techniczną.');
          // throw new Error('Assign orphaned data failed'); // Opcjonalnie rzuć błąd
        }
      } else {
        console.log('[AuthService] To nie jest pierwsze logowanie, pomijanie przypisywania danych offline.');
      }

      console.log('[AuthService] Logowanie zakończone pomyślnie.');
      return response; // Zwróć pełną odpowiedź API

    } catch (error) {
      console.error('[AuthService] Błąd podczas procesu logowania:', error);
      // W przypadku błędu logowania, wyczyść potencjalnie zapisane częściowe dane
      await this.clearAuthData();
      throw error; // Rzuć błąd dalej
    }
  }

  /**
   * Przypisuje rekordy z user_id=null do podanego użytkownika.
   * Wywoływane tylko przy pierwszym logowaniu.
   */
  private async assignOrphanedDataToUser(userId: string): Promise<boolean> {
    if (!database) {
      console.error('[AuthService] Baza danych nie jest zainicjalizowana!');
      return false;
    }
    console.log(`[AuthService] Rozpoczynanie przypisywania danych z user_id=null do użytkownika ${userId}`);
    try {
      await database.write(async (writer) => {
        let totalUpdated = 0;
        for (const tableName of SYNCHRONIZABLE_TABLES) {
          // Wykluczamy tagi, bo mogą mieć systemowe z userId=null
          // Wykluczamy user_profile, bo nie powinien mieć null
          if (tableName === Tag.table || tableName === UserProfile.table) {
            continue;
          }
          try {
            const collection = database.get(tableName);
            const orphanedRecords = await collection.query(Q.where('user_id', null)).fetch();

            if (orphanedRecords.length > 0) {
              console.log(`[AuthService] Znaleziono ${orphanedRecords.length} rekordów w tabeli '${tableName}' do przypisania.`);
              const updates = orphanedRecords.map(record =>
                record.prepareUpdate(r => {
                  // @ts-ignore - Zakładamy, że pole userId istnieje
                  r.userId = userId;
                })
              );
              await writer.batch(...updates);
              totalUpdated += updates.length;
            }
          } catch (tableError) {
             console.error(`[AuthService] Błąd podczas przetwarzania tabeli '${tableName}' przy przypisywaniu danych:`, tableError);
             // Kontynuuj z następną tabelą
          }
        }
        console.log(`[AuthService] Zakończono przypisywanie danych. Zaktualizowano ${totalUpdated} rekordów.`);
      });
      return true;
    } catch (error) {
      console.error(`[AuthService] Krytyczny błąd podczas transakcji przypisywania danych do użytkownika ${userId}:`, error);
      return false;
    }
  }

  /**
   * Wylogowuje użytkownika: wywołuje API i czyści lokalne dane.
   */
  async logout(): Promise<void> {
    console.log('[AuthService] Rozpoczęcie wylogowania...');
    const refreshToken = await this.getRefreshToken(); // Pobierz token PRZED czyszczeniem

    try {
      // Najpierw wywołaj API (jeśli jest token)
      await authApi.logout(refreshToken);
      console.log('[AuthService] Żądanie wylogowania API zakończone (lub pominięte).');
    } catch (error) {
       console.warn('[AuthService] Błąd podczas wywoływania API logout (kontynuacja czyszczenia lokalnego):', error);
       // Ignorujemy błędy API logout, najważniejsze jest czyszczenie lokalne
    } finally {
        // ZAWSZE czyść dane lokalne
        await this.clearAuthData();
        console.log('[AuthService] Wylogowanie zakończone (dane lokalne wyczyszczone).');
    }
  }

  /** Prywatna metoda do czyszczenia wszystkich danych autoryzacji. */
  private async clearAuthData(): Promise<void> {
      try {
          await Promise.all([
              AuthStorage.clearAccessToken(),
              AuthStorage.clearRefreshToken(),
              AuthStorage.clearActiveUserId()
          ]);
      } catch (error) {
           console.error('[AuthService] Błąd podczas czyszczenia danych autoryzacji:', error);
           // Rzucenie błędu tutaj może być problematyczne podczas wylogowania
           // Lepiej zalogować i kontynuować
      }
  }

  // Metody pomocnicze do pobierania danych (bez zmian)
  async getAccessToken(): Promise<string | null> { return AuthStorage.retrieveAccessToken(); }
  async getActiveUserId(): Promise<string | null> { return AuthStorage.retrieveActiveUserId(); }
  async getRefreshToken(): Promise<string | null> { return AuthStorage.retrieveRefreshToken(); }
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    const userId = await this.getActiveUserId();
    return !!token && !!userId;
  }

  // Metoda odświeżania - implementacja później w apiClient
  // async refreshAccessToken(): Promise<string | null> { ... }
}

// Eksportuj instancję singletona
const authService = new AuthService();
export default authService;