// src/services/auth/authService.ts

import AuthStorage from './authStorage';
// Importuj 'api' do wywołania endpointu odświeżania
import api from '../../api/api'; // Popraw ścieżkę, jeśli trzeba
// Importuj ApiError do sprawdzania typu błędu
import { ApiError } from '../../api/api';

// Interfejs odpowiedzi z endpointu refresh (dostosuj do swojego API)
interface RefreshTokenApiResponse {
    access: string;
    refresh?: string; // Odświeżony refresh token jest często opcjonalny
}

/**
 * Serwis do zarządzania stanem uwierzytelnienia i tokenami.
 */
class AuthService {
  /** Zapisuje tokeny i ID użytkownika po udanym logowaniu. */
  async login(accessToken: string, refreshToken: string, userId: string): Promise<void> {
    try {
      await Promise.all([
        AuthStorage.storeAccessToken(accessToken),
        AuthStorage.storeRefreshToken(refreshToken),
        AuthStorage.storeActiveUserId(userId)
      ]);
      console.log('[AuthService] Zalogowano pomyślnie użytkownika:', userId);
    } catch (error) {
      console.error('[AuthService] Błąd podczas zapisu danych logowania:', error);
      throw new Error('Logowanie nie powiodło się.');
    }
  }

  /** Usuwa wszystkie dane uwierzytelniające podczas wylogowania. */
  async logout(): Promise<void> {
    console.log('[AuthService] Rozpoczynanie wylogowania...');
    // Najpierw spróbuj wywołać API logout, jeśli istnieje
    try {
        const refreshToken = await this.getRefreshToken();
        if (refreshToken) {
            // Zakładamy, że endpoint logout przyjmuje POST bez body (autoryzacja Bearer)
            // i unieważnia refresh token na serwerze.
            // Jeśli API wymaga refresh tokena w ciele:
            // await api.post('/api/auth/logout/', { refresh: refreshToken }, true);
            await api.post('/api/auth/logout/', null, true); // Wywołaj endpoint logout API
            console.log('[AuthService] Pomyślnie wywołano endpoint wylogowania API.');
        }
    } catch (error) {
        // Ignoruj błędy API podczas wylogowania (np. token już wygasł),
        // ale zaloguj je. Najważniejsze jest wyczyszczenie lokalnych danych.
        console.warn('[AuthService] Błąd podczas wywoływania API logout (kontynuacja czyszczenia lokalnego):', error);
    }

    // Zawsze czyść lokalne dane, nawet jeśli API zawiodło
    try {
      await Promise.all([
        AuthStorage.clearAccessToken(),
        AuthStorage.clearRefreshToken(),
        AuthStorage.clearActiveUserId()
      ]);
      console.log('[AuthService] Pomyślnie wyczyszczono dane lokalne.');
    } catch (error) {
      console.error('[AuthService] Błąd podczas czyszczenia danych lokalnych przy wylogowywaniu:', error);
      // Rzuć błąd, bo lokalny stan może być niespójny
      throw new Error('Wylogowanie nie powiodło się całkowicie (błąd czyszczenia danych).');
    }
  }

  /** Pobiera aktualny access token. */
  async getAccessToken(): Promise<string | null> {
    try {
      return await AuthStorage.retrieveAccessToken();
    } catch (error) {
      console.error('[AuthService] Nie udało się pobrać access tokena:', error);
      return null;
    }
  }

  /** Pobiera ID aktywnego użytkownika. */
  async getActiveUserId(): Promise<string | null> {
    try {
      return await AuthStorage.retrieveActiveUserId();
    } catch (error) {
      console.error('[AuthService] Nie udało się pobrać ID aktywnego użytkownika:', error);
      return null;
    }
  }

  /** Pobiera aktualny refresh token. */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await AuthStorage.retrieveRefreshToken();
    } catch (error) {
      console.error('[AuthService] Nie udało się pobrać refresh tokena:', error);
      return null;
    }
  }

  /** Sprawdza, czy użytkownik jest aktualnie zalogowany. */
  async isAuthenticated(): Promise<boolean> {
      try {
          const token = await this.getAccessToken();
          const userId = await this.getActiveUserId();
          return !!token && !!userId;
      } catch (error) {
          return false;
      }
  }

  /** Zapisuje nowe tokeny. */
  async saveRefreshedTokens(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      const promises = [AuthStorage.storeAccessToken(accessToken)];
      if (refreshToken) {
        promises.push(AuthStorage.storeRefreshToken(refreshToken));
      }
      await Promise.all(promises);
      console.log('[AuthService] Zapisano odświeżone tokeny.');
    } catch (error) {
      console.error('[AuthService] Błąd podczas zapisu odświeżonych tokenów:', error);
      throw new Error('Nie można zapisać odświeżonych tokenów.');
    }
  }

  /**
   * Odświeża access token używając zapisanego refresh tokena.
   * @returns Nowy access token lub null w przypadku niepowodzenia.
   */
  async refreshAccessToken(): Promise<string | null> {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
          console.log('[AuthService] Brak refresh tokena do odświeżenia. Wymagane ponowne logowanie.');
          // Nie wylogowujemy automatycznie tutaj, ApiClient obsłuży błąd 401
          // await this.logout();
          return null;
      }

      console.log('[AuthService] Próba odświeżenia tokenu...');
      try {
          // Wywołaj endpoint API odświeżania. Ważne: ustaw 'authenticated' na false,
          // aby uniknąć pętli, jeśli samo zapytanie odświeżające wymagałoby tokenu.
          // Endpoint refresh token powinien być publiczny lub autoryzowany samym refresh tokenem.
          const response = await api.post<RefreshTokenApiResponse>(
              '/api/auth/refresh-token/', // Dostosuj endpoint
              { refresh: refreshToken }, // Ciało żądania
              false // To zapytanie nie używa Bearer tokena do autoryzacji
          );

          const newAccessToken = response.access;
          const newRefreshToken = response.refresh; // Sprawdź, czy API zwraca nowy refresh token

          await this.saveRefreshedTokens(newAccessToken, newRefreshToken); // Zapisz nowe tokeny
          console.log('[AuthService] Token pomyślnie odświeżony.');
          return newAccessToken; // Zwróć nowy access token

      } catch (error) {
          // Sprawdź, czy błąd pochodzi z naszego ApiClient
          if (error instanceof ApiError) {
              console.error(`[AuthService] Błąd API (${error.status}) podczas odświeżania tokenu: ${error.message}`);
              if (error.status === 401) { // Token nieprawidłowy lub wygasł
                  console.log('[AuthService] Refresh token nieprawidłowy lub wygasł. Wylogowywanie...');
                  await this.logout(); // Wyloguj użytkownika
              }
          } else {
              // Inny błąd (np. sieciowy)
              console.error('[AuthService] Nieoczekiwany błąd podczas odświeżania tokenu:', error);
          }
          return null; // Zwróć null w przypadku jakiegokolwiek błędu odświeżania
      }
  }
}

// Eksportuj instancję singletona
const authService = new AuthService();
export default authService;