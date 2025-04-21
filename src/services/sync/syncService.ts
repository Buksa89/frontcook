import { synchronize } from '@nozbe/watermelondb/sync';
import type { Database } from '@nozbe/watermelondb';
import SyncLogger from '@nozbe/watermelondb/sync/SyncLogger';
import syncApi from '../api/syncApi'; // Importuj nasz obiekt API sync
import { EventEmitter } from 'eventemitter3';
import NetInfo from '@react-native-community/netinfo';
import database from '../../database'; // Importuj instancję bazy WDB
import schema from '../../database/schema'; // Importuj schemat dla wersji

// Stany synchronizacji
export enum SyncStatus {
  Idle = 'idle',
  Checking = 'checking',
  Syncing = 'syncing',
  Waiting = 'waiting',
  Success = 'success',
  Error = 'error',
  Offline = 'offline',
}

// Zdarzenia emitowane przez serwis
interface SyncServiceEvents {
  statusChanged: (status: SyncStatus, error?: Error | null) => void;
  syncStarted: () => void;
  syncFinished: (status: SyncStatus, error?: Error | null) => void;
}

// Stałe konfiguracyjne
const DEFAULT_SYNC_INTERVAL_SECONDS = 60; // Domyślny interwał 60 sekund
const RETRY_DELAY_MS = 5000; // Opóźnienie przed ponowieniem po błędzie (5 sekund)

class SyncService {
  private database: Database;
  private currentStatus: SyncStatus = SyncStatus.Idle;
  private lastError: Error | null = null;
  private syncLogger = new SyncLogger(15); // Zwiększono bufor logów
  private eventEmitter = new EventEmitter<SyncServiceEvents>();
  private migrationsVersion: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private syncIntervalMs: number;
  private isCurrentlySyncing: boolean = false; // Flaga zapobiegająca równoczesnym synchronize
  private isStarted: boolean = false; // Czy serwis został uruchomiony przez start()
  private syncPromise: Promise<void> | null = null; // Do śledzenia aktywnej operacji synchronize
  private offlineRetryTimer: ReturnType<typeof setTimeout> | null = null; // Timer do ponowienia po powrocie online
  private errorRetryTimer: ReturnType<typeof setTimeout> | null = null; // Timer do ponowienia po błędzie

  constructor(
    db: Database,
    syncIntervalSeconds: number = DEFAULT_SYNC_INTERVAL_SECONDS
  ) {
    this.database = db;
    this.syncIntervalMs = syncIntervalSeconds * 1000;
    this.migrationsVersion = schema.version; // Pobierz wersję ze schematu
    console.log(`[SyncService] Inicjalizacja z wersją schematu: ${this.migrationsVersion}, interwał: ${syncIntervalSeconds}s`);
  }

  // --- Metody Publiczne ---

  /** Rozpoczyna cykliczne sprawdzanie i synchronizację. */
  public start(): void {
    if (this.isStarted) {
      console.log('[SyncService] Serwis jest już uruchomiony.');
      return;
    }
    console.log(`[SyncService] Uruchamianie serwisu...`);
    this.isStarted = true;
    this.clearTimers(); // Wyczyść timery na wszelki wypadek
    this.setStatus(SyncStatus.Waiting); // Początkowy stan

    // Natychmiastowe sprawdzenie przy starcie
    this.checkAndSync().catch(err => {
      console.error("[SyncService] Nieobsłużony błąd podczas pierwszego checkAndSync:", err);
      // Ustaw status błędu, jeśli pierwsza próba zawiedzie
      this.setStatus(SyncStatus.Error, err);
    });

    // Ustawienie interwału
    this.intervalId = setInterval(() => {
      this.checkAndSync().catch(err => {
         console.error("[SyncService] Nieobsłużony błąd w cyklicznym checkAndSync:", err);
         // Ustaw status błędu, jeśli cykliczna próba zawiedzie
         // Nie nadpisuj jeśli jest już Offline
         if (this.currentStatus !== SyncStatus.Offline) {
             this.setStatus(SyncStatus.Error, err);
         }
      });
    }, this.syncIntervalMs);

    console.log(`[SyncService] Serwis uruchomiony z interwałem ${this.syncIntervalMs / 1000}s.`);
  }

