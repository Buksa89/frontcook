// src/services/sync/syncService.ts
import { synchronize } from '@nozbe/watermelondb/sync';
import type { Database } from '@nozbe/watermelondb';
import SyncLogger from '@nozbe/watermelondb/sync/SyncLogger';
import syncApi from '../api/syncApi';
import { EventEmitter } from 'eventemitter3';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import database from '../../database';
import schema from '../../database/schema';
import AuthStorage from '../auth/authStorage';
import { getCurrentUserId } from '../auth/authUserIdProvider';
// --- DODANO: Import useAuth i ApiError ---
import { useAuth } from '../../contexts/AuthContext'; // Potrzebne do sprawdzania sessionExpired
import { ApiError } from '../api/apiClient'; // Do sprawdzania błędów sesji
// ----------------------------------------

// Stany synchronizacji (bez zmian)
export enum SyncStatus { Idle = 'idle', Checking = 'checking', Syncing = 'syncing', Waiting = 'waiting', Success = 'success', Error = 'error', Offline = 'offline', Stopped = 'stopped', }

// Zdarzenia emitowane (bez zmian)
interface SyncServiceEvents { statusChanged: (status: SyncStatus, error: Error | null) => void; syncStarted: () => void; syncFinished: (status: SyncStatus, error: Error | null) => void; }

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
  private netInfoUnsubscribe: (() => void) | null = null;
  // --- DODANO: Do przechowywania stanu sesji ---
  private isSessionExpired: boolean = false;
  // ------------------------------------------

  constructor(
    db: Database,
    syncIntervalSeconds: number = DEFAULT_SYNC_INTERVAL_SECONDS
  ) {
    this.database = db;
    this.syncIntervalMs = syncIntervalSeconds * 1000;
    this.migrationsVersion = schema.version;
    console.log(`[SyncService] Inicjalizacja z wersją schematu: ${this.migrationsVersion}, interwał: ${syncIntervalSeconds}s`);
    // Nie subskrybujemy NetInfo tutaj, zrobimy to w start()
  }

  // --- Metoda do aktualizacji stanu sesji ---
  public updateSessionStatus(isExpired: boolean): void {
      if (this.isSessionExpired !== isExpired) {
          console.log(`[SyncService] Aktualizacja stanu sesji: ${this.isSessionExpired} -> ${isExpired}`);
          this.isSessionExpired = isExpired;
          // Jeśli sesja wygasła, a serwis działa, zatrzymaj próby synchronizacji
          if (isExpired && this.isStarted) {
              console.log("[SyncService] Sesja wygasła, zatrzymuję próby synchronizacji i ustawiam status na Offline (lub inny).");
              this.clearTimers(); // Zatrzymaj interwały i timery
              this.setStatus(SyncStatus.Offline); // Ustaw status na Offline, bo bez sesji nie da się synchronizować
              // TODO: Rozważ dodanie dedykowanego statusu np. PausedSessionExpired
          }
          // Jeśli sesja została odnowiona (isExpired=false), a serwis działa,
          // wyzwól próbę synchronizacji (jeśli status nie jest już Syncing/Checking)
          else if (!isExpired && this.isStarted && this.currentStatus !== SyncStatus.Syncing && this.currentStatus !== SyncStatus.Checking) {
               console.log("[SyncService] Sesja odnowiona, próbuję synchronizacji...");
               this.checkAndSync().catch(err => console.error("[SyncService] Błąd podczas próby sync po odnowieniu sesji:", err));
          }
      }
  }
  // ------------------------------------------

  public start(): void {
    if (this.isStarted) {
      console.log('[SyncService] Serwis jest już uruchomiony.');
      return;
    }
    console.log(`[SyncService] Uruchamianie serwisu...`);
    this.isStarted = true;
    this.clearTimers();
    // Subskrybuj do NetInfo przy starcie
    if (!this.netInfoUnsubscribe) {
        this.netInfoUnsubscribe = NetInfo.addEventListener(this.handleNetStateChange.bind(this));
        console.log('[SyncService] Aktywowano nasłuchiwanie NetInfo.');
    }

    // Ustaw początkowy status na podstawie bieżącego stanu sieci i sesji
    NetInfo.fetch().then(netState => {
        const isOnline = !!netState.isConnected && !!netState.isInternetReachable;
        if (this.isSessionExpired) {
            this.setStatus(SyncStatus.Offline); // Sesja wygasła - traktujemy jak offline dla sync
        } else if (!isOnline) {
            this.setStatus(SyncStatus.Offline);
        } else {
            this.setStatus(SyncStatus.Waiting); // Jest online i sesja ważna - czekaj na interwał
            // Uruchom pierwszą próbę synchronizacji
            this.checkAndSync().catch(err => { /* obsługa błędu już jest w checkAndSync */ });
        }
    }).catch(err => {
        console.error("[SyncService] Błąd pobierania początkowego stanu sieci:", err);
        this.setStatus(SyncStatus.Error, new Error("Nie można sprawdzić początkowego stanu sieci."));
    });


    // Uruchom interwał cykliczny
    this.intervalId = setInterval(() => {
      if (this.isStarted) { // Sprawdź ponownie, czy serwis nie został zatrzymany
          this.checkAndSync().catch(err => { /* obsługa błędu już jest w checkAndSync */ });
      } else {
           console.log("[SyncService Interval] Serwis zatrzymany, pomijanie cyklu.");
           this.clearTimers(); // Dodatkowe upewnienie się, że timer jest czyszczony
      }
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
    this.clearTimers();

    // Ustaw status Stopped tylko jeśli nie jest to Error/Success/Offline
    if (![SyncStatus.Error, SyncStatus.Success, SyncStatus.Offline].includes(this.currentStatus)) {
      this.setStatus(SyncStatus.Stopped);
    }
    console.log('[SyncService] Serwis zatrzymany.');
  }

  public async triggerManualSync(): Promise<void> {
    if (!this.isStarted) {
        console.warn('[SyncService] Ręczne wyzwolenie, ale serwis jest zatrzymany.');
        return;
    }
    // --- DODANO: Sprawdzenie wygaśnięcia sesji ---
    if (this.isSessionExpired) {
        console.warn('[SyncService] Ręczne wyzwolenie, ale sesja wygasła. Zaloguj się ponownie.');
        showToast({ type: 'error', text1: 'Sesja wygasła', text2: 'Zaloguj się, aby synchronizować.' });
        return;
    }
    // ------------------------------------------

    if (this.currentStatus === SyncStatus.Syncing || this.currentStatus === SyncStatus.Checking) {
      console.log('[SyncService] Manual sync requested, but already syncing/checking. Waiting...');
      try { await (this.syncPromise ?? Promise.resolve()); } catch { /* Ignoruj błąd */ }
      if (this.currentStatus === SyncStatus.Syncing || this.currentStatus === SyncStatus.Checking) {
          console.warn('[SyncService] Manual sync still blocked after waiting.');
          return;
      }
      console.log('[SyncService] Previous sync finished, proceeding with manual trigger.');
    }

    console.log('[SyncService] Ręczne wyzwolenie synchronizacji...');
    this.clearRetryTimers();
    // Wywołaj checkAndSync - on sprawdzi online status itp.
    await this.checkAndSync();
  }

  public getStatus(): SyncStatus { return this.currentStatus; }
  public getLastError(): Error | null { return this.lastError; }
  public getFormattedLogs(): string { return this.syncLogger.formattedLogs; }
  public getRawLogs(): any[] { return this.syncLogger.logs; }

  // Metody on/off bez zmian
  public on<E extends keyof SyncServiceEvents>(event: E, listener: (...args: any[]) => void): void { this.eventEmitter.on(event, listener as any); }
  public off<E extends keyof SyncServiceEvents>(event: E, listener: (...args: any[]) => void): void { this.eventEmitter.off(event, listener as any); }

  // --- NOWA Metoda obsługi zmian stanu sieci ---
  private handleNetStateChange(state: NetInfoState): void {
      const isNowOnline = !!state.isConnected && !!state.isInternetReachable;
      const wasOnline = this.currentStatus !== SyncStatus.Offline; // Czy poprzedni status NIE był Offline?

      if (wasOnline !== isNowOnline) {
           console.log(`[SyncService] Zmiana stanu sieci: ${wasOnline ? 'Online' : 'Offline'} -> ${isNowOnline ? 'Online' : 'Offline'}`);
           if (isNowOnline) {
               // Jeśli wracamy online I sesja NIE wygasła, próbuj synchronizacji
               if (!this.isSessionExpired) {
                    console.log('[SyncService] Wykryto powrót online (i sesja ważna). Próbuję synchronizacji...');
                    this.setStatus(SyncStatus.Waiting); // Zmień status na Czekający
                    // Użyj setTimeout, aby dać czas na ustabilizowanie się połączenia
                    this.offlineRetryTimer = setTimeout(() => {
                        this.offlineRetryTimer = null;
                        if (this.isStarted && !this.isSessionExpired) { // Sprawdź ponownie stan
                           this.checkAndSync().catch(err => console.error("[SyncService] Błąd podczas ponowienia po offline:", err));
                        } else {
                            console.log("[SyncService] Powrót online, ale serwis zatrzymany lub sesja wygasła. Pomijanie ponowienia.");
                            if(this.isStarted && this.isSessionExpired) this.setStatus(SyncStatus.Offline); // Ustaw Offline jeśli sesja wygasła
                        }
                    }, 1000); // Krótkie opóźnienie
               } else {
                    console.log('[SyncService] Wykryto powrót online, ale sesja wygasła. Pozostaję w stanie Offline.');
                    this.setStatus(SyncStatus.Offline);
               }
           } else {
               // Przechodzimy w tryb offline
               console.log('[SyncService] Wykryto tryb offline.');
               this.setStatus(SyncStatus.Offline);
               this.clearRetryTimers(); // Anuluj ewentualne ponowienia po błędach
           }
      }
  }
  // ---------------------------------------

  private async checkAndSync(): Promise<void> {
    if (!this.isStarted) { return; }
    // --- DODANO: Sprawdzenie wygaśnięcia sesji na początku ---
    if (this.isSessionExpired) {
        console.log('[SyncService Check] Sesja wygasła. Synchronizacja niemożliwa.');
        if (this.currentStatus !== SyncStatus.Offline) this.setStatus(SyncStatus.Offline); // Upewnij się, że status to Offline
        return;
    }
    // ------------------------------------------
    if (this.isCurrentlySyncing) { console.log('[SyncService Check] Poprzednia synchronizacja nadal trwa.'); return; }
    this.clearRetryTimers(); // Czyść timery ponowień

    // Jeśli status jest już Offline, nie rób nic więcej (NetInfo handler się tym zajmie)
    if (this.currentStatus === SyncStatus.Offline) {
        console.log('[SyncService Check] Status to Offline. Oczekiwanie na zmianę stanu sieci.');
        return;
    }

    this.setStatus(SyncStatus.Checking);
    console.log('[SyncService Check] Sprawdzanie...');

    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('[SyncService Check] Brak zalogowanego użytkownika. Zatrzymywanie serwisu.');
      this.setStatus(SyncStatus.Idle);
      this.stop();
      return;
    }

    // Sprawdzenie sieci (NetInfo listener powinien utrzymywać status Offline aktualnym, ale sprawdzamy ponownie)
    let netState: NetInfoState;
    try {
        netState = await NetInfo.fetch();
    } catch (netError) {
         console.error("[SyncService Check] Błąd pobierania stanu sieci:", netError);
         this.setStatus(SyncStatus.Error, new Error("Nie można sprawdzić połączenia sieciowego."));
         this.scheduleErrorRetry();
         return;
    }

    if (!netState.isConnected || !netState.isInternetReachable) {
      console.log('[SyncService Check] Brak połączenia internetowego.');
      this.setStatus(SyncStatus.Offline);
      // Nie planujemy ponowienia tutaj, NetInfo handler to zrobi
      return;
    }

    console.log('[SyncService Check] Warunki spełnione (zalogowany, online, sesja ważna). Rozpoczynanie cyklu synchronizacji...');
    this.syncPromise = this.performSyncCycle(userId); // Przypisz Promise
    try {
        await this.syncPromise;
        // Po sukcesie ustaw status Waiting (jeśli serwis nadal działa)
        if (this.isStarted && this.currentStatus === SyncStatus.Success) {
            this.setStatus(SyncStatus.Waiting);
        }
    } catch (error) {
        // Błąd jest już obsłużony w performSyncCycle (ustawia status Error)
        // Jeśli serwis nadal działa i nie jest Offline (co byłoby dziwne po błędzie), zaplanuj ponowienie
        if (this.isStarted && this.currentStatus !== SyncStatus.Offline) {
             this.scheduleErrorRetry();
        }
    } finally {
        this.syncPromise = null; // Wyczyść Promise po zakończeniu
    }
  }

  private async performSyncCycle(userId: string): Promise<void> {
    if (this.isCurrentlySyncing) return;
    // --- DODANO: Ponowne sprawdzenie sesji przed samym cyklem ---
    if (this.isSessionExpired) {
        console.log(`[SyncService Cycle ${userId}] Sesja wygasła tuż przed cyklem. Przerywanie.`);
        this.setStatus(SyncStatus.Offline);
        return;
    }
    // ------------------------------------------------------------

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
         this.handleSyncError(error, syncId, currentLog); // Użyj nowej metody obsługi błędu
         throw error; // Rzuć błąd, aby zakończyć
    }

    try {
      await synchronize({
        database: this.database,
        pullChanges: async (args) => {
          // --- DODANO: Sprawdzenie sesji przed PULL ---
          if (this.isSessionExpired) throw new ApiError("Sesja wygasła", 401, null, true);
          // -----------------------------------------
          const wdbLPA = args.lastPulledAt; const lpaToSend = userLPA;
          console.log(`[SyncService Cycle ${syncId}] Pull... (WDB LPA: ${wdbLPA ?? 'null'}, User LPA: ${userLPA ?? 'null'}) -> Sending LPA: ${lpaToSend ?? 'null'}`);
          if (userLPA === null && wdbLPA !== null) { console.warn(`[SyncService Cycle ${syncId}] Niespójność LPA. Używam null.`); }
          const response = await syncApi.pullChanges({ ...args, lastPulledAt: lpaToSend });
          const newTimestamp = response.timestamp;
          try { await AuthStorage.storeLastPulledAt(userId, newTimestamp); }
          catch (saveLpaError) { console.error(`[SyncService Cycle ${syncId}] KRYTYCZNY BŁĄD zapisu LPA (${newTimestamp}) dla ${userId}:`, saveLpaError); throw new Error(`Błąd zapisu nowego LPA: ${saveLpaError}`); }
          console.log(`[SyncService Cycle ${syncId}] Pull zakończony. Nowy Timestamp: ${newTimestamp}`);
          return { changes: response.changes, timestamp: newTimestamp };
        },
        pushChanges: async (args) => {
           // --- DODANO: Sprawdzenie sesji przed PUSH ---
           if (this.isSessionExpired) throw new ApiError("Sesja wygasła", 401, null, true);
           // -----------------------------------------
          const wdbLPA = args.lastPulledAt; let lpaForPush: number | null = null;
          try { lpaForPush = await AuthStorage.retrieveLastPulledAt(userId); if (lpaForPush === null) { console.error(`[SyncService Cycle ${syncId}] BŁĄD KRYTYCZNY: LPA dla push jest null dla ${userId}! Używam WDB LPA: ${wdbLPA}`); lpaForPush = wdbLPA; } }
          catch (lpaError) { console.error(`[SyncService Cycle ${syncId}] Błąd odczytu LPA dla push (${userId}):`, lpaError); lpaForPush = wdbLPA; }
          console.log(`[SyncService Cycle ${syncId}] Push... (WDB LPA: ${wdbLPA}, User LPA for Push: ${lpaForPush})`);
          if (lpaForPush === null) { throw new Error("Nie można wykonać Push bez lastPulledAt."); }
          await syncApi.pushChanges({ changes: args.changes, lastPulledAt: lpaForPush });
          console.log(`[SyncService Cycle ${syncId}] Push zakończony.`);
        },
        migrationsEnabledAtVersion: this.migrationsVersion,
        log: currentLog,
      });

      this.setStatus(SyncStatus.Success);
      console.log(`[SyncService Cycle ${syncId}] Synchronizacja zakończona pomyślnie.`);

    } catch (error: any) {
      this.handleSyncError(error, syncId, currentLog); // Użyj nowej metody obsługi błędu
      throw this.lastError; // Rzuć przetworzony błąd dalej

    } finally {
      this.isCurrentlySyncing = false;
      this.eventEmitter.emit('syncFinished', this.currentStatus, this.lastError);
      console.log(`[SyncService Cycle ${syncId}] Zakończono synchronize (status: ${this.currentStatus}).`);
    }
  }

  // --- NOWA Prywatna metoda do obsługi błędów synchronizacji ---
  private handleSyncError(error: any, syncId: string, currentLog: any): void {
      console.error(`[SyncService Cycle ${syncId}] BŁĄD podczas synchronize:`, error);
      currentLog.error = error; // Zapisz surowy błąd w logu

      let processedError: Error;
      let newStatus = SyncStatus.Error;

      if (error instanceof ApiError && error.isRefreshError) {
          // Jeśli błąd API wskazuje na wygaśnięcie sesji
          console.warn(`[SyncService Cycle ${syncId}] Błąd synchronizacji spowodowany wygaśnięciem sesji (status: ${error.status}).`);
          processedError = new Error("Sesja wygasła. Zaloguj się ponownie."); // Ustaw przyjazny komunikat
          newStatus = SyncStatus.Offline; // Traktuj jako Offline, bo dalszy sync niemożliwy
          this.isSessionExpired = true; // Ustaw flagę w serwisie
          // Nie wywołujemy handleSessionExpiredError z AuthContext bezpośrednio stąd
          // Zamiast tego AppServicesController zareaguje na zmianę flagi isSessionExpired
      } else if (error instanceof ApiError && error.status === 409) {
          // Konflikt
          console.warn(`[SyncService Cycle ${syncId}] Wykryto konflikt (409). Wymagany ponowny Pull.`);
          processedError = new Error("Konflikt danych. Spróbuj ponownie.");
          newStatus = SyncStatus.Error; // Nadal błąd, ale inny
      } else if (error instanceof Error) {
          // Inny błąd (sieciowy, parsowania itp.)
          processedError = error;
      } else {
          // Nieznany typ błędu
          processedError = new Error(String(error) || "Nieznany błąd synchronizacji");
      }

      this.lastError = processedError;
      this.setStatus(newStatus, this.lastError);
  }
  // ---------------------------------------------------------

  // Metoda setStatus bez zmian
  private setStatus(newStatus: SyncStatus, error: Error | null = null): void {
    const resolvedError = error;
    if (this.currentStatus !== newStatus || this.lastError !== resolvedError) {
      this.currentStatus = newStatus; this.lastError = resolvedError;
      try { this.eventEmitter.emit('statusChanged', newStatus, resolvedError); }
      catch (emitError) { console.error("[SyncService] Błąd emitowania:", emitError); }
      console.log(`[SyncService] Status: ${newStatus}${resolvedError ? ` (Błąd: ${resolvedError.message.substring(0,100)}...)` : ''}`);
    }
  }

  // Metoda clearTimers bez zmian
  private clearTimers(): void {
      if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
      if (this.netInfoUnsubscribe) { this.netInfoUnsubscribe(); this.netInfoUnsubscribe = null; console.log('[SyncService] Anulowano nasłuchiwanie NetInfo.'); }
      this.clearRetryTimers();
  }

  // Metoda clearRetryTimers bez zmian
  private clearRetryTimers(): void {
      if (this.offlineRetryTimer) { clearTimeout(this.offlineRetryTimer); this.offlineRetryTimer = null; }
      if (this.errorRetryTimer) { clearTimeout(this.errorRetryTimer); this.errorRetryTimer = null; }
  }

  // Metoda scheduleOfflineRetry jest teraz zastąpiona przez handleNetStateChange
  // Metoda scheduleErrorRetry bez zmian
   private scheduleErrorRetry(): void {
       if (!this.isStarted || this.errorRetryTimer) return;
       console.log(`[SyncService] Planowanie ponowienia po błędzie za ${RETRY_DELAY_MS / 1000}s.`);
       this.errorRetryTimer = setTimeout(() => {
           console.log('[SyncService] Czas na ponowienie po błędzie...'); this.errorRetryTimer = null;
           if (this.isStarted) { this.checkAndSync().catch(err => console.error("[SyncService] Błąd ponowienia po błędzie:", err)); }
           else { console.log("[SyncService] Czas na ponowienie, ale serwis zatrzymany."); }
       }, RETRY_DELAY_MS);
   }
}

// Inicjalizacja Singletona (bez zmian)
let syncServiceInstance: SyncService | null = null;
export const initializeSyncService = (): SyncService => { if (syncServiceInstance) { return syncServiceInstance; } if (!database) { throw new Error("[SyncService Init] Baza danych nie zainicjalizowana."); } syncServiceInstance = new SyncService(database); console.log('[SyncService] Instancja SyncService utworzona.'); return syncServiceInstance; };
export const getSyncService = (): SyncService => { if (!syncServiceInstance) { console.warn("[SyncService Get] Inicjowanie..."); return initializeSyncService(); } return syncServiceInstance; };
export { SyncService };