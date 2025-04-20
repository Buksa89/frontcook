import React, { createContext, useState, useEffect, useContext, ReactNode, useMemo } from 'react';
import { SyncStatus, getSyncService } from '../services/sync/syncService'; // Importuj enum i funkcję getSyncService
import type SyncService from '../services/sync/syncService'; // Importuj typ serwisu

interface SyncStatusContextType {
  status: SyncStatus;
  lastError: Error | null;
  triggerSync: () => void; // Funkcja do ręcznego wyzwalania
  logs: string; // Sformatowane logi
}

const SyncStatusContext = createContext<SyncStatusContextType | undefined>(undefined);

interface SyncStatusProviderProps {
  children: ReactNode;
}

export const SyncStatusProvider: React.FC<SyncStatusProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<SyncStatus>(SyncStatus.Idle);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [syncService, setSyncService] = useState<SyncService | null>(null);

  // Pobierz instancję SyncService przy montowaniu
  useEffect(() => {
    try {
      const service = getSyncService(); // Pobierz (lub zainicjalizuj) serwis
      setSyncService(service);
      // Ustaw początkowy stan
      setStatus(service.getStatus());
      setLastError(service.getLastError());
      setLogs(service.getFormattedLogs());
    } catch (error) {
      console.error("[SyncStatusProvider] Błąd podczas inicjalizacji SyncService:", error);
      setStatus(SyncStatus.Error); // Ustaw status błędu, jeśli inicjalizacja zawiedzie
      setLastError(error instanceof Error ? error : new Error('Failed to initialize SyncService'));
    }
  }, []); // Uruchom tylko raz

  // Subskrybuj do zmian statusu, gdy serwis jest dostępny
  useEffect(() => {
    if (!syncService) return;

    const handleStatusChange = (newStatus: SyncStatus, error?: Error | null) => {
      setStatus(newStatus);
      setLastError(error ?? null);
      setLogs(syncService.getFormattedLogs()); // Aktualizuj logi przy każdej zmianie statusu
    };

    syncService.on('statusChanged', handleStatusChange);
    console.log("[SyncStatusProvider] Zasubskrybowano do zmian statusu SyncService.");

    // Cleanup function
    return () => {
      syncService.off('statusChanged', handleStatusChange);
      console.log("[SyncStatusProvider] Anulowano subskrypcję zmian statusu SyncService.");
    };
  }, [syncService]); // Reaguj na zmianę instancji syncService

  // Funkcja do ręcznego wyzwalania synchronizacji
  const triggerSync = () => {
    if (syncService) {
      console.log("[SyncStatusProvider] Wyzwalanie ręcznej synchronizacji...");
      syncService.triggerManualSync();
    } else {
       console.warn("[SyncStatusProvider] Próba wyzwolenia synchronizacji, ale SyncService nie jest dostępny.");
    }
  };

  // Memoizuj wartość kontekstu, aby uniknąć niepotrzebnych re-renderów
  const contextValue = useMemo(() => ({
    status,
    lastError,
    triggerSync,
    logs,
  }), [status, lastError, logs]); // Zależność od stanu i logów

  return (
    <SyncStatusContext.Provider value={contextValue}>
      {children}
    </SyncStatusContext.Provider>
  );
};

export const useSyncStatus = (): SyncStatusContextType => {
  const context = useContext(SyncStatusContext);
  if (!context) {
    throw new Error('useSyncStatus musi być używane wewnątrz SyncStatusProvider');
  }
  return context;
};