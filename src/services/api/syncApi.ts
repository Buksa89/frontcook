// src/services/api/syncApi.ts
import apiClient from './apiClient'; // Importuj naszego klienta API
import type { ApiError } from './apiClient'; // Importuj typ błędu
import { DEBUG } from '../../config/env'; // Importuj DEBUG flag

// Typy dla danych synchronizacji
interface SyncTableChanges<T = Record<string, any>> {
  created: T[];
  updated: T[];
  deleted: string[];
}
export interface SyncPayload {
  [tableName: string]: SyncTableChanges;
}
interface SyncMigrationColumn {
  table: string;
  columns: string[];
}
export interface SyncMigrationInfo {
  from: number;
  tables: string[];
  columns: SyncMigrationColumn[];
}
export interface PullChangesArgs {
  lastPulledAt: number | null;
  schemaVersion: number;
  migration: SyncMigrationInfo | null;
}
export interface PullChangesResponse {
  changes: SyncPayload;
  timestamp: number;
}
export interface PushChangesArgs {
  changes: SyncPayload;
  lastPulledAt: number;
}

const SYNC_ENDPOINT_PATH = '/api/sync/'; // Upewnij się, że ścieżka jest poprawna

// Funkcja summarizeChanges została usunięta, bo logujemy pełne obiekty

/**
 * Obiekt zawierający funkcje do synchronizacji WatermelonDB przez API.
 */
const syncApi = {
  /**
   * Faza Pull synchronizacji WatermelonDB.
   * Pobiera zmiany z serwera.
   */
  async pullChanges({ lastPulledAt, schemaVersion, migration }: PullChangesArgs): Promise<PullChangesResponse> {
    console.log(`[SyncAPI] Pulling changes (LPA: ${lastPulledAt ?? 'null'}, Schema: ${schemaVersion}, Migration: ${!!migration})`);
    const params = new URLSearchParams();
    params.append('last_pulled_at', lastPulledAt?.toString() ?? 'null');
    params.append('schema_version', schemaVersion.toString());
    params.append('migration', migration ? JSON.stringify(migration) : 'null');

    const endpointWithParams = `${SYNC_ENDPOINT_PATH}?${params.toString()}`;
    console.log(`[SyncAPI] Pull Endpoint: ${endpointWithParams}`);

    try {
      const response = await apiClient.get<PullChangesResponse>(endpointWithParams, true);

      if (!response || typeof response.changes !== 'object' || typeof response.timestamp !== 'number') {
        console.error('[SyncAPI] Nieprawidłowy format odpowiedzi serwera podczas Pull:', response);
        throw new Error('Nieprawidłowy format odpowiedzi serwera podczas Pull.');
      }

      // --- ZMIENIONE LOGOWANIE ODPOWIEDZI ---
      console.log(`[SyncAPI Pull Response] Timestamp: ${response.timestamp}`);

      if (DEBUG) { // Loguj pełną odpowiedź tylko w trybie DEBUG
         try {
             console.log('[SyncAPI Pull Response DEBUG] Full changes:', JSON.stringify(response.changes, null, 2));
         } catch (stringifyError) {
             console.error('[SyncAPI Pull Response DEBUG] Błąd podczas stringify zmian:', stringifyError);
             console.log('[SyncAPI Pull Response DEBUG] Raw changes object:', response.changes); // Spróbuj zalogować surowy obiekt
         }
      } else {
          // W produkcji loguj tylko podsumowanie lub nic wrażliwego
          console.log(`[SyncAPI Pull Response] Otrzymano zmiany (liczba tabel: ${Object.keys(response.changes).length}).`);
      }
      // --- KONIEC ZMIENIONEGO LOGOWANIA ---

      return response;
    } catch (error) {
      const apiError = error as ApiError;
      console.error(`[SyncAPI] Błąd podczas Pull: Status ${apiError?.status ?? 'N/A'}`, apiError?.message ?? error);
      throw error;
    }
  },

  /**
   * Faza Push synchronizacji WatermelonDB.
   * Wysyła lokalne zmiany na serwer.
   */
  async pushChanges({ changes, lastPulledAt }: PushChangesArgs): Promise<void> {
    if (Object.keys(changes).length === 0) {
        console.log('[SyncAPI] Brak zmian do wysłania (Push). Pomijanie.');
        return;
    }

    // --- ZMIENIONE LOGOWANIE DANYCH WYJŚCIOWYCH ---
    console.log(`[SyncAPI] Pushing changes (LPA: ${lastPulledAt})`);

    if (DEBUG) { // Loguj pełne dane tylko w trybie DEBUG
       try {
           console.log('[SyncAPI Push DEBUG] Full changes:', JSON.stringify(changes, null, 2));
       } catch (stringifyError) {
           console.error('[SyncAPI Push DEBUG] Błąd podczas stringify zmian:', stringifyError);
           console.log('[SyncAPI Push DEBUG] Raw changes object:', changes); // Spróbuj zalogować surowy obiekt
       }
    } else {
        // W produkcji loguj tylko podsumowanie lub nic wrażliwego
        console.log(`[SyncAPI Push] Wysyłanie zmian (liczba tabel: ${Object.keys(changes).length}).`);
    }
    // --- KONIEC ZMIENIONEGO LOGOWANIA ---

    const params = new URLSearchParams({ last_pulled_at: lastPulledAt.toString() });
    const endpointWithParams = `${SYNC_ENDPOINT_PATH}?${params.toString()}`;

    const requestBody = { changes: changes }; // Zawsze opakowuj w obiekt 'changes'

    try {
      await apiClient.post<void>(endpointWithParams, requestBody, true);
      console.log('[SyncAPI] Push udany (otrzymano 204 No Content).');
    } catch (error) {
      const apiError = error as ApiError;
      console.error(`[SyncAPI] Błąd podczas Push: Status ${apiError?.status ?? 'N/A'}`, apiError?.message ?? error);
      if (apiError?.status === 409) {
        console.warn('[SyncAPI] Wykryto konflikt (409) podczas Push. Wymagany ponowny Pull.');
      }
      throw error;
    }
  }
};

export default syncApi;