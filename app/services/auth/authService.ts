import AuthStorage from './authStorage';

class AuthService {
  /**
   * Zapisuje tokeny i nazwę użytkownika po zalogowaniu
   */
  static async login(accessToken: string, refreshToken: string, username: string): Promise<void> {
    try {
      await AuthStorage.storeAccessToken(accessToken);
      await AuthStorage.storeRefreshToken(refreshToken);
      await AuthStorage.storeActiveUser(username);
      console.log('[AuthService] Login successful for user:', username);
    } catch (error) {
      console.error('[AuthService] Błąd podczas logowania:', error);
      throw error;
    }
  }

  /**
   * Pobiera access token i nazwę użytkownika
   */
  static async getAuthData(): Promise<{ accessToken: string | null; activeUser: string | null }> {
    try {
      const accessToken = await AuthStorage.retrieveAccessToken();
      const activeUser = await AuthStorage.retrieveActiveUser();
      console.log('[AuthService] Retrieved auth data successfully.');
      return { accessToken, activeUser };
    } catch (error) {
      console.error('[AuthService] Błąd pobierania danych uwierzytelniających:', error);
      throw error;
    }
  }

  /**
   * Usuwa tokeny i nazwę użytkownika podczas wylogowania
   */
  static async logout(): Promise<void> {
    try {
      await AuthStorage.clearAccessToken();
      await AuthStorage.clearRefreshToken();
      await AuthStorage.clearActiveUser();
      console.log('[AuthService] Logout successful.');
    } catch (error) {
      console.error('[AuthService] Błąd podczas wylogowania:', error);
      throw error;
    }
  }

  /**
   * Usuwa tylko tokeny (bez nazwy użytkownika)
   */
  static async clearTokens(): Promise<void> {
    try {
      await AuthStorage.clearAccessToken();
      await AuthStorage.clearRefreshToken();
      console.log('[AuthService] Tokens cleared successfully.');
    } catch (error) {
      console.error('[AuthService] Błąd podczas czyszczenia tokenów:', error);
      throw error;
    }
  }

  /**
   * Pobiera nazwę aktywnego użytkownika
   */
  static async getActiveUser(): Promise<string | null> {
    try {
      const activeUser = await AuthStorage.retrieveActiveUser();
      console.log('[AuthService] Retrieved active user successfully.');
      return activeUser;
    } catch (error) {
      console.error('[AuthService] Błąd podczas pobierania aktywnego użytkownika:', error);
      throw error;
    }
  }

  /**
   * Odświeża accessToken przy użyciu refreshToken
   */
  static async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      await AuthStorage.storeAccessToken(accessToken);
      await AuthStorage.storeRefreshToken(refreshToken);
    } catch (error) {
      console.error('[AuthService] Błąd podczas zapamiętywania tokenów:', error);
      throw error;
    }
  }
}

export default AuthService;
