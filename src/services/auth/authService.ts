// src/services/auth/authService.ts
import AuthStorage from './authStorage';
import authApi from '../api/authApi';
import type { LoginResponse, LoginRequest } from '../api/authApi'; // Importuj oba interfejsy
import database from '../../database';
import { Q, Model } from '@nozbe/watermelondb';
import { Alert } from 'react-native';
import apiClient from '../api/apiClient';
import { ApiError } from '../api/apiClient';

const SYNCHRONIZABLE_TABLE_NAMES_FOR_ORPHAN_ASSIGNMENT = [
    'recipes', 'recipe_tags', 'ingredients', 'shopping_items',
    'client_user_settings', 'notifications',
];

interface RecordWithUserId extends Model { userId: string | null; } // Teraz userId będzie stringiem
interface RefreshTokenApiResponse { access: string; refresh?: string; }

class AuthService {

    constructor() { /* this.injectRefreshTokenFunction(); */ }
    /*
    private async injectRefreshTokenFunction() {
        try { apiClient.setRefreshTokenFunction(() => this.refreshAccessToken()); console.log('[AuthService] Funkcja odświeżania wstrzyknięta.'); }
        catch (e) { console.error("[AuthService] Błąd wstrzykiwania funkcji odświeżania:", e); }
    }
    */

    /**
     * Loguje użytkownika, używając 'username'. Zapisuje user_id jako string.
     */
    async login(username: string, password: string): Promise<LoginResponse> { // Zmieniono loginValue na username
        console.log('[AuthService] Rozpoczęcie logowania dla username:', username);
        try {
            // ZMIANA: Przekazujemy obiekt zgodny z LoginRequest (z username)
            const response = await authApi.login({ username, password });
            // ZMIANA: Logujemy user_id (number) z odpowiedzi
            console.log('[AuthService] Odpowiedź API logowania otrzymana:', { userId: response.user_id, isFirst: response.is_first_ever_login });

            // ZMIANA: Konwertujemy user_id (number) na string przed zapisem
            const userIdString = String(response.user_id);

            await Promise.all([
                AuthStorage.storeAccessToken(response.access),
                AuthStorage.storeRefreshToken(response.refresh),
                AuthStorage.storeActiveUserId(userIdString) // Zapisujemy jako string
            ]);
            console.log('[AuthService] Tokeny i User ID (jako string) zapisane.');

            if (response.is_first_ever_login) {
                console.log('[AuthService] Wykryto pierwsze logowanie użytkownika. Rozpoczynanie przypisywania danych offline...');
                // Przekazujemy userId jako string
                const success = await this.assignOrphanedDataToUser(userIdString);
                if (!success) { console.error('[AuthService] Błąd przypisywania danych offline.'); Alert.alert('Błąd krytyczny', 'Nie udało się przypisać danych offline.'); }
                else { console.log('[AuthService] Przypisywanie danych offline zakończone sukcesem.'); }
            } else { console.log('[AuthService] Pomijanie przypisywania danych offline.'); }

            console.log('[AuthService] Logowanie zakończone pomyślnie.');
            return response; // Zwracamy oryginalną odpowiedź (z user_id jako number)

        } catch (error) { console.error('[AuthService] Błąd procesu logowania:', error); await this.clearAuthData(); throw error; }
    }

    /**
     * Przypisuje rekordy do użytkownika używając userId jako string.
     */
    private async assignOrphanedDataToUser(userId: string): Promise<boolean> { // userId jest teraz stringiem
        // Logika wewnętrzna bez zmian, bo i tak porównujemy z null, a zapisujemy string
        if (!database) { console.error('[AuthService] Baza danych nie jest zainicjalizowana!'); return false; }
        console.log(`[AuthService] Przypisywanie danych offline do user ${userId}`);
        try {
            await database.write(async (writer) => {
                let totalUpdated = 0;
                for (const tableName of SYNCHRONIZABLE_TABLE_NAMES_FOR_ORPHAN_ASSIGNMENT) {
                    try {
                        const collection = database.get<RecordWithUserId>(tableName);
                        const orphanedRecords = await collection.query(Q.where('user_id', null)).fetch();
                        if (orphanedRecords.length > 0) {
                            const updates = orphanedRecords.map(record => record.prepareUpdate(r => { r.userId = userId; })); // Przypisujemy string
                            await writer.batch(...updates); totalUpdated += updates.length;
                        }
                    } catch (tableError) { console.error(`[AuthService] Błąd tabeli '${tableName}' przy przypisywaniu:`, tableError); }
                }
                console.log(`[AuthService] Zakończono przypisywanie. Zaktualizowano ${totalUpdated} rekordów.`);
            });
            return true;
        } catch (error) { console.error(`[AuthService] Błąd transakcji przypisywania:`, error); return false; }
    }

    async logout(): Promise<void> { /* ... bez zmian ... */
        console.log('[AuthService] Rozpoczęcie wylogowania...'); const refreshToken = await this.getRefreshToken(); try { if (refreshToken) { await authApi.logout(refreshToken); console.log('[AuthService] Żądanie API logout zakończone.'); } else { console.log('[AuthService] Brak refresh tokena, pomijanie API logout.'); } } catch (error) { console.warn('[AuthService] Błąd API logout (kontynuacja):', error); } finally { await this.clearAuthData(); console.log('[AuthService] Wylogowanie zakończone.'); }
    }
    private async clearAuthData(): Promise<void> { /* ... bez zmian ... */
        try { await Promise.all([ AuthStorage.clearAccessToken(), AuthStorage.clearRefreshToken(), AuthStorage.clearActiveUserId() ]); } catch (error) { console.error('[AuthService] Błąd czyszczenia danych auth:', error); }
    }

    // Zwracają string | null
    async getAccessToken(): Promise<string | null> { return AuthStorage.retrieveAccessToken(); }
    async getActiveUserId(): Promise<string | null> { return AuthStorage.retrieveActiveUserId(); }
    async getRefreshToken(): Promise<string | null> { return AuthStorage.retrieveRefreshToken(); }
    async isAuthenticated(): Promise<boolean> { const t = await this.getAccessToken(); const u = await this.getActiveUserId(); return !!t && !!u; }

    async refreshAccessToken(): Promise<string | null> { /* ... logika bez zmian ... */
         const refreshToken = await this.getRefreshToken(); if (!refreshToken) { console.log('[AuthService] Brak refresh tokena. Wylogowywanie...'); await this.logout(); return null; }
         console.log('[AuthService] Próba odświeżenia tokenu przez API...'); try { const response = await apiClient.post<RefreshTokenApiResponse>( '/api/auth/refresh-token/', { refresh: refreshToken }, false ); const newAccessToken = response.access; const newRefreshToken = response.refresh; if (!newAccessToken) { console.error('[AuthService] Odpowiedź API nie zawiera nowego tokena.'); await this.logout(); return null; } const storePromises = [AuthStorage.storeAccessToken(newAccessToken)]; if (newRefreshToken) { storePromises.push(AuthStorage.storeRefreshToken(newRefreshToken)); } await Promise.all(storePromises); console.log('[AuthService] Token pomyślnie odświeżony.'); return newAccessToken; } catch (error) { if (error instanceof ApiError && error.status === 401) { console.log('[AuthService] Refresh token nieprawidłowy/wygasł (API 401). Wylogowywanie...'); await this.logout(); } else { console.error('[AuthService] Nieoczekiwany błąd podczas odświeżania tokenu:', error); } return null; }
    }
}

const authService = new AuthService();
export default authService;