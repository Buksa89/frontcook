// src/api/auth.ts
import api from './api';
// Importuj authService do logiki logout
import authService from '../services/auth/authService';

// Interfejsy (bez zmian)
export interface LoginRequest { username: string; password: string; }
export interface LoginResponse { access: string; refresh: string; userId: string; /* Zmieniono username na userId */ }
export interface RegisterRequest { username: string; email: string; password: string; password2: string; }
export interface RegisterResponse { username: string; email: string; /* Co zwraca API? */ }
export interface ResetPasswordRequest { email: string; }
export interface ResetPasswordResponse { detail: string; }
// RefreshTokenRequest/Response nie są tu potrzebne, obsługuje je authService/ApiClient
// LogoutRequest nie jest potrzebny, jeśli endpoint go nie wymaga
export interface LogoutResponse { detail?: string; }

/**
 * Obiekt singletona zawierający metody API do autoryzacji.
 */
const authApi = {
  /**
   * Loguje użytkownika.
   * @param credentials Dane logowania.
   * @returns Obiekt z tokenami i ID użytkownika.
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      // Login nie wymaga uwierzytelnienia (authenticated = false)
      const response = await api.post<LoginResponse>('/api/auth/login/', credentials, false);
      // Zapisz tokeny i userId zaraz po zalogowaniu
      if (response.access && response.refresh && response.userId) {
         await authService.login(response.access, response.refresh, response.userId);
      } else {
          console.error("[AuthApi] Niekompletna odpowiedź logowania:", response);
          throw new Error("Otrzymano niekompletne dane logowania z serwera.");
      }
      return response;
    } catch (error) {
      console.error('[AuthApi] Błąd logowania:', error);
      throw error; // Rzuć błąd dalej
    }
  },

  /**
   * Rejestruje nowego użytkownika.
   */
  async register(userData: RegisterRequest): Promise<RegisterResponse> {
    try {
      // Rejestracja nie wymaga uwierzytelnienia
      return await api.post<RegisterResponse>('/api/auth/register/', userData, false);
    } catch (error) {
      console.error('[AuthApi] Błąd rejestracji:', error);
      throw error;
    }
  },

  /**
   * Wysyła żądanie resetowania hasła.
   */
  async resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    try {
      // Resetowanie hasła nie wymaga uwierzytelnienia
      return await api.post<ResetPasswordResponse>('/api/auth/forgot-password/', data, false);
    } catch (error) {
      console.error('[AuthApi] Błąd resetowania hasła:', error);
      throw error;
    }
  },

  /**
   * Wylogowuje użytkownika (wywołuje metodę z authService).
   * Teraz nie potrzebuje tokenów jako argumentów.
   */
  async logout(): Promise<LogoutResponse | void> { // Zmieniono typ zwracany
    try {
      // Wywołaj logikę logout z authService, która obsługuje API i czyszczenie lokalne
      await authService.logout();
      // Zwróć pustą odpowiedź lub sukces, jeśli potrzeba
      return { detail: "Wylogowano pomyślnie." };
    } catch (error) {
      console.error('[AuthApi] Błąd wylogowania:', error);
      throw error;
    }
  },

  // Metoda refreshToken została usunięta, jest teraz w authService i używana przez ApiClient
};

export default authApi;