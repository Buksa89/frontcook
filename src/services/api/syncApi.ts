import apiClient from './apiClient'; // Importuj naszego klienta API
import type { ApiError } from './apiClient'; // Importuj typ błędu

// Typy dla danych synchronizacji (powinny być spójne z backendem i WDB)
// Można je przenieść do src/types/sync.ts później
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
export interface SyncMigrationInfo { // Zmieniono nazwę dla jasności
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
// Push nie zwraca danych (204 No Content)

const SYNC_ENDPOINT_PATH = '/api/v1/sync/'; // Upewnij się, że ścieżka jest poprawna

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
    // Używamy 'null' jako string, jeśli lastPulledAt jest null, zgodnie z wymaganiami API
    params.append('last_pulled_at', lastPulledAt?.toString() ?? 'null');
    params.append('schema_version', schemaVersion.toString());
    // Używamy 'null' jako string, jeśli migration jest null
    params.append('migration', migration ? JSON.stringify(migration) : 'null');

    const endpointWithParams = `${SYNC_ENDPOINT_PATH}?${params.toString()}`;
    console.log(`[SyncAPI] Pull Endpoint: ${endpointWithParams}`);

    try {
      // Używamy apiClient.get, wymaga autoryzacji (true)
      const response = await apiClient.get<PullChangesResponse>(endpointWithParams, true);

      // Podstawowa walidacja odpowiedzi
      if (!response || typeof response.changes !== 'object' || typeof response.timestamp !== 'number') {
        console.error('[SyncAPI] Nieprawidłowy format odpowiedzi serwera podczas Pull:', response);
        throw new Error('Nieprawidłowy format odpowiedzi serwera podczas Pull.');
      }

      console.log(`[SyncAPI] Pull udany. Otrzymano timestamp: ${response.timestamp}`);
      return response;
    } catch (error) {
      const apiError = error as ApiError;
      console.error(`[SyncAPI] Błąd podczas Pull: Status ${apiError?.status ?? 'N/A'}`, apiError?.message ?? error);
      // Rzuć błąd dalej, aby SyncService mógł go obsłużyć
      throw error;
    }
  },

  /**
   * Faza Push synchronizacji WatermelonDB.
   * Wysyła lokalne zmiany na serwer.
   */
  async pushChanges({ changes, lastPulledAt }: PushChangesArgs): Promise<void> {
    // Sprawdź, czy obiekt `changes` nie jest pusty
    if (Object.keys(changes).length === 0) {
        console.log('[SyncAPI] Brak zmian do wysłania (Push). Pomijanie.');
        return; // Nie wysyłaj pustego żądania
    }

    console.log(`[SyncAPI] Pushing changes (LPA: ${lastPulledAt})`);
    const params = new URLSearchParams({ last_pulled_at: lastPulledAt.toString() });
    const endpointWithParams = `${SYNC_ENDPOINT_PATH}?${params.toString()}`;
    console.log(`[SyncAPI] Push Endpoint: ${endpointWithParams}`);

    // Przygotuj ciało żądania z kluczem "changes"
    const requestBody = { changes: changes };

    try {
      // Używamy apiClient.post, wymaga autoryzacji (true)
      // Oczekujemy odpowiedzi 204 No Content, więc typ generyczny to <void>
      await apiClient.post<void>(endpointWithParams, requestBody, true);
      console.log('[SyncAPI] Push udany (otrzymano 204 No Content).');
    } catch (error) {
      const apiError = error as ApiError;
      console.error(`[SyncAPI] Błąd podczas Push: Status ${apiError?.status ?? 'N/A'}`, apiError?.message ?? error);
      if (apiError?.status === 409) {
        console.warn('[SyncAPI] Wykryto konflikt (409) podczas Push. Wymagany ponowny Pull.');
      }
      // Rzuć błąd dalej, aby SyncService mógł go obsłużyć
      throw error;
    }
  }
};

export default syncApi;