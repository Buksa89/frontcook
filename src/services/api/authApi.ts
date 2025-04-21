// src/services/api/authApi.ts
import apiClient from './apiClient';
import AuthStorage from '../auth/authStorage';

// Interfejs odpowiedzi API odświeżania (bez zmian)
interface RefreshTokenApiResponse { /* ... */ access: string; refresh?: string; }

// Interfejsy żądań i odpowiedzi (bez zmian)
export interface LoginRequest { /* ... */ username: string; password: string; }
export interface LoginResponse { /* ... */ access: string; refresh: string; user_id: number; is_first_ever_login: boolean; }
export interface RegisterRequest { /* ... */ username: string; email: string; password: string; password2: string; }
export interface RegisterResponse { /* ... */ username: string; email: string; }
export interface ResetPasswordRequest { /* ... */ email: string; }
export interface ResetPasswordResponse { /* ... */ detail: string; }
export interface LogoutResponse { detail?: string; }


const authApi = {
  // login, register, resetPassword (bez zmian)
  async login(credentials: LoginRequest): Promise<LoginResponse> { /* ... */ try { console.log('[AuthAPI] Wysyłanie żądania logowania...'); const response = await apiClient.post<LoginResponse>('/api/auth/login/', credentials, false ); console.log('[AuthAPI] Logowanie udane.'); return response; } catch (error) { console.error('[AuthAPI] Błąd logowania:', error); throw error; } },
  async register(userData: RegisterRequest): Promise<RegisterResponse> { /* ... */ try { console.log('[AuthAPI] Wysyłanie żądania rejestracji...'); const response = await apiClient.post<RegisterResponse>( '/api/auth/register/', userData, false ); console.log('[AuthAPI] Rejestracja udana.'); return response; } catch (error) { console.error('[AuthAPI] Błąd rejestracji:', error); throw error; } },
  async resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> { /* ... */ try { console.log('[AuthAPI] Wysyłanie żądania resetu hasła...'); const response = await apiClient.post<ResetPasswordResponse>( '/api/auth/forgot-password/', data, false ); console.log('[AuthAPI] Żądanie resetu hasła wysłane.'); return response; } catch (error) { console.error('[AuthAPI] Błąd resetowania hasła:', error); throw error; } },

  /**
   * Wylogowuje użytkownika, wysyłając refresh token do API.
   */
  async logout(refreshToken: string | null): Promise<LogoutResponse | void> {
      if (!refreshToken) {
          console.warn('[AuthAPI] Próba wylogowania API bez refresh tokena.');
          return;
      }
      try {
          console.log('[AuthAPI] Wysyłanie żądania wylogowania API...');
          // --- ZMIANA: Użyj `refresh_token` zamiast `refresh` ---
          const response = await apiClient.post<LogoutResponse>(
              '/api/auth/logout/',
              { refresh_token: refreshToken }, // <<< POPRAWIONA NAZWA POLA
              true // Zakładamy, że wymaga bycia zalogowanym (Bearer token)
          );
          // --- KONIEC ZMIANY ---
          console.log('[AuthAPI] Żądanie wylogowania API zakończone.');
          return response;
      } catch (error: any) {
          if (error instanceof apiClient.ApiError && error.status === 401) {
              console.warn('[AuthAPI] Otrzymano 401 podczas wylogowania API (kontynuacja).');
              return;
          }
          console.error('[AuthAPI] Błąd żądania wylogowania API:', error);
          throw error;
      }
  },

  /**
   * Wywołuje API w celu odświeżenia tokenu.
   */
  async refreshToken(currentRefreshToken: string): Promise<string> {
    console.log('[AuthAPI] Odświeżanie tokenu przez API...');
    try {
      // Endpoint odświeżania prawdopodobnie nadal oczekuje pola 'refresh'
      // Upewnij się, jak jest w Twoim API! Załóżmy, że nadal 'refresh'.
      const response = await apiClient.post<RefreshTokenApiResponse>(
        '/api/auth/refresh-token/',
        { refresh: currentRefreshToken }, // Zakładamy, że tu jest 'refresh'
        false
      );
      // ... (reszta logiki zapisu tokenów bez zmian) ...
        const newAccessToken = response.access; const newRefreshToken = response.refresh; if (!newAccessToken) { console.error('[AuthAPI] Odpowiedź API odświeżania nie zawiera nowego access tokena.'); throw new Error('Brak nowego tokenu dostępu w odpowiedzi.'); } const storePromises: Promise<void>[] = [AuthStorage.storeAccessToken(newAccessToken)]; if (newRefreshToken) { console.log('[AuthAPI] Otrzymano i zapisywany jest również nowy refresh token.'); storePromises.push(AuthStorage.storeRefreshToken(newRefreshToken)); } await Promise.all(storePromises); console.log('[AuthAPI] Token pomyślnie odświeżony i zapisany.'); return newAccessToken;
    } catch (error) { /* ... obsługa błędów (bez zmian) ... */ console.error('[AuthAPI] Błąd podczas wywołania API odświeżania tokenu:', error); if (error instanceof apiClient.ApiError) { throw error; } else if (error instanceof Error) { throw new apiClient.ApiError(error.message, 0, error); } else { throw new apiClient.ApiError('Nieznany błąd podczas odświeżania tokenu.', 0, error); } }
  }
};

export default authApi;