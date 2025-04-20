import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Database, Collection } from '@nozbe/watermelondb';
import AuthService from '../../services/auth/authService'; // Poprawiono ścieżkę

export default class ClientUserSettings extends Model {
  static table = 'client_user_settings';

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('language') language!: string;

  // --- Metody Statyczne ---

  /**
   * Pobiera ustawienia dla danego użytkownika lub zwraca null, jeśli nie istnieją.
   * Nie tworzy automatycznie ustawień.
   */
  static async getSettings(database: Database, userId: string): Promise<ClientUserSettings | null> {
    if (!userId) {
      console.error("[DB ClientUserSettings] Brak userId do pobrania ustawień.");
      return null;
    }
    const collection = database.get<ClientUserSettings>(this.table);
    try {
      const settingsRecords = await collection
        .query(Q.where('user_id', userId))
        .fetch();
      return settingsRecords.length > 0 ? settingsRecords[0] : null;
    } catch (error) {
      console.error(`[DB ClientUserSettings] Błąd podczas pobierania ustawień dla ${userId}:`, error);
      throw error; // Rzuć błąd dalej
    }
  }

  /**
   * Pobiera język użytkownika lub zwraca domyślny 'pl'.
   */
  static async getLanguage(database: Database, userId: string): Promise<string> {
    try {
      const settings = await this.getSettings(database, userId);
      return settings?.language ?? 'pl';
    } catch (error) {
      console.error(`[DB ClientUserSettings] Błąd podczas pobierania języka dla ${userId}:`, error);
      return 'pl'; // Zwróć domyślny w razie błędu
    }
  }

  /**
   * Aktualizuje język dla użytkownika.
   * Zakłada, że rekord ustawień już istnieje (powinien być stworzony przy synchronizacji).
   * Jeśli nie istnieje, loguje błąd.
   */
  static async updateLanguage(database: Database, userId: string, newLanguage: string): Promise<ClientUserSettings | null> {
     if (!userId) {
       console.error("[DB ClientUserSettings] Brak userId do aktualizacji języka.");
       return null;
     }
     try {
       const settings = await this.getSettings(database, userId);
       if (!settings) {
           // To nie powinno się zdarzyć, jeśli sync działa poprawnie
           console.error(`[DB ClientUserSettings] Nie znaleziono ustawień dla użytkownika ${userId}, aby zaktualizować język. Synchronizacja mogła jeszcze nie pobrać ustawień.`);
           return null;
       }
       // Wywołaj metodę instancji w transakcji
       await database.write(() => settings.setLanguage(newLanguage));
       console.log(`[DB ClientUserSettings] Zaktualizowano język lokalnie dla ${userId} na ${newLanguage}.`);
       return settings; // Zwróć zaktualizowany model
     } catch (error) {
       console.error(`[DB ClientUserSettings] Błąd podczas aktualizacji języka dla ${userId}:`, error);
       throw error;
     }
  }

  // --- Metody Instancji ---

  /** Aktualizuje pole języka. Metoda @writer, używana w transakcji. */
  @writer async setLanguage(newLanguage: string) {
    if (this.language !== newLanguage) {
        await this.update(setting => {
            setting.language = newLanguage;
        });
    }
  }

  // --- Przygotowanie do batch ---
  prepareUpdateLanguage(newLanguage: string): ClientUserSettings | null {
      if (this.language === newLanguage) return null; // Nie ma potrzeby aktualizacji
      return this.prepareUpdate(setting => {
          setting.language = newLanguage;
      });
  }
}