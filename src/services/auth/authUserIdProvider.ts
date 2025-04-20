// src/services/auth/authUserIdProvider.ts
import AuthStorage from './authStorage';

/**
 * Asynchronicznie pobiera ID aktywnego użytkownika bezpośrednio z AuthStorage.
 * Ta funkcja jest bezpieczna do importowania w modelach, bo nie zależy od AuthService.
 * @returns Promise resolving to the user ID string or null.
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    // Bezpośredni odczyt z storage
    const userId = await AuthStorage.retrieveActiveUserId();
    return userId;
  } catch (error) {
    console.error('[AuthUserIdProvider] Błąd podczas pobierania ID użytkownika:', error);
    return null; // Zwróć null w razie błędu odczytu
  }
};

// Możemy też stworzyć wersję synchroniczną, jeśli będziemy zarządzać stanem ID
// w pamięci (np. w jakimś stanie globalnym aktualizowanym przez AuthContext),
// ale wersja asynchroniczna jest bezpieczniejsza na start.