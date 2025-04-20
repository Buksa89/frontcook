import apiClient from './apiClient'; // Importuj instancję klienta API
import AuthStorage from '../auth/authStorage'; // Potrzebny do czyszczenia przy błędach

// Interfejsy dla żądań i odpowiedzi
export interface LoginRequest {
  login: string; // Zmieniono z 'username' na 'login' zgodnie z dokumentacją API
  password: string;
}
export interface LoginResponse {
  access: string;
  refresh: string;
  userId: string; // Dodano userId
  is_first_ever_login: boolean; // Dodano flagę
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
  // Dodaj inne pola, jeśli API je zwraca
}

export interface ResetPasswordRequest {
  email: string;
}
export interface ResetPasswordResponse {
  detail: string;
}

export interface LogoutResponse {
    detail?: string; // Odpowiedź z serwera może być pusta (204) lub zawierać detal
}

// Obiekt grupujący funkcje API autentykacji
const authApi = {
  /**
   * Loguje użytkownika.
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      // Logowanie nie wymaga bycia zalogowanym (authenticated = false)
      console.log('[AuthAPI] Wysyłanie żądania logowania...');
      const response = await apiClient.post<LoginResponse>(
        '/api/auth/login/', // Dostosuj endpoint jeśli trzeba
        credentials,
        false // Nie wysyłaj tokenu Bearer przy logowaniu
      );
      console.log('[AuthAPI] Logowanie udane.');
      return response;
    } catch (error) {
      console.error('[AuthAPI] Błąd logowania:', error);
      throw error; // Rzuć błąd dalej
    }
  },

  /**
   * Rejestruje nowego użytkownika.
   */
  async register(userData: RegisterRequest): Promise<RegisterResponse> {
    try {
      // Rejestracja nie wymaga uwierzytelnienia
      console.log('[AuthAPI] Wysyłanie żądania rejestracji...');
      const response = await apiClient.post<RegisterResponse>(
        '/api/auth/register/', // Dostosuj endpoint
        userData,
        false
      );
      console.log('[AuthAPI] Rejestracja udana.');
      return response;
    } catch (error) {
      console.error('[AuthAPI] Błąd rejestracji:', error);
      throw error;
    }
  },

  /**
   * Wysyła żądanie resetowania hasła.
   */
  async resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    try {
      // Resetowanie nie wymaga uwierzytelnienia
      console.log('[AuthAPI] Wysyłanie żądania resetu hasła...');
      const response = await apiClient.post<ResetPasswordResponse>(
        '/api/auth/forgot-password/', // Dostosuj endpoint
        data,
        false
      );
      console.log('[AuthAPI] Żądanie resetu hasła wysłane.');
      return response;
    } catch (error) {
      console.error('[AuthAPI] Błąd resetowania hasła:', error);
      throw error;
    }
  },

  /**
   * Wylogowuje użytkownika (wysyła żądanie do API).
   * Czyszczenie tokenów odbywa się w AuthService.
   */
  async logout(refreshToken: string | null): Promise<LogoutResponse | void> {
      if (!refreshToken) {
          console.warn('[AuthAPI] Próba wylogowania bez refresh tokena.');
          return; // Nic nie rób, jeśli nie ma tokena do unieważnienia
      }
      try {
          console.log('[AuthAPI] Wysyłanie żądania wylogowania...');
          // Endpoint logout wymaga bycia zalogowanym (ważny access token),
          // ale w ciele wysyła refresh token do unieważnienia
          const response = await apiClient.post<LogoutResponse>(
              '/api/auth/logout/',
              { refresh: refreshToken }, // Wysyłamy refresh token w ciele
              true // To żądanie wymaga ważnego access tokenu
          );
          console.log('[AuthAPI] Żądanie wylogowania API zakończone.');
          return response;
      } catch (error: any) {
          // Jeśli wylogowanie API zwróci 401 (np. access token już wygasł),
          // to nie jest to krytyczny błąd - i tak czyścimy lokalne tokeny.
          if (error.status === 401) {
              console.warn('[AuthAPI] Otrzymano 401 podczas wylogowania (token mógł już wygasnąć). Kontynuacja.');
              return; // Zwróć void, bo operacja API technicznie się nie powiodła
          }
          console.error('[AuthAPI] Błąd żądania wylogowania:', error);
          throw error; // Rzuć inne błędy
      }
  },

  /**
    * Metoda odświeżania tokenu - implementacja w apiClient/AuthService
    * async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> { ... }
    */
};

export default authApi;