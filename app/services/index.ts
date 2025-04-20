import authService from './auth';
import { Database } from '@nozbe/watermelondb';
import SyncService from './sync/syncService';

export { authService };

export default {
  auth: authService,
};

// --- Configuration ---
const MIGRATIONS_VERSION = 1; // <-- SET CORRECT VALUE
const SYNC_INTERVAL_SECONDS = 60; // Check every 60 seconds

// Database reference - you'll need to implement this based on your application structure
let databaseInstance: Database | null = null;

export function getDatabase(): Database | null {
  return databaseInstance;
}

export function setDatabase(db: Database): void {
  databaseInstance = db;
}

// SyncService singleton instance
let syncServiceInstance: SyncService | null = null;

export function initializeSyncService(): SyncService {
  if (!syncServiceInstance) {
    const db = getDatabase();
    if (!db) {
      throw new Error("Database not initialized before SyncService");
    }
    syncServiceInstance = new SyncService(
      db,
      MIGRATIONS_VERSION,
      SYNC_INTERVAL_SECONDS
    );
    console.log('[App] SyncService initialized.');
  }
  return syncServiceInstance;
}

// Function to get the SyncService instance
export function getSyncService(): SyncService {
  if (!syncServiceInstance) {
    console.warn("[App] SyncService accessed before explicit initialization.");
    return initializeSyncService(); // Initialize if it doesn't exist
  }
  return syncServiceInstance;
} 