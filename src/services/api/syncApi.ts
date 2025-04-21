// src/services/api/syncApi.ts
import apiClient from './apiClient'; // Importuj naszego klienta API
import type { ApiError } from './apiClient'; // Importuj typ błędu
import { DEBUG } from '../../config/env'; // Importuj DEBUG flag

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

const SYNC_ENDPOINT_PATH = '/api/sync/'; // Upewnij się, że ścieżka jest poprawna

/**
 * Oblicza podsumowanie zmian dla logowania.
 */
const summarizeChanges = (changes: SyncPayload): string => {
    let summary = `Tables: ${Object.keys(changes).length}, Items: {`;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalDeleted = 0;
    for (const table in changes) {
        totalCreated += changes[table]?.created?.length ?? 0;
        totalUpdated += changes[table]?.updated?.length ?? 0;
        totalDeleted += changes[table]?.deleted?.length ?? 0;
    }
    summary += ` C: ${totalCreated}, U: ${totalUpdated}, D: ${totalDeleted} }`;
    return summary;
};


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

      // --- DODANE LOGOWANIE ODPOWIEDZI ---
      const changesSummary = summarizeChanges(response.changes);
      console.log(`[SyncAPI Pull Response] Timestamp: ${response.timestamp}, Summary: ${changesSummary}`);

      // Do szczegółowego debugowania (można odkomentować tymczasowo)
      // if (DEBUG) { // Loguj pełną odpowiedź tylko w trybie DEBUG
      //    console.log('[SyncAPI Pull Response DEBUG] Full changes:', JSON.stringify(response.changes, null, 2).substring(0, 1000) + '...'); // Loguj początek obiektu
      // }
      // --- KONIEC DODANEGO LOGOWANIA ---


      // Usunięto logowanie "Pull udany", bo jest już w logu odpowiedzi
      // console.log(`[SyncAPI] Pull udany. Otrzymano timestamp: ${response.timestamp}`);
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

    // --- DODANE LOGOWANIE DANYCH WYJŚCIOWYCH (PODSUMOWANIE) ---
    const changesSummary = summarizeChanges(changes);
    console.log(`[SyncAPI] Pushing changes (LPA: ${lastPulledAt}), Summary: ${changesSummary}`);

    // Do szczegółowego debugowania (można odkomentować tymczasowo)
    // if (DEBUG) { // Loguj pełne dane tylko w trybie DEBUG
    //    console.log('[SyncAPI Push DEBUG] Full changes:', JSON.stringify(changes, null, 2).substring(0, 1000) + '...'); // Loguj początek obiektu
    // }
    // --- KONIEC DODANEGO LOGOWANIA ---

    const params = new URLSearchParams({ last_pulled_at: lastPulledAt.toString() });
    const endpointWithParams = `${SYNC_ENDPOINT_PATH}?${params.toString()}`;
    // Usunięto logowanie endpointu, bo jest mniej istotne niż dane
    // console.log(`[SyncAPI] Push Endpoint: ${endpointWithParams}`);

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