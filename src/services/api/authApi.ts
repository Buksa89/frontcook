// src/services/api/authApi.ts
import apiClient from './apiClient';
import AuthStorage from '../auth/authStorage';

// ZMIANA: Interfejs LoginRequest używa teraz 'username'
export interface LoginRequest {
  username: string; // Zamiast 'login'
  password: string;
}
// ZMIANA: Interfejs LoginResponse oczekuje 'user_id' jako number
export interface LoginResponse {
  access: string;
  refresh: string;
  user_id: number; // Zamiast 'userId' i jako number
  is_first_ever_login: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  password2: string;
}
export interface RegisterResponse {
  username: string;
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
}
export interface ResetPasswordResponse {
  detail: string;
}

export interface LogoutResponse {
    detail?: string;
}

const authApi = {
  /**
   * Loguje użytkownika.
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> { // Używa zaktualizowanego LoginRequest
    try {
      console.log('[AuthAPI] Wysyłanie żądania logowania...');
      // Wysyła credentials (które teraz zawierają 'username')
      const response = await apiClient.post<LoginResponse>(
        '/api/auth/login/',
        credentials,
        false
      );
      console.log('[AuthAPI] Logowanie udane.');
      // Oczekuje odpowiedzi ze zaktualizowanego LoginResponse
      return response;
    } catch (error) {
      console.error('[AuthAPI] Błąd logowania:', error);
      throw error;
    }
  },

  // Reszta metod (register, resetPassword, logout) bez zmian w tym pliku
  async register(userData: RegisterRequest): Promise<RegisterResponse> { /* ... bez zmian ... */
      try {
        console.log('[AuthAPI] Wysyłanie żądania rejestracji...');
        const response = await apiClient.post<RegisterResponse>( '/api/auth/register/', userData, false );
        console.log('[AuthAPI] Rejestracja udana.');
        return response;
      } catch (error) { console.error('[AuthAPI] Błąd rejestracji:', error); throw error; }
  },
  async resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> { /* ... bez zmian ... */
      try {
        console.log('[AuthAPI] Wysyłanie żądania resetu hasła...');
        const response = await apiClient.post<ResetPasswordResponse>( '/api/auth/forgot-password/', data, false );
        console.log('[AuthAPI] Żądanie resetu hasła wysłane.');
        return response;
      } catch (error) { console.error('[AuthAPI] Błąd resetowania hasła:', error); throw error; }
  },
  async logout(refreshToken: string | null): Promise<LogoutResponse | void> { /* ... bez zmian ... */
      if (!refreshToken) { console.warn('[AuthAPI] Próba wylogowania bez refresh tokena.'); return; }
      try {
          console.log('[AuthAPI] Wysyłanie żądania wylogowania...');
          const response = await apiClient.post<LogoutResponse>( '/api/auth/logout/', { refresh: refreshToken }, true );
          console.log('[AuthAPI] Żądanie wylogowania API zakończone.');
          return response;
      } catch (error: any) {
          if (error.status === 401) { console.warn('[AuthAPI] Otrzymano 401 podczas wylogowania (kontynuacja).'); return; }
          console.error('[AuthAPI] Błąd żądania wylogowania:', error); throw error;
      }
  },
};

export default authApi;