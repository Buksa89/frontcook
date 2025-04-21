// src/services/auth/authService.ts
import AuthStorage from './authStorage';
import authApi from '../api/authApi'; // Importuj obiekt API
import type { LoginResponse, LoginRequest } from '../api/authApi';
import database from '../../database';
import { Q, Model } from '@nozbe/watermelondb';
import { Alert } from 'react-native';
// --- DODANE IMPORTY ---
import { getSyncService, SyncStatus } from '../sync/syncService'; // Importuj getter i Status dla SyncService
import NetInfo from '@react-native-community/netinfo'; // Do sprawdzenia sieci
// --------------------

const SYNCHRONIZABLE_TABLE_NAMES_FOR_ORPHAN_ASSIGNMENT = [
    'recipes', 'recipe_tags', 'ingredients', 'shopping_items', // Używamy poprawnej nazwy 'recipe_tags'
    'client_user_settings', 'notifications', 'recipe_images_local' // Dodano recipe_images_local
];

interface RecordWithUserId extends Model { userId: string | null; } // userId będzie stringiem

class AuthService {

    /**
     * Loguje użytkownika, używając 'username'. Zapisuje user_id jako string.
     * Wywołuje API logowania, a następnie zapisuje dane lokalnie.
     */
    async login(username: string, password: string): Promise<LoginResponse> {
        console.log('[AuthService] Rozpoczęcie logowania dla username:', username);
        try {
            const response = await authApi.login({ username, password });
            console.log('[AuthService] Odpowiedź API logowania otrzymana:', { userId: response.user_id, isFirst: response.is_first_ever_login });

            const userIdString = String(response.user_id);

            // Zapisz tokeny i ID użytkownika lokalnie
            await Promise.all([
                AuthStorage.storeAccessToken(response.access),
                AuthStorage.storeRefreshToken(response.refresh),
                AuthStorage.storeActiveUserId(userIdString)
            ]);
            console.log('[AuthService] Tokeny i User ID (jako string) zapisane.');

            // Przypisz dane osierocone, jeśli to pierwsze logowanie
            if (response.is_first_ever_login) {
                console.log('[AuthService] Wykryto pierwsze logowanie użytkownika. Rozpoczynanie przypisywania danych offline...');
                const success = await this.assignOrphanedDataToUser(userIdString);
                if (!success) {
                    console.error('[AuthService] Błąd przypisywania danych offline.');
                    // Rozważ, czy rzucić błąd, czy tylko pokazać ostrzeżenie
                    // Alert.alert('Błąd krytyczny', 'Nie udało się przypisać danych offline.');
                    // throw new Error('Nie udało się przypisać danych offline.');
                } else {
                    console.log('[AuthService] Przypisywanie danych offline zakończone sukcesem.');
                }
            } else {
                console.log('[AuthService] Pomijanie przypisywania danych offline.');
            }

            console.log('[AuthService] Logowanie zakończone pomyślnie.');
            return response; // Zwróć oryginalną odpowiedź z API

        } catch (error) {
            console.error('[AuthService] Błąd procesu logowania:', error);
            // W razie błędu logowania (np. złe dane) wyczyść stare dane
            await this.clearAuthData();
            throw error; // Rzuć błąd dalej
        }
    }

    /**
     * Przypisuje rekordy (z userId=null) do nowo zalogowanego użytkownika.
     * Używa userId jako string.
     */
    private async assignOrphanedDataToUser(userId: string): Promise<boolean> {
        if (!database) { console.error('[AuthService] Baza danych nie jest zainicjalizowana!'); return false; }
        console.log(`[AuthService] Przypisywanie danych offline do user ${userId}`);
        try {
            await database.write(async (writer) => {
                let totalUpdated = 0;
                for (const tableName of SYNCHRONIZABLE_TABLE_NAMES_FOR_ORPHAN_ASSIGNMENT) {
                    try {
                        // Sprawdź czy tabela istnieje w schemacie przed zapytaniem
                        const collectionExists = database.collections.get(tableName);
                        if (!collectionExists) {
                            console.warn(`[AuthService] Tabela '${tableName}' nie istnieje w schemacie, pomijanie przypisywania.`);
                            continue;
                        }

                        const collection = database.get<RecordWithUserId>(tableName);
                        // Znajdź rekordy, gdzie user_id jest null
                        const orphanedRecords = await collection.query(Q.where('user_id', null)).fetch();

                        if (orphanedRecords.length > 0) {
                            console.log(`[AuthService] Znaleziono ${orphanedRecords.length} osieroconych rekordów w ${tableName}`);
                            // Przygotuj operacje update w batch
                            const updates = orphanedRecords.map(record =>
                                record.prepareUpdate(r => {
                                    r.userId = userId; // Przypisz stringowe ID użytkownika
                                })
                            );
                            await writer.batch(...updates); // Wykonaj batch
                            totalUpdated += updates.length;
                        }
                    } catch (tableError) {
                        // Loguj błąd dla konkretnej tabeli, ale kontynuuj
                        console.error(`[AuthService] Błąd tabeli '${tableName}' podczas przypisywania danych offline:`, tableError);
                    }
                }
                console.log(`[AuthService] Zakończono przypisywanie danych offline. Zaktualizowano ${totalUpdated} rekordów.`);
            });
            return true;
        } catch (error) {
            console.error(`[AuthService] Krytyczny błąd podczas transakcji przypisywania danych offline:`, error);
            return false;
        }
    }

