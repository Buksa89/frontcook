// src/services/sync/SyncService.ts

import { synchronize, hasUnsyncedChanges } from '@nozbe/watermelondb/sync'; // Dodajemy hasUnsyncedChanges
import type { Database } from '@nozbe/watermelondb';
import SyncLogger from '@nozbe/watermelondb/sync/SyncLogger';
import { pullChanges, pushChanges } from './sync';
import { EventEmitter } from 'eventemitter3';
import NetInfo from '@react-native-community/netinfo'; // Do sprawdzania połączenia

export enum SyncStatus {
  Idle = 'idle', // Nieaktywny (zatrzymany lub przed startem)
  Checking = 'checking', // Sprawdza połączenie/zmiany (stan pośredni)
  Syncing = 'syncing', // Aktywna synchronizacja
  Waiting = 'waiting', // Oczekuje na następne sprawdzenie
  Success = 'success', // Ostatnia próba synchronizacji udana
  Error = 'error', // Ostatnia próba synchronizacji nieudana
  Offline = 'offline', // Brak połączenia internetowego
}

interface SyncServiceEvents {
  statusChanged: (status: SyncStatus, error?: Error | null) => void;
  syncStarted: () => void;
  syncFinished: (status: SyncStatus, error?: Error | null) => void;
}

class SyncService {
  private database: Database;
  private currentStatus: SyncStatus = SyncStatus.Idle;
  private lastError: Error | null = null;
  private syncLogger = new SyncLogger(10);
  private eventEmitter = new EventEmitter<SyncServiceEvents>();
  private migrationsVersion: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private syncIntervalMs: number; // Interwał sprawdzania w milisekundach
  private isCurrentlySyncing: boolean = false; // Flaga dla wewnętrznego synchronize
  private isStarted: boolean = false; // Czy serwis został uruchomiony

  constructor(
      database: Database,
      migrationsEnabledAtVersion: number,
      syncIntervalSeconds: number = 30 // Domyślny interwał 30 sekund
    ) {
    this.database = database;
    this.syncIntervalMs = syncIntervalSeconds * 1000;

    if (typeof migrationsEnabledAtVersion !== 'number' || migrationsEnabledAtVersion < 1) {
        console.warn(`[SyncService] Nieprawidłowa wartość migrationsEnabledAtVersion: ${migrationsEnabledAtVersion}. Używanie wartości 1.`);
        this.migrationsVersion = 1;
    } else {
        this.migrationsVersion = migrationsEnabledAtVersion;
    }
  }

  // --- Metody Publiczne ---

  /** Rozpoczyna cykliczne sprawdzanie i synchronizację. */
  public start(): void {
    if (this.isStarted) {
      console.log('[SyncService] Serwis jest już uruchomiony.');
      return;
    }

    console.log(`[SyncService] Uruchamianie serwisu z interwałem ${this.syncIntervalMs / 1000}s.`);
    this.isStarted = true;
    this.setStatus(SyncStatus.Waiting); // Zaczynamy od oczekiwania

    // Natychmiastowe sprawdzenie przy starcie
    this.checkAndSync();

    // Ustawienie interwału
    this.intervalId = setInterval(() => {
      this.checkAndSync();
    }, this.syncIntervalMs);
  }

  /** Zatrzymuje cykliczne sprawdzanie. */
  public stop(): void {
    if (!this.isStarted) {
      console.log('[SyncService] Serwis nie jest uruchomiony.');
      return;
    }

    console.log('[SyncService] Zatrzymywanie serwisu.');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isStarted = false;
    // Nie resetujemy statusu Error/Success, aby UI mogło pokazać ostatni wynik
    // Jeśli był w trakcie Syncing, wróćmy do Idle lub poprzedniego stanu
    if (this.currentStatus === SyncStatus.Syncing || this.currentStatus === SyncStatus.Checking || this.currentStatus === SyncStatus.Waiting) {
        this.setStatus(SyncStatus.Idle);
    }
     // Resetujemy flagę synchronize, jeśli przypadkiem została aktywna
     this.isCurrentlySyncing = false;
  }

  /** Ręcznie wyzwala pojedynczy cykl sprawdzenia i synchronizacji. */
  public async triggerManualSync(): Promise<void> {
     if (!this.isStarted) {
         console.warn('[SyncService] Serwis nie jest uruchomiony. Ręczna synchronizacja nie zostanie wykonana cyklicznie.');
         // Można zdecydować, czy mimo to wykonać jednorazowo:
         await this.checkAndSync();
         return;
     }
      if (this.currentStatus === SyncStatus.Syncing || this.currentStatus === SyncStatus.Checking) {
          console.log('[SyncService] Synchronizacja lub sprawdzanie jest już w toku.');
          return;
      }
      console.log('[SyncService] Ręczne wyzwolenie synchronizacji...');
      await this.checkAndSync();
  }


  public getStatus(): SyncStatus { return this.currentStatus; }
  public getLastError(): Error | null { return this.lastError; }
  public getFormattedLogs(): string { return this.syncLogger.formattedLogs; }
  public getRawLogs(): any[] { return this.syncLogger.logs; }
  public on<E extends keyof SyncServiceEvents>(event: E, listener: SyncServiceEvents[E]): void { this.eventEmitter.on(event, listener); }
  public off<E extends keyof SyncServiceEvents>(event: E, listener: SyncServiceEvents[E]): void { this.eventEmitter.off(event, listener); }

  // --- Metody Prywatne ---

  /** Sprawdza warunki i potencjalnie uruchamia synchronizację. */
  private async checkAndSync(): Promise<void> {
    if (this.isCurrentlySyncing) {
      console.log('[SyncService Check] Poprzednia synchronizacja nadal trwa. Pomijam to sprawdzenie.');
      return;
    }

    this.setStatus(SyncStatus.Checking);

    // 1. Sprawdź połączenie internetowe
    const netState = await NetInfo.fetch();
    if (!netState.isConnected || !netState.isInternetReachable) {
      console.log('[SyncService Check] Brak połączenia internetowego.');
      this.setStatus(SyncStatus.Offline);
      // Po powrocie online, następny interwał lub triggerManualSync to sprawdzi
      return;
    }

    // 2. Sprawdź, czy są lokalne zmiany do wysłania (opcjonalne, ale może optymalizować)
    //    Jeśli nie ma zmian lokalnych, można by rzadziej synchronizować PULL?
    //    Na razie pomińmy tę optymalizację i synchronizujmy zawsze, gdy online.
    // try {
    //   const hasChanges = await hasUnsyncedChanges({ database: this.database });
    //   if (hasChanges) {
    //     console.log('[SyncService Check] Wykryto lokalne zmiany do wysłania.');
    //   }
    // } catch (err) {
    //    console.error('[SyncService Check] Błąd podczas sprawdzania hasUnsyncedChanges:', err);
    // }

    // 3. Uruchom pełną synchronizację (jeśli nie trwa i jesteśmy online)
    this.isCurrentlySyncing = true; // Ustaw flagę wewnętrznego synchronize
    this.setStatus(SyncStatus.Syncing);
    this.eventEmitter.emit('syncStarted');
    this.lastError = null;
    const syncId = Date.now();
    const currentLog = this.syncLogger.newLog();
    console.log(`[SyncService ${syncId}] Rozpoczynanie cyklu synchronize...`);

    try {
      // Pierwsza próba
      await this.performSync(syncId, currentLog, 'Initial');
      this.setStatus(SyncStatus.Success);
      console.log(`[SyncService ${syncId}] Cykl synchronize zakończony pomyślnie.`);

    } catch (error: any) {
      console.error(`[SyncService ${syncId}] Błąd podczas pierwszej próby synchronize:`, error);
      currentLog.error = error;
      this.lastError = error;

      // Druga próba (Retry)
      console.log(`[SyncService ${syncId}] Ponawianie synchronize...`);
      const retryLog = this.syncLogger.newLog();
      try {
        await this.performSync(syncId, retryLog, 'Retry');
        this.setStatus(SyncStatus.Success);
        this.lastError = null; // Sukces po ponowieniu
        console.log(`[SyncService ${syncId}] Cykl synchronize zakończony pomyślnie po ponowieniu.`);
      } catch (retryError: any) {
        console.error(`[SyncService ${syncId}] Błąd podczas PONOWNEJ próby synchronize:`, retryError);
        retryLog.error = retryError;
        this.lastError = retryError;
        this.setStatus(SyncStatus.Error, retryError);
      }
    } finally {
       this.isCurrentlySyncing = false; // Zdejmij flagę wewnętrznego synchronize
       // Po zakończeniu synchronizacji (udanej lub nie), wróć do stanu oczekiwania,
       // chyba że serwis został zatrzymany w międzyczasie.
       if (this.isStarted) {
            // Jeśli ostatni status to Error, nie nadpisuj go od razu na Waiting
            if (this.currentStatus !== SyncStatus.Error) {
                this.setStatus(SyncStatus.Waiting);
            }
       } else {
            // Jeśli serwis został zatrzymany podczas synchronizacji
            this.setStatus(SyncStatus.Idle);
       }
       console.log(`[SyncService ${syncId}] Zakończono próbę synchronizacji (finalny status: ${this.currentStatus}).`);
       this.eventEmitter.emit('syncFinished', this.currentStatus, this.lastError ?? undefined);
    }
  }

  /** Wykonuje pojedynczy cykl synchronize (bez zmian w tej metodzie) */
  private async performSync(syncId: number, log: any, attemptLabel: string): Promise<void> {
    console.log(`[SyncService ${syncId} - ${attemptLabel}] Wykonywanie synchronize...`);
    await synchronize({
      database: this.database,
      pullChanges: async (args) => {
        console.log(`[SyncService ${syncId} - ${attemptLabel}] Faza Pull...`, args);
        const result = await pullChanges(args); // Używa funkcji z sync.ts
        console.log(`[SyncService ${syncId} - ${attemptLabel}] Pull zakończony. Timestamp serwera: ${result.timestamp}`);
        return result;
      },
      pushChanges: async (args) => {
        console.log(`[SyncService ${syncId} - ${attemptLabel}] Faza Push...`, args);
        await pushChanges(args); // Używa funkcji z sync.ts
        console.log(`[SyncService ${syncId} - ${attemptLabel}] Push zakończony.`);
      },
      migrationsEnabledAtVersion: this.migrationsVersion,
      log: log,
    });
  }

  /** Ustawia nowy status i emituje zdarzenie (bez zmian) */
  private setStatus(newStatus: SyncStatus, error?: Error | null): void {
    // Akceptujemy null dla błędu, aby móc go wyczyścić
    const currentError = error === undefined ? this.lastError : error;
    if (this.currentStatus !== newStatus || this.lastError !== currentError) {
      this.currentStatus = newStatus;
      this.lastError = currentError; // Aktualizuj lastError razem ze statusem
      this.eventEmitter.emit('statusChanged', newStatus, currentError ?? undefined);
      console.log(`[SyncService] Status zmieniony na: ${newStatus}${currentError ? ' (z błędem)' : ''}`);
    }
  }
}

export default SyncService;