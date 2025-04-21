// src/database/models/ClientUserSettings.ts
import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Database, Collection } from '@nozbe/watermelondb';
// Usunięto import AuthService, nie jest tu potrzebny
// import { getCurrentUserId } from '../../services/auth/authUserIdProvider'; // Nie jest tu bezpośrednio używany

export default class ClientUserSettings extends Model {
  static table = 'client_user_settings';

  // --- Pola ---
  // Zakładamy, że user_id jest string | null zgodnie ze schematem, chociaż po synchronizacji powinien być string
  @field('user_id') userId!: string | null;
  @date('last_modified') lastModified!: number; // Oczekuje number (timestamp)
  @date('created_at') createdAt!: number;     // Oczekuje number (timestamp)
  @text('language') language!: string;         // Język, np. 'pl', 'en'

  // UWAGA: Ten model zakłada, że rekord jest tworzony na serwerze
  // i synchronizowany do klienta. Klient tylko aktualizuje istniejący rekord.
  // Dlatego nie implementujemy tu generowania UUID po stronie klienta.
  // ID jest ustalane przez serwer i przychodzi podczas PULL.

  // --- Metody Statyczne ---

  /**
   * Pobiera ustawienia dla danego użytkownika lub zwraca null, jeśli nie istnieją lokalnie.
   * Nie tworzy automatycznie ustawień.
   * @param database Instancja bazy danych.
   * @param userId ID użytkownika (string).
   */
  static async getSettings(database: Database, userId: string): Promise<ClientUserSettings | null> {
    if (!userId) {
      console.error("[DB ClientUserSettings] Brak userId do pobrania ustawień.");
      return null;
    }
    const collection = database.get<ClientUserSettings>(this.table);
    try {
      // Szukaj rekordu dla konkretnego userId
      const settingsRecords = await collection
        .query(Q.where('user_id', userId)) // Porównanie string ze string
        .fetch();

      if (settingsRecords.length > 1) {
        console.warn(`[DB ClientUserSettings] Znaleziono wiele (${settingsRecords.length}) rekordów ustawień dla użytkownika ${userId}. Zwracam pierwszy.`);
      }
      return settingsRecords.length > 0 ? settingsRecords[0] : null;
    } catch (error) {
      console.error(`[DB ClientUserSettings] Błąd podczas pobierania ustawień dla ${userId}:`, error);
      throw error; // Rzuć błąd dalej
    }
  }

  /**
   * Pobiera język użytkownika lub zwraca domyślny 'pl'.
   * @param database Instancja bazy danych.
   * @param userId ID użytkownika (string).
   */
  static async getLanguage(database: Database, userId: string): Promise<string> {
    // Sprawdzenie userId na początku
    if (!userId) {
        console.warn("[DB ClientUserSettings] Próba pobrania języka bez userId. Zwracam domyślny 'pl'.");
        return 'pl';
    }
    try {
      const settings = await this.getSettings(database, userId);
      return settings?.language ?? 'pl'; // Domyślnie 'pl', jeśli brak ustawień lub pola
    } catch (error) {
      console.error(`[DB ClientUserSettings] Błąd podczas pobierania języka dla ${userId}:`, error);
      return 'pl'; // Zwróć domyślny w razie błędu
    }
  }

  /**
   * Aktualizuje język dla użytkownika w LOKALNEJ bazie.
   * Zakłada, że rekord ustawień już istnieje (powinien być stworzony przy synchronizacji).
   * Jeśli nie istnieje, loguje błąd i zwraca null.
   * @param database Instancja bazy danych.
   * @param userId ID użytkownika (string).
   * @param newLanguage Nowy kod języka (np. 'en').
   */
  static async updateLanguage(database: Database, userId: string, newLanguage: string): Promise<ClientUserSettings | null> {
     if (!userId) {
       console.error("[DB ClientUserSettings] Brak userId do aktualizacji języka.");
       return null;
     }
     if (!newLanguage || newLanguage.length > 10) { // Prosta walidacja
         console.error(`[DB ClientUserSettings] Nieprawidłowy nowy język: "${newLanguage}"`);
         return null;
     }

     try {
       const settings = await this.getSettings(database, userId);
       if (!settings) {
           // To nie powinno się zdarzyć, jeśli sync działa poprawnie i serwer tworzy ustawienia
           console.error(`[DB ClientUserSettings] Nie znaleziono ustawień dla użytkownika ${userId}, aby zaktualizować język. Synchronizacja mogła jeszcze nie pobrać ustawień.`);
           // Można rozważyć stworzenie rekordu tutaj, ale lepiej polegać na serwerze/sync
           return null;
       }
       // Wywołaj metodę instancji w transakcji, jeśli język faktycznie się zmienia
       if (settings.language !== newLanguage) {
            await database.write(() => settings.setLanguage(newLanguage));
            console.log(`[DB ClientUserSettings] Zaktualizowano język lokalnie dla ${userId} na ${newLanguage}. Rekord zostanie oznaczony do PUSH.`);
       } else {
            console.log(`[DB ClientUserSettings] Język dla ${userId} jest już ustawiony na ${newLanguage}. Brak zmian.`);
       }
       return settings; // Zwróć model (nawet jeśli nie było zmiany)
     } catch (error) {
       console.error(`[DB ClientUserSettings] Błąd podczas aktualizacji języka dla ${userId}:`, error);
       throw error;
     }
  }

  // --- Metody Instancji ---

  /** Aktualizuje pole języka. Metoda @writer, używana w transakcji. */
  @writer async setLanguage(newLanguage: string) {
    // Walidacja już w metodzie statycznej, ale można dodać drugą warstwę
    if (this.language !== newLanguage && newLanguage && newLanguage.length <= 10) {
        await this.update(setting => {
            setting.language = newLanguage;
        });
    } else if (this.language === newLanguage) {
        // Nie rób nic, jeśli język jest taki sam
    } else {
        console.warn(`[DB ClientUserSettings @writer] Próba ustawienia nieprawidłowego języka: "${newLanguage}"`);
    }
  }

  // --- Przygotowanie do batch ---
  /** Przygotowuje operację update języka dla batch. Zwraca null, jeśli język się nie zmienia. */
  prepareUpdateLanguage(newLanguage: string): ClientUserSettings | null {
      if (this.language === newLanguage || !newLanguage || newLanguage.length > 10) {
          return null; // Nie ma potrzeby aktualizacji lub nieprawidłowy język
      }
      return this.prepareUpdate(setting => {
          setting.language = newLanguage;
      });
  }
}