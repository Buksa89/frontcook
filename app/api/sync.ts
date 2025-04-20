// src/api/sync.ts
import api from './api';
import type { ApiError } from './api';

// Typy (bez zmian)
interface SyncTableChanges<T = Record<string, any>> { created: T[]; updated: T[]; deleted: string[]; }
interface SyncPayload { [tableName: string]: SyncTableChanges; }
interface SyncMigrationColumn { table: string; columns: string[]; }
interface SyncMigration { from: number; tables: string[]; columns: SyncMigrationColumn[]; }
interface PullChangesArgs { lastPulledAt: number | null; schemaVersion: number; migration: SyncMigration | null; }
interface PullChangesResponse { changes: SyncPayload; timestamp: number; }
interface PushChangesArgs { changes: SyncPayload; lastPulledAt: number; }

const SYNC_ENDPOINT_PATH = '/api/v1/sync/'; // Ścieżka do endpointu WDB Sync

/**
 * Obiekt singletona zawierający funkcje do synchronizacji WatermelonDB.
 */
const syncApiFunctions = { // Zmieniono na obiekt literalny
  /**
   * Faza Pull synchronizacji WatermelonDB.
   */
  async pullChanges({ lastPulledAt, schemaVersion, migration }: PullChangesArgs): Promise<PullChangesResponse> {
    console.log(`[Sync API] Pulling changes (LPA: ${lastPulledAt})`);
    const params = new URLSearchParams();
    params.append('last_pulled_at', lastPulledAt?.toString() ?? 'null');
    params.append('schema_version', schemaVersion.toString());
    params.append('migration', migration ? JSON.stringify(migration) : 'null');
    const endpointWithParams = `${SYNC_ENDPOINT_PATH}?${params.toString()}`;
    console.log(`[Sync API] Pull Endpoint: ${endpointWithParams}`);
    try {
      // Używamy api.get, wymaga autoryzacji
      const data = await api.get<PullChangesResponse>(endpointWithParams, true);
      if (!data || typeof data.changes !== 'object' || typeof data.timestamp !== 'number') {
        throw new Error('[Sync API] Nieprawidłowy format odpowiedzi serwera podczas Pull.');
      }
      console.log(`[Sync API] Pull udany. Timestamp: ${data.timestamp}`);
      return data;
    } catch (error) {
      const apiError = error as ApiError;
      console.error(`[Sync API] Błąd podczas Pull: Status ${apiError?.status ?? 'N/A'}`, apiError?.message ?? error);
      throw error;
    }
  },

  /**
   * Faza Push synchronizacji WatermelonDB.
   */
  async pushChanges({ changes, lastPulledAt }: PushChangesArgs): Promise<void> {
    console.log(`[Sync API] Pushing changes (LPA: ${lastPulledAt})`);
    const params = new URLSearchParams({ last_pulled_at: lastPulledAt.toString() });
    const endpointWithParams = `${SYNC_ENDPOINT_PATH}?${params.toString()}`;
    console.log(`[Sync API] Push Endpoint: ${endpointWithParams}`);
    try {
      // Używamy api.post, wymaga autoryzacji
      await api.post<void>(endpointWithParams, changes, true);
      console.log('[Sync API] Push udany.');
    } catch (error) {
      const apiError = error as ApiError;
      console.error(`[Sync API] Błąd podczas Push: Status ${apiError?.status ?? 'N/A'}`, apiError?.message ?? error);
      if (apiError?.status === 409) {
        console.warn('[Sync API] Wykryto konflikt (409) podczas Push.');
      }
      throw error;
    }
  }
};

export default syncApiFunctions; // Eksportuj obiekt z funkcjami
// Eksportuj też typy, jeśli są potrzebne gdzie indziej
export type {
    PullChangesArgs,
    PullChangesResponse,
    PushChangesArgs,
    SyncPayload,
    SyncMigration
};