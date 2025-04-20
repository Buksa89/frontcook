// src/services/auth/authService.ts
import AuthStorage from './authStorage';
import authApi from '../api/authApi';
import type { LoginResponse } from '../api/authApi';
import database from '../../database';
import { Q, Model } from '@nozbe/watermelondb';
import { Alert } from 'react-native';
// Statyczne importy apiClient i ApiError (potrzebne w refreshAccessToken)
import apiClient from '../api/apiClient';
import { ApiError } from '../api/apiClient';

const SYNCHRONIZABLE_TABLE_NAMES_FOR_ORPHAN_ASSIGNMENT = [
    'recipes', 'recipe_tags', 'ingredients', 'shopping_items',
    'client_user_settings', 'notifications',
];

interface RecordWithUserId extends Model { userId: string | null; }
interface RefreshTokenApiResponse { access: string; refresh?: string; }

class AuthService {

    // Konstruktor został usunięty

    async login(loginValue: string, password: string): Promise<LoginResponse> {
        // Logika bez zmian
        console.log('[AuthService] Rozpoczęcie logowania...');
        try {
            const response = await authApi.login({ login: loginValue, password });
            console.log('[AuthService] Odpowiedź API logowania otrzymana:', { userId: response.userId, isFirst: response.is_first_ever_login });
            await Promise.all([
                AuthStorage.storeAccessToken(response.access),
                AuthStorage.storeRefreshToken(response.refresh),
                AuthStorage.storeActiveUserId(response.userId)
            ]);
            console.log('[AuthService] Tokeny i User ID zapisane.');
            if (response.is_first_ever_login) {
                console.log('[AuthService] Wykryto pierwsze logowanie. Rozpoczynanie przypisywania danych offline...');
                const success = await this.assignOrphanedDataToUser(response.userId);
                if (!success) { console.error('[AuthService] Błąd podczas przypisywania danych offline.'); Alert.alert('Błąd krytyczny', 'Nie udało się przypisać danych offline.'); }
                else { console.log('[AuthService] Przypisywanie danych offline zakończone sukcesem.'); }
            } else { console.log('[AuthService] Pomijanie przypisywania danych offline.'); }
            console.log('[AuthService] Logowanie zakończone pomyślnie.');
            return response;
        } catch (error) { console.error('[AuthService] Błąd procesu logowania:', error); await this.clearAuthData(); throw error; }
    }

    private async assignOrphanedDataToUser(userId: string): Promise<boolean> {
        // Logika bez zmian
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
                            const updates = orphanedRecords.map(record => record.prepareUpdate(r => { r.userId = userId; }));
                            await writer.batch(...updates); totalUpdated += updates.length;
                        }
                    } catch (tableError) { console.error(`[AuthService] Błąd tabeli '${tableName}' przy przypisywaniu:`, tableError); }
                }
                console.log(`[AuthService] Zakończono przypisywanie. Zaktualizowano ${totalUpdated} rekordów.`);
            });
            return true;
        } catch (error) { console.error(`[AuthService] Błąd transakcji przypisywania:`, error); return false; }
    }

    async logout(): Promise<void> {
        // Logika bez zmian
        console.log('[AuthService] Rozpoczęcie wylogowania...');
        const refreshToken = await this.getRefreshToken();
        try { if (refreshToken) { await authApi.logout(refreshToken); console.log('[AuthService] Żądanie API logout zakończone.'); } else { console.log('[AuthService] Brak refresh tokena, pomijanie API logout.'); } }
        catch (error) { console.warn('[AuthService] Błąd API logout (kontynuacja):', error); }
        finally { await this.clearAuthData(); console.log('[AuthService] Wylogowanie zakończone.'); }
    }

    private async clearAuthData(): Promise<void> {
        // Logika bez zmian
        try { await Promise.all([ AuthStorage.clearAccessToken(), AuthStorage.clearRefreshToken(), AuthStorage.clearActiveUserId() ]); }
        catch (error) { console.error('[AuthService] Błąd czyszczenia danych auth:', error); }
    }

    // Metody pomocnicze bez zmian
    async getAccessToken(): Promise<string | null> { return AuthStorage.retrieveAccessToken(); }
    async getActiveUserId(): Promise<string | null> { return AuthStorage.retrieveActiveUserId(); }
    async getRefreshToken(): Promise<string | null> { return AuthStorage.retrieveRefreshToken(); }
    async isAuthenticated(): Promise<boolean> { const t = await this.getAccessToken(); const u = await this.getActiveUserId(); return !!t && !!u; }

    /**
     * Odświeża access token. Wywoływana przez apiClient.
     */
    async refreshAccessToken(): Promise<string | null> {
        // Logika bez zmian - używa statycznie zaimportowanego apiClient i ApiError
        const refreshToken = await this.getRefreshToken();
        if (!refreshToken) { console.log('[AuthService] Brak refresh tokena. Wylogowywanie...'); await this.logout(); return null; }
        console.log('[AuthService] Próba odświeżenia tokenu przez API...');
        try {
            const response = await apiClient.post<RefreshTokenApiResponse>( '/api/auth/refresh-token/', { refresh: refreshToken }, false );
            const newAccessToken = response.access; const newRefreshToken = response.refresh;
            if (!newAccessToken) { console.error('[AuthService] Odpowiedź API nie zawiera nowego tokena.'); await this.logout(); return null; }
            const storePromises = [AuthStorage.storeAccessToken(newAccessToken)];
            if (newRefreshToken) { storePromises.push(AuthStorage.storeRefreshToken(newRefreshToken)); }
            await Promise.all(storePromises);
            console.log('[AuthService] Token pomyślnie odświeżony.');
            return newAccessToken;
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) { console.log('[AuthService] Refresh token nieprawidłowy/wygasł (API 401). Wylogowywanie...'); await this.logout(); }
            else { console.error('[AuthService] Nieoczekiwany błąd podczas odświeżania tokenu:', error); }
            return null;
        }
    }
}

const authService = new AuthService();
export default authService;