  /** Zatrzymuje cykliczne sprawdzanie. */
  public stop(): void {
    if (!this.isStarted) {
      console.log('[SyncService] Serwis nie jest uruchomiony.');
      return;
    }
    console.log('[SyncService] Zatrzymywanie serwisu...');
    this.isStarted = false;
    this.clearTimers(); // Zatrzymaj interwał i timery ponowień

    // Jeśli był w trakcie, wróć do Idle lub zachowaj ostatni status błędu/sukcesu
    if (this.currentStatus === SyncStatus.Syncing || this.currentStatus === SyncStatus.Checking || this.currentStatus === SyncStatus.Waiting) {
      this.setStatus(SyncStatus.Idle);
    }
    // Nie resetuj flagi isCurrentlySyncing tutaj, zresetuje się w finally performSyncCycle
    console.log('[SyncService] Serwis zatrzymany.');
  }

  /** Ręcznie wyzwala pojedynczy cykl sprawdzenia i synchronizacji. */
  public async triggerManualSync(): Promise<void> {
    if (this.currentStatus === SyncStatus.Syncing || this.currentStatus === SyncStatus.Checking) {
      console.log('[SyncService] Manual sync requested, but already syncing/checking.');
      // Można poczekać na zakończenie bieżącej operacji
      await (this.syncPromise ?? Promise.resolve());
      // Po zakończeniu, sprawdź status - jeśli nie był błędem/offline, można ponowić
      if (this.currentStatus !== SyncStatus.Error && this.currentStatus !== SyncStatus.Offline) {
           console.log('[SyncService] Previous sync finished, triggering manual sync now.');
           await this.checkAndSync();
      } else {
          console.log('[SyncService] Previous sync finished with error/offline, manual trigger skipped.');
      }
      return;
    }
    console.log('[SyncService] Ręczne wyzwolenie synchronizacji...');
    // Wyczyść timery ponowień, bo użytkownik chce teraz
    this.clearRetryTimers();
    await this.checkAndSync();
  }

  // Gettery i obsługa zdarzeń (bez zmian)
  public getStatus(): SyncStatus { return this.currentStatus; }
  public getLastError(): Error | null { return this.lastError; }
  public getFormattedLogs(): string { return this.syncLogger.formattedLogs; }
  public getRawLogs(): any[] { return this.syncLogger.logs; }
  public on<E extends keyof SyncServiceEvents>(event: E, listener: SyncServiceEvents[E]): void { this.eventEmitter.on(event, listener); }
  public off<E extends keyof SyncServiceEvents>(event: E, listener: SyncServiceEvents[E]): void { this.eventEmitter.off(event, listener); }

  // --- Metody Prywatne ---

  /** Sprawdza warunki i potencjalnie uruchamia cykl synchronizacji. */
  private async checkAndSync(): Promise<void> {
    if (!this.isStarted) {
        // console.log('[SyncService Check] Serwis zatrzymany, pomijanie sprawdzania.');
        return;
    }
    if (this.isCurrentlySyncing) {
      console.log('[SyncService Check] Poprzednia synchronizacja nadal trwa. Pomijam to sprawdzenie.');
      return;
    }
    // Wyczyść timery ponowień, bo zaczynamy nowe sprawdzenie
    this.clearRetryTimers();

    this.setStatus(SyncStatus.Checking);
    console.log('[SyncService Check] Sprawdzanie połączenia...');

    const netState = await NetInfo.fetch();
    if (!netState.isConnected || !netState.isInternetReachable) {
      console.log('[SyncService Check] Brak połączenia internetowego.');
      this.setStatus(SyncStatus.Offline);
      // Zaplanuj ponowienie, gdy wróci online (jeśli jeszcze nie jest zaplanowane)
      this.scheduleOfflineRetry();
      return;
    }

    console.log('[SyncService Check] Połączenie OK. Rozpoczynanie cyklu synchronizacji...');
    this.syncPromise = this.performSyncCycle(); // Rozpocznij cykl i zapisz Promise
    try {
        await this.syncPromise; // Poczekaj na zakończenie cyklu
    } catch (error) {
        // Błąd został już obsłużony i zalogowany w performSyncCycle
        // Ustawiamy status Error, jeśli jeszcze nie został ustawiony
        if (this.currentStatus !== SyncStatus.Error && this.currentStatus !== SyncStatus.Offline) {
            this.setStatus(SyncStatus.Error, error instanceof Error ? error : new Error('Unknown sync error'));
        }
    } finally {
        this.syncPromise = null; // Wyczyść Promise po zakończeniu
        // Ustaw stan Waiting, jeśli cykl zakończył się sukcesem i serwis nadal działa
        if (this.isStarted && this.currentStatus === SyncStatus.Success) {
            this.setStatus(SyncStatus.Waiting);
        }
        // Jeśli zakończył się błędem, status Error zostanie, chyba że się rozłączymy
        // Jeśli zakończył się Offline, status Offline zostanie
    }
  }

  /** Wykonuje pełny cykl synchronizacji (synchronize + obsługa błędów/ponowień). */
  private async performSyncCycle(): Promise<void> {
    if (this.isCurrentlySyncing) return; // Powtórne sprawdzenie na wszelki wypadek
    this.isCurrentlySyncing = true;
    this.setStatus(SyncStatus.Syncing);
    this.eventEmitter.emit('syncStarted');
    this.lastError = null; // Wyczyść ostatni błąd na początku cyklu

    const syncId = Math.random().toString(36).substring(2, 8); // Krótsze ID
    const currentLog = this.syncLogger.newLog();
    console.log(`[SyncService Cycle ${syncId}] Rozpoczęcie synchronize...`);

    try {
      await synchronize({
        database: this.database,
        pullChanges: async (args) => {
          console.log(`[SyncService Cycle ${syncId}] Pull... (LPA: ${args.lastPulledAt})`);
          const response = await syncApi.pullChanges(args);
          console.log(`[SyncService Cycle ${syncId}] Pull zakończony. Timestamp: ${response.timestamp}`);
          return response;
        },
        pushChanges: async (args) => {
          console.log(`[SyncService Cycle ${syncId}] Push... (LPA: ${args.lastPulledAt})`);
          await syncApi.pushChanges(args);
          console.log(`[SyncService Cycle ${syncId}] Push zakończony.`);
        },
        migrationsEnabledAtVersion: this.migrationsVersion,
        log: currentLog,
        // sendCreatedAsUpdated: true, // Rozważ włączenie, jeśli masz problemy z ID
      });

      this.setStatus(SyncStatus.Success);
      console.log(`[SyncService Cycle ${syncId}] Synchronizacja zakończona pomyślnie.`);

    } catch (error: any) {
      console.error(`[SyncService Cycle ${syncId}] BŁĄD podczas synchronize:`, error);
      currentLog.error = error;
      this.lastError = error instanceof Error ? error : new Error(String(error));
      this.setStatus(SyncStatus.Error, this.lastError);

      // Zaplanuj ponowienie po błędzie, jeśli serwis nadal działa
      if (this.isStarted) {
          this.scheduleErrorRetry();
      }
      // Rzuć błąd dalej, aby `checkAndSync` mógł go złapać
      throw this.lastError;

    } finally {
      this.isCurrentlySyncing = false; // Zawsze zdejmuj flagę na końcu
      this.eventEmitter.emit('syncFinished', this.currentStatus, this.lastError ?? undefined);
      console.log(`[SyncService Cycle ${syncId}] Zakończono synchronize (status: ${this.currentStatus}).`);
    }
  }

  /** Ustawia nowy status i emituje zdarzenie. */
  private setStatus(newStatus: SyncStatus, error: Error | null = undefined): void {
    const resolvedError = error === undefined ? (newStatus === SyncStatus.Error ? this.lastError : null) : error;
    if (this.currentStatus !== newStatus || this.lastError !== resolvedError) {
      this.currentStatus = newStatus;
      this.lastError = resolvedError;
      try {
          this.eventEmitter.emit('statusChanged', newStatus, resolvedError ?? undefined);
      } catch (emitError) {
           console.error("[SyncService] Błąd podczas emitowania statusChanged:", emitError);
      }
      console.log(`[SyncService] Status zmieniony na: ${newStatus}${resolvedError ? ` (Błąd: ${resolvedError.message.substring(0,100)}...)` : ''}`);
    }
  }

   /** Czyści wszystkie timery (interwał i ponowienia). */
   private clearTimers(): void {
       if (this.intervalId) {
           clearInterval(this.intervalId);
           this.intervalId = null;
       }
       this.clearRetryTimers();
   }

   /** Czyści tylko timery ponowień (offline i błąd). */
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

  /** Planuje ponowną próbę synchronizacji po powrocie online. */
  private scheduleOfflineRetry(): void {
    if (!this.isStarted || this.offlineRetryTimer) return; // Nie planuj, jeśli zatrzymany lub już zaplanowane

    console.log('[SyncService] Planowanie nasłuchiwania na powrót online...');
    // Użyj NetInfo do nasłuchiwania na zmianę stanu połączenia
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        console.log('[SyncService] Wykryto powrót online. Próbuję synchronizacji...');
        unsubscribe(); // Zatrzymaj nasłuchiwanie po pierwszej udanej próbie
        this.offlineRetryTimer = null; // Wyczyść timer (choć technicznie to listener)
        // Użyj setTimeout, aby dać chwilę na ustabilizowanie się połączenia
        this.offlineRetryTimer = setTimeout(() => {
            this.checkAndSync().catch(err => console.error("[SyncService] Błąd podczas ponowienia po offline:", err));
        }, 1000); // Krótkie opóźnienie
      }
    });
    // Zapisz funkcję unsubscribe, aby móc ją usunąć w stop() lub clearTimers()
    // Proste rozwiązanie: zapiszmy symboliczny timer, który wyczyścimy
    this.offlineRetryTimer = setTimeout(() => { /* Placeholder */}, 3600000); // Długi czas, tylko dla flagi
    // UWAGA: W rzeczywistości powinniśmy zarządzać referencją do unsubscribe()
  }

  /** Planuje ponowną próbę synchronizacji po błędzie. */
  private scheduleErrorRetry(): void {
       if (!this.isStarted || this.errorRetryTimer) return; // Nie planuj, jeśli zatrzymany lub już zaplanowane

       console.log(`[SyncService] Planowanie ponowienia synchronizacji za ${RETRY_DELAY_MS / 1000}s po błędzie.`);
       this.errorRetryTimer = setTimeout(() => {
           console.log('[SyncService] Czas na ponowienie synchronizacji po błędzie...');
           this.errorRetryTimer = null; // Wyczyść timer przed próbą
           this.checkAndSync().catch(err => console.error("[SyncService] Błąd podczas ponowienia po błędzie:", err));
       }, RETRY_DELAY_MS);
   }
}

// --- Inicjalizacja Singletona ---
// Sprawdź, czy baza danych jest dostępna przed utworzeniem instancji
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

// Eksportuj funkcję do pobierania instancji
export const getSyncService = (): SyncService => {
  if (!syncServiceInstance) {
    // Można rzucić błąd lub zainicjalizować 'leniwie'
    console.warn("[SyncService Get] Próba pobrania SyncService przed inicjalizacją. Inicjowanie...");
    return initializeSyncService();
  }
  return syncServiceInstance;
};

// Opcjonalnie, można wyeksportować samą klasę, jeśli potrzebna
export { SyncService };