// src/services/api/authApi.ts
import apiClient from './apiClient';
import AuthStorage from '../auth/authStorage'; // Import AuthStorage

// Interfejs odpowiedzi API odświeżania
interface RefreshTokenApiResponse {
  access: string;
  refresh?: string; // Nowy refresh token może być opcjonalny
}

// Interfejsy żądań i odpowiedzi dla logowania, rejestracji, resetu hasła, wylogowania
export interface LoginRequest { username: string; password: string; }
export interface LoginResponse { access: string; refresh: string; user_id: number; is_first_ever_login: boolean; }
export interface RegisterRequest { username: string; email: string; password: string; password2: string; }
export interface RegisterResponse { username: string; email: string; }
export interface ResetPasswordRequest { email: string; }
export interface ResetPasswordResponse { detail: string; }
export interface LogoutResponse { detail?: string; }

const authApi = {
  /**
   * Loguje użytkownika.
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      console.log('[AuthAPI] Wysyłanie żądania logowania...');
      // Wysyła credentials (które teraz zawierają 'username')
      const response = await apiClient.post<LoginResponse>(
        '/api/auth/login/',
        credentials,
        false // Logowanie nie wymaga tokenu Bearer
      );
      console.log('[AuthAPI] Logowanie udane.');
      // Odpowiedź zawiera tokeny i dane użytkownika
      return response;
    } catch (error) {
      console.error('[AuthAPI] Błąd logowania:', error);
      throw error;
    }
  },

  /**
   * Rejestruje nowego użytkownika.
   */
  async register(userData: RegisterRequest): Promise<RegisterResponse> {
      try {
        console.log('[AuthAPI] Wysyłanie żądania rejestracji...');
        const response = await apiClient.post<RegisterResponse>( '/api/auth/register/', userData, false );
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
        console.log('[AuthAPI] Wysyłanie żądania resetu hasła...');
        const response = await apiClient.post<ResetPasswordResponse>( '/api/auth/forgot-password/', data, false );
        console.log('[AuthAPI] Żądanie resetu hasła wysłane.');
        return response;
      } catch (error) {
        console.error('[AuthAPI] Błąd resetowania hasła:', error);
        throw error;
      }
  },

  /**
   * Wylogowuje użytkownika, wysyłając refresh token do API.
   * Ta funkcja jest teraz głównie do komunikacji z API, czyszczenie lokalne robi authService.
   */
  async logout(refreshToken: string | null): Promise<LogoutResponse | void> {
      if (!refreshToken) {
          console.warn('[AuthAPI] Próba wylogowania API bez refresh tokena.');
          return; // Nic nie rób, jeśli nie ma tokena
      }
      try {
          console.log('[AuthAPI] Wysyłanie żądania wylogowania API...');
          // Wysłanie żądania POST z refresh tokenem. Zakładamy, że nie wymaga Access Tokenu (authenticated: false lub true, zależy od API)
          // Jeśli endpoint /logout/ wymaga bycia zalogowanym (Bearer token), ustaw authenticated: true
          const response = await apiClient.post<LogoutResponse>( '/api/auth/logout/', { refresh: refreshToken }, true ); // Zakładamy, że wymaga bycia zalogowanym
          console.log('[AuthAPI] Żądanie wylogowania API zakończone.');
          return response;
      } catch (error: any) {
          // Ignoruj błąd 401 (np. token już nieważny), ale loguj inne
          if (error instanceof apiClient.ApiError && error.status === 401) {
              console.warn('[AuthAPI] Otrzymano 401 podczas wylogowania API (kontynuacja).');
              return; // Kontynuuj czyszczenie lokalne w authService
          }
          console.error('[AuthAPI] Błąd żądania wylogowania API:', error);
          throw error; // Rzuć inne błędy, aby zasygnalizować problem
      }
  },

  /**
   * NOWA FUNKCJA: Wywołuje API w celu odświeżenia tokenu.
   * Zapisuje nowe tokeny bezpośrednio do AuthStorage.
   * @param currentRefreshToken Aktualny refresh token.
   * @returns Nowy access token lub rzuca błąd.
   */
  async refreshToken(currentRefreshToken: string): Promise<string> {
    console.log('[AuthAPI] Odświeżanie tokenu przez API...');
    try {
      // Wywołaj endpoint refresh BEZ uwierzytelniania Bearer (authenticated: false)
      const response = await apiClient.post<RefreshTokenApiResponse>(
        '/api/auth/refresh-token/',
        { refresh: currentRefreshToken },
        false // To zapytanie nie używa access tokena
      );

      const newAccessToken = response.access;
      const newRefreshToken = response.refresh;

      if (!newAccessToken) {
        console.error('[AuthAPI] Odpowiedź API odświeżania nie zawiera nowego access tokena.');
        throw new Error('Brak nowego tokenu dostępu w odpowiedzi.');
      }

      // Zapisz nowe tokeny bezpośrednio przez AuthStorage
      const storePromises: Promise<void>[] = [AuthStorage.storeAccessToken(newAccessToken)];
      if (newRefreshToken) {
        console.log('[AuthAPI] Otrzymano i zapisywany jest również nowy refresh token.');
        storePromises.push(AuthStorage.storeRefreshToken(newRefreshToken));
      }
      await Promise.all(storePromises);

      console.log('[AuthAPI] Token pomyślnie odświeżony i zapisany.');
      return newAccessToken; // Zwróć tylko nowy access token

    } catch (error) {
      console.error('[AuthAPI] Błąd podczas wywołania API odświeżania tokenu:', error);
      // Jeśli to ApiError, rzuć go dalej, inaczej opakuj
      if (error instanceof apiClient.ApiError) { // Użyj typu ApiError z instancji apiClient
         throw error;
      } else if (error instanceof Error) {
         throw new apiClient.ApiError(error.message, 0, error);
      } else {
         throw new apiClient.ApiError('Nieznany błąd podczas odświeżania tokenu.', 0, error);
      }
    }
  }
};

export default authApi;