    /**
     * Wylogowuje użytkownika: próbuje wymusić sync, wywołuje API logout i czyści dane lokalne.
     */
    async logout(): Promise<void> {
        console.log('[AuthService] Rozpoczęcie wylogowania...');
        const refreshToken = await this.getRefreshToken(); // Pobierz token przed czyszczeniem

        // --- DODANO: Wymuszenie synchronizacji PUSH przed wylogowaniem ---
        try {
            console.log('[AuthService] Próba wymuszenia synchronizacji przed wylogowaniem...');
            const syncService = getSyncService(); // Pobierz instancję SyncService
            const netState = await NetInfo.fetch(); // Sprawdź stan sieci

            // Sprawdź, czy serwis jest aktywny (nie Idle) i czy jesteśmy online
            const currentSyncStatus = syncService.getStatus();
            const isServiceConsideredActive = currentSyncStatus !== SyncStatus.Idle; // Uproszczone sprawdzenie
            const isOnline = netState.isConnected && netState.isInternetReachable;

            if (isServiceConsideredActive && isOnline) {
                 console.log('[AuthService] Wyzwalanie ręcznej synchronizacji...');
                 // Wywołaj triggerManualSync i poczekaj na zakończenie cyklu
                 // triggerManualSync wewnętrznie zarządza flagą isCurrentlySyncing
                 await syncService.triggerManualSync();
                 console.log('[AuthService] Zakończono próbę synchronizacji przed wylogowaniem.');
                 // Nie potrzebujemy sprawdzać statusu tutaj, jeśli się nie powiodło,
                 // błąd został złapany poniżej lub zalogowany przez SyncService.
            } else {
                 console.log(`[AuthService] Pomijanie synchronizacji przed wylogowaniem (Aktywny: ${isServiceConsideredActive}, Online: ${isOnline}).`);
            }
        } catch (syncError) {
            // Logujemy błąd synchronizacji, ale *nie przerywamy* procesu wylogowania
            console.error('[AuthService] Błąd podczas próby synchronizacji przed wylogowaniem (kontynuacja wylogowania):', syncError);
        }
        // --- KONIEC DODANEJ SEKCJI ---

        // Kontynuuj normalny proces wylogowania
        try {
            // Najpierw wywołaj API logout, jeśli jest token
            if (refreshToken) {
                await authApi.logout(refreshToken); // authApi obsłuży błędy API
            } else {
                console.log('[AuthService] Brak refresh tokena, pomijanie API logout.');
            }
        } catch (error) {
            // Logujemy błąd API, ale kontynuujemy czyszczenie lokalne
            console.warn('[AuthService] Błąd podczas wywoływania API logout (kontynuacja czyszczenia lokalnego):', error);
        } finally {
            // ZAWSZE czyść dane lokalne
            await this.clearAuthData();
            console.log('[AuthService] Wylogowanie zakończone (dane lokalne wyczyszczone).');
        }
    }

    /**
     * Prywatna metoda do czyszczenia wszystkich danych autoryzacyjnych.
     */
    private async clearAuthData(): Promise<void> {
        try {
            await Promise.all([
                AuthStorage.clearAccessToken(),
                AuthStorage.clearRefreshToken(),
                AuthStorage.clearActiveUserId()
            ]);
            console.log('[AuthService] Dane autoryzacyjne wyczyszczone z pamięci.');
        } catch (error) {
            console.error('[AuthService] Błąd podczas czyszczenia danych autoryzacyjnych:', error);
            // Można rozważyć rzucenie błędu, jeśli to krytyczne
        }
    }

    async getAccessToken(): Promise<string | null> {
        return AuthStorage.retrieveAccessToken();
    }

    async getActiveUserId(): Promise<string | null> {
        return AuthStorage.retrieveActiveUserId();
    }

    async getRefreshToken(): Promise<string | null> {
        return AuthStorage.retrieveRefreshToken();
    }

    async isAuthenticated(): Promise<boolean> {
        const token = await this.getAccessToken();
        const userId = await this.getActiveUserId();
        return !!token && !!userId;
    }
}

const authService = new AuthService();
export default authService;