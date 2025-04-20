// src/database/models/ClientUserSettings.ts

import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Database, Collection } from '@nozbe/watermelondb';
import AuthService from '../../app/services/auth/authService'; // Upewnij się, że ścieżka jest poprawna

// --- NOWA IMPLEMENTACJA ---

export class ClientUserSettings extends Model {
  static table = 'client_user_settings'; // Standardowa definicja tabeli

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  // @date('created_at') createdAt!: number; // Opcjonalne
  @text('language') language!: string;

  // --- Metody Statyczne ---
  static async getOrCreate(database: Database, userId: string): Promise<ClientUserSettings | null> {
    // ... (bez zmian w logice, ale pamiętaj o zastrzeżeniach dot. tworzenia lokalnego)
    if (!userId) {
        console.error("[DB ClientUserSettings] Brak userId do getOrCreate.");
        return null;
    }
    const collection = database.get<ClientUserSettings>(this.table);
    try {
      const settingsRecords = await collection
        .query(Q.where('user_id', userId))
        .fetch();
      if (settingsRecords.length > 0) {
        return settingsRecords[0];
      } else {
          console.warn(`[DB ClientUserSettings] Nie znaleziono ustawień lokalnie dla ${userId}. Rozważ utworzenie ich na serwerze.`);
          // Opcja 1: Zwróć null
          return null;
          // Opcja 2: Utwórz lokalnie (ryzyko konfliktu)
          // console.log(`[DB ClientUserSettings] Tworzenie domyślnych ustawień lokalnie dla ${userId} (może powodować konflikt).`);
          // return await database.write(async () => { /* ... logika tworzenia ... */ });
      }
    } catch (error) {
      console.error(`[DB ClientUserSettings] Błąd podczas getOrCreate dla ${userId}: ${error}`);
      throw error;
    }
  }

  static async getLanguage(database: Database, userId: string): Promise<string> {
    // ... (bez zmian w logice)
    try {
        const settings = await this.getOrCreate(database, userId);
        return settings?.language ?? 'pl';
      } catch (error) {
        console.error(`[DB ClientUserSettings] Błąd podczas pobierania języka dla ${userId}: ${error}`);
        return 'pl';
      }
  }

  static async updateLanguage(database: Database, userId: string, newLanguage: string): Promise<ClientUserSettings | null> {
     // ... (bez zmian w logice, ale pamiętaj o zastrzeżeniach dot. używania)
     if (!userId) {
        console.error("[DB ClientUserSettings] Brak userId do updateLanguage.");
        return null;
    }
    try {
      const settings = await this.getOrCreate(database, userId);
      if (!settings) {
          console.error(`[DB ClientUserSettings] Nie można znaleźć ani utworzyć ustawień dla ${userId}, aby zaktualizować język.`);
          return null;
      }
      await settings.setLanguage(newLanguage);
      console.log(`[DB ClientUserSettings] Zaktualizowano język lokalnie dla ${userId} na ${newLanguage}.`);
      return settings;
    } catch (error) {
      console.error(`[DB ClientUserSettings] Błąd podczas aktualizacji języka dla ${userId}: ${error}`);
      throw error;
    }
  }

  // --- Metody Instancji ---
  @writer async setLanguage(newLanguage: string) {
      // ... (bez zmian w logice)
      if (this.language !== newLanguage) {
          await this.update(setting => {
              setting.language = newLanguage;
          });
      }
  }
}

// Używamy exportu klasy zamiast default, jeśli tak jest w innych modelach
export default ClientUserSettings; // Lub export { ClientUserSettings }