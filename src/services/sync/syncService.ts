// src/services/sync/syncService.ts
import { synchronize } from '@nozbe/watermelondb/sync';
import type { Database } from '@nozbe/watermelondb';
import SyncLogger from '@nozbe/watermelondb/sync/SyncLogger';
import syncApi from '../api/syncApi'; // Importuj nasz obiekt API sync
import { EventEmitter } from 'eventemitter3';
// --- POPRAWIONY IMPORT NetInfo ---
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
// ---------------------------------
import database from '../../database'; // Importuj instancję bazy WDB
import schema from '../../database/schema'; // Importuj schemat dla wersji
import AuthStorage from '../auth/authStorage'; // Import do zarządzania LPA
import { getCurrentUserId } from '../auth/authUserIdProvider'; // Do pobrania ID użytkownika

// Stany synchronizacji
export enum SyncStatus {
  Idle = 'idle',
  Checking = 'checking',
  Syncing = 'syncing',
  Waiting = 'waiting',
  Success = 'success',
  Error = 'error',
  Offline = 'offline',
  Stopped = 'stopped', // Dodano stan 'Stopped'
}

// Zdarzenia emitowane przez serwis
interface SyncServiceEvents {
  // --- POPRAWIONA SYGNATURA TYPU ---
  statusChanged: (status: SyncStatus, error: Error | null) => void;
  // ---------------------------------
  syncStarted: () => void;
  syncFinished: (status: SyncStatus, error: Error | null) => void;
}

// Stałe konfiguracyjne
const DEFAULT_SYNC_INTERVAL_SECONDS = 60;
const RETRY_DELAY_MS = 5000;

class SyncService {
  private database: Database;
  private currentStatus: SyncStatus = SyncStatus.Idle;
  private lastError: Error | null = null;
  private syncLogger = new SyncLogger(15);
  private eventEmitter = new EventEmitter<SyncServiceEvents>();
  private migrationsVersion: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private syncIntervalMs: number;
  private isCurrentlySyncing: boolean = false;
  private isStarted: boolean = false;
  private syncPromise: Promise<void> | null = null;
  private offlineRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private errorRetryTimer: ReturnType<typeof setTimeout> | null = null;
  // --- DODANO: Do zarządzania listenerem NetInfo ---
  private netInfoUnsubscribe: (() => void) | null = null;
  // ---------------------------------------------

  constructor(
    db: Database,
    syncIntervalSeconds: number = DEFAULT_SYNC_INTERVAL_SECONDS
  ) {
    this.database = db;
    this.syncIntervalMs = syncIntervalSeconds * 1000;
    this.migrationsVersion = schema.version;
    console.log(`[SyncService] Inicjalizacja z wersją schematu: ${this.migrationsVersion}, interwał: ${syncIntervalSeconds}s`);
  }

  // --- Metody Publiczne ---

  public start(): void {
    if (this.isStarted) {
      console.log('[SyncService] Serwis jest już uruchomiony.');
      return;
    }
    console.log(`[SyncService] Uruchamianie serwisu...`);
    this.isStarted = true;
    this.clearTimers();
    this.setStatus(SyncStatus.Waiting);

    this.checkAndSync().catch(err => {
      console.error("[SyncService] Nieobsłużony błąd podczas pierwszego checkAndSync:", err);
      if (this.isStarted) {
        this.setStatus(SyncStatus.Error, err instanceof Error ? err : new Error(String(err)));
        this.scheduleErrorRetry(); // Zaplanuj ponowienie po błędzie startowym
      }
    });

    this.intervalId = setInterval(() => {
      this.checkAndSync().catch(err => {
         console.error("[SyncService] Nieobsłużony błąd w cyklicznym checkAndSync:", err);
         if (this.isStarted && this.currentStatus !== SyncStatus.Offline) {
             this.setStatus(SyncStatus.Error, err instanceof Error ? err : new Error(String(err)));
             this.scheduleErrorRetry(); // Zaplanuj ponowienie po błędzie cyklicznym
         }
      });
    }, this.syncIntervalMs);

    console.log(`[SyncService] Serwis uruchomiony z interwałem ${this.syncIntervalMs / 1000}s.`);
  }

  public stop(): void {
    if (!this.isStarted) {
      console.log('[SyncService] Serwis nie jest uruchomiony.');
      return;
    }
    console.log('[SyncService] Zatrzymywanie serwisu...');
    this.isStarted = false;
    this.clearTimers(); // To teraz również anuluje listener NetInfo

    if (this.currentStatus !== SyncStatus.Error && this.currentStatus !== SyncStatus.Success && this.currentStatus !== SyncStatus.Offline) {
      this.setStatus(SyncStatus.Stopped);
    }
    console.log('[SyncService] Serwis zatrzymany.');
  }

  public async triggerManualSync(): Promise<void> {
    if (!this.isStarted) {
        console.warn('[SyncService] Ręczne wyzwolenie, ale serwis jest zatrzymany.');
        return;
    }

    if (this.currentStatus === SyncStatus.Syncing || this.currentStatus === SyncStatus.Checking) {
      console.log('[SyncService] Manual sync requested, but already syncing/checking. Waiting...');
      try {
          await (this.syncPromise ?? Promise.resolve());
      } catch { /* Ignoruj błąd poprzedniej synchronizacji */ }
      if (this.currentStatus === SyncStatus.Syncing || this.currentStatus === SyncStatus.Checking) {
          console.warn('[SyncService] Manual sync still blocked after waiting.');
          return;
      }
      console.log('[SyncService] Previous sync finished, proceeding with manual trigger.');
    }

    console.log('[SyncService] Ręczne wyzwolenie synchronizacji...');
    this.clearRetryTimers();
    await this.checkAndSync();
  }

  public getStatus(): SyncStatus { return this.currentStatus; }
  public getLastError(): Error | null { return this.lastError; }
  public getFormattedLogs(): string { return this.syncLogger.formattedLogs; }
  public getRawLogs(): any[] { return this.syncLogger.logs; }

  // --- POPRAWIONE TYPY on/off ---
  public on<E extends keyof SyncServiceEvents>(event: E, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener as any); // Używamy 'as any' lub bardziej precyzyjnego typu jeśli to możliwe
  }
  public off<E extends keyof SyncServiceEvents>(event: E, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener as any);
  }
  // ----------------------------

  // --- Metody Prywatne ---

  private async checkAndSync(): Promise<void> {
    if (!this.isStarted) { return; }
    if (this.isCurrentlySyncing) { console.log('[SyncService Check] Poprzednia synchronizacja nadal trwa.'); return; }
    this.clearRetryTimers();

    this.setStatus(SyncStatus.Checking);
    console.log('[SyncService Check] Sprawdzanie...');

    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('[SyncService Check] Brak zalogowanego użytkownika. Zatrzymywanie serwisu.');
      this.setStatus(SyncStatus.Idle);
      this.stop();
      return;
    }

    // --- POPRAWKA: Obsługa NetInfoState ---
    let netState: NetInfoState;
    try {
        netState = await NetInfo.fetch();
    } catch (netError) {
         console.error("[SyncService Check] Błąd pobierania stanu sieci:", netError);
         this.setStatus(SyncStatus.Error, new Error("Nie można sprawdzić połączenia sieciowego."));
         this.scheduleErrorRetry(); // Zaplanuj ponowienie po błędzie NetInfo
         return;
    }
    // -----------------------------------

    if (!netState.isConnected || !netState.isInternetReachable) {
      console.log('[SyncService Check] Brak połączenia internetowego.');
      this.setStatus(SyncStatus.Offline);
      this.scheduleOfflineRetry();
      return;
    }

    console.log('[SyncService Check] Warunki spełnione. Rozpoczynanie cyklu synchronizacji...');
    this.syncPromise = this.performSyncCycle(userId);
    try {
        await this.syncPromise;
    } catch (error) {
        // Błąd jest już obsłużony w performSyncCycle, który ustawia status Error
        // Uproszczono warunek - jeśli serwis działa i status NIE jest Offline, planujemy ponowienie
        if (this.isStarted && this.currentStatus !== SyncStatus.Offline) {
             this.scheduleErrorRetry();
        }
    } finally {
        this.syncPromise = null;
        if (this.isStarted && this.currentStatus === SyncStatus.Success) {
            this.setStatus(SyncStatus.Waiting);
        }
    }
  }

  private async performSyncCycle(userId: string): Promise<void> {
    if (this.isCurrentlySyncing) return;
    this.isCurrentlySyncing = true;
    this.setStatus(SyncStatus.Syncing);
    this.eventEmitter.emit('syncStarted');
    this.lastError = null;

    const syncId = Math.random().toString(36).substring(2, 8);
    const currentLog = this.syncLogger.newLog();
    console.log(`[SyncService Cycle ${syncId}] Rozpoczęcie dla User ID: ${userId}...`);

    let userLPA: number | null = null;
    try {
        userLPA = await AuthStorage.retrieveLastPulledAt(userId);
        console.log(`[SyncService Cycle ${syncId}] Odczytano User LPA (${userId}): ${userLPA ?? 'null'}`);
    } catch (lpaError) {
         console.error(`[SyncService Cycle ${syncId}] Błąd odczytu User LPA dla ${userId}:`, lpaError);
         const error = new Error("Błąd odczytu stanu synchronizacji.");
         this.setStatus(SyncStatus.Error, error);
         this.isCurrentlySyncing = false;
         this.eventEmitter.emit('syncFinished', this.currentStatus, this.lastError);
         // Nie planujemy ponowienia tutaj, zrobi to checkAndSync
         throw error; // Rzuć błąd, aby zatrzymać cykl
    }

    try {
      await synchronize({
        database: this.database,
        pullChanges: async (args) => {
          const wdbLPA = args.lastPulledAt;
          const lpaToSend = userLPA;
          console.log(`[SyncService Cycle ${syncId}] Pull... (WDB LPA: ${wdbLPA ?? 'null'}, User LPA: ${userLPA ?? 'null'}) -> Sending LPA: ${lpaToSend ?? 'null'}`);
          if (userLPA === null && wdbLPA !== null) {
              console.warn(`[SyncService Cycle ${syncId}] Niespójność LPA: User LPA jest null, ale WDB LPA to ${wdbLPA}. Używam null.`);
          }
          const response = await syncApi.pullChanges({ ...args, lastPulledAt: lpaToSend });
          const newTimestamp = response.timestamp;
          try {
              await AuthStorage.storeLastPulledAt(userId, newTimestamp);
          } catch (saveLpaError) {
               console.error(`[SyncService Cycle ${syncId}] KRYTYCZNY BŁĄD zapisu nowego LPA (${newTimestamp}) dla ${userId} po udanym Pull:`, saveLpaError);
               throw new Error(`Błąd zapisu nowego LPA po Pull: ${saveLpaError}`);
          }
          console.log(`[SyncService Cycle ${syncId}] Pull zakończony. Nowy Timestamp: ${newTimestamp} (zapisany dla ${userId})`);
          return { changes: response.changes, timestamp: newTimestamp };
        },
        pushChanges: async (args) => {
          const wdbLPA = args.lastPulledAt;
          let lpaForPush: number | null = null;
          try {
              lpaForPush = await AuthStorage.retrieveLastPulledAt(userId);
              if (lpaForPush === null) {
                  console.error(`[SyncService Cycle ${syncId}] BŁĄD KRYTYCZNY: LPA dla push jest null po udanym pullu dla ${userId}! Używam WDB LPA: ${wdbLPA}`);
                  lpaForPush = wdbLPA;
              }
          } catch (lpaError) {
               console.error(`[SyncService Cycle ${syncId}] Błąd odczytu LPA dla push (${userId}):`, lpaError);
               lpaForPush = wdbLPA;
          }
          console.log(`[SyncService Cycle ${syncId}] Push... (WDB LPA: ${wdbLPA}, User LPA for Push: ${lpaForPush})`);
          if (lpaForPush === null) {
              // To nie powinno się zdarzyć, ale zabezpieczamy się
              throw new Error("Nie można wykonać Push bez prawidłowego lastPulledAt.");
          }
          await syncApi.pushChanges({ changes: args.changes, lastPulledAt: lpaForPush });
          console.log(`[SyncService Cycle ${syncId}] Push zakończony.`);
        },
        migrationsEnabledAtVersion: this.migrationsVersion,
        log: currentLog,
        // sendCreatedAsUpdated: true,
      });

      this.setStatus(SyncStatus.Success);
      console.log(`[SyncService Cycle ${syncId}] Synchronizacja zakończona pomyślnie.`);

    } catch (error: any) {
      console.error(`[SyncService Cycle ${syncId}] BŁĄD podczas synchronize:`, error);
      currentLog.error = error;
      this.lastError = error instanceof Error ? error : new Error(String(error));
      this.setStatus(SyncStatus.Error, this.lastError);
      // Rzuć błąd dalej, aby checkAndSync mógł go złapać
      throw this.lastError;

    } finally {
      this.isCurrentlySyncing = false;
      // --- POPRAWKA: Przekaż null jako drugi argument jeśli nie ma błędu ---
      this.eventEmitter.emit('syncFinished', this.currentStatus, this.lastError);
      // -------------------------------------------------------------------
      console.log(`[SyncService Cycle ${syncId}] Zakończono synchronize (status: ${this.currentStatus}).`);
    }
  }

  private setStatus(newStatus: SyncStatus, error: Error | null = null): void { // Domyślna wartość null jest ok
    const resolvedError = error; // Błąd jest przekazywany bezpośrednio
    if (this.currentStatus !== newStatus || this.lastError !== resolvedError) {
      this.currentStatus = newStatus;
      this.lastError = resolvedError;
      try {
          // --- POPRAWKA: Przekaż resolvedError (który jest Error | null) ---
          this.eventEmitter.emit('statusChanged', newStatus, resolvedError);
          this.eventEmitter.emit('syncFinished', newStatus, resolvedError); // Emituj też tutaj dla spójności? Albo usuń jeden z nich. Zostawmy na razie oba.
          // -------------------------------------------------------------
      } catch (emitError) {
           console.error("[SyncService] Błąd podczas emitowania zdarzenia:", emitError);
      }
      console.log(`[SyncService] Status zmieniony na: ${newStatus}${resolvedError ? ` (Błąd: ${resolvedError.message.substring(0,100)}...)` : ''}`);
    }
  }

   private clearTimers(): void {
       if (this.intervalId) {
           clearInterval(this.intervalId);
           this.intervalId = null;
       }
       // --- DODANO: Anulowanie listenera NetInfo ---
       if (this.netInfoUnsubscribe) {
           this.netInfoUnsubscribe();
           this.netInfoUnsubscribe = null;
           console.log('[SyncService] Anulowano nasłuchiwanie NetInfo.');
       }
       // -----------------------------------------
       this.clearRetryTimers();
   }

   private clearRetryTimers(): void {
       if (this.offlineRetryTimer) {
           clearTimeout(this.offlineRetryTimer);
           this.offlineRetryTimer = null;
       }
       if (this.errorRetryTimer) {
           clearTimeout(this.errorRetryTimer);
           this.errorRetryTimer = null;
       }
   }

  private scheduleOfflineRetry(): void {
    if (!this.isStarted || this.netInfoUnsubscribe) return; // Nie planuj, jeśli zatrzymany lub już nasłuchuje

    console.log('[SyncService] Planowanie nasłuchiwania na powrót online...');

    // --- POPRAWKA: Użycie NetInfoState i poprawne zarządzanie unsubscribe ---
    const listener = (state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable) {
        console.log('[SyncService] Wykryto powrót online. Próbuję synchronizacji...');
        if (this.netInfoUnsubscribe) {
          this.netInfoUnsubscribe(); // Zatrzymaj nasłuchiwanie
          this.netInfoUnsubscribe = null;
        }
        this.offlineRetryTimer = null; // Wyczyść flagę timera
        // Użyj setTimeout dla krótkiego opóźnienia
        this.offlineRetryTimer = setTimeout(() => {
            this.offlineRetryTimer = null;
            // Sprawdź ponownie, czy serwis nadal działa przed próbą
            if (this.isStarted) {
                this.checkAndSync().catch(err => console.error("[SyncService] Błąd podczas ponowienia po offline:", err));
            } else {
                 console.log("[SyncService] Powrót online, ale serwis został zatrzymany. Pomijanie ponowienia.");
            }
        }, 1000);
      }
    };
    // ---------------------------------------------------------------------

    this.netInfoUnsubscribe = NetInfo.addEventListener(listener);
    console.log('[SyncService] Nasłuchiwanie NetInfo aktywowane.');
    // Nie potrzebujemy już placeholdera setTimeout
  }

  private scheduleErrorRetry(): void {
       if (!this.isStarted || this.errorRetryTimer) return;

       console.log(`[SyncService] Planowanie ponowienia synchronizacji za ${RETRY_DELAY_MS / 1000}s po błędzie.`);
       this.errorRetryTimer = setTimeout(() => {
           console.log('[SyncService] Czas na ponowienie synchronizacji po błędzie...');
           this.errorRetryTimer = null;
           // Sprawdź ponownie, czy serwis nadal działa
            if (this.isStarted) {
               this.checkAndSync().catch(err => console.error("[SyncService] Błąd podczas ponowienia po błędzie:", err));
           } else {
               console.log("[SyncService] Czas na ponowienie, ale serwis został zatrzymany. Pomijanie.");
           }
       }, RETRY_DELAY_MS);
   }
}

// --- Inicjalizacja Singletona ---
let syncServiceInstance: SyncService | null = null;

export const initializeSyncService = (): SyncService => {
  if (syncServiceInstance) {
    return syncServiceInstance;
  }
  if (!database) {
    throw new Error("[SyncService Init] Baza danych nie została zainicjalizowana przed SyncService.");
  }
  syncServiceInstance = new SyncService(database);
  console.log('[SyncService] Instancja SyncService została utworzona.');
  return syncServiceInstance;
};

export const getSyncService = (): SyncService => {
  if (!syncServiceInstance) {
    console.warn("[SyncService Get] Próba pobrania SyncService przed inicjalizacją. Inicjowanie...");
    return initializeSyncService();
  }
  return syncServiceInstance;
};

export { SyncService };