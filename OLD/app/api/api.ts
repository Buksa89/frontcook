// src/api/api.ts
import { API_URL, DEBUG } from '../constants/env'; // Popraw ścieżkę
import authService from '../services/auth/authService'; // Importuj instancję authService

// Kolejka oczekujących żądań podczas odświeżania tokenu
type PendingRequest = (token: string) => void;
let isRefreshing = false;
let failedQueue: PendingRequest[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      // Zamiast odrzucać, można spróbować ponowić żądanie,
      // ale rzucenie błędu jest bezpieczniejsze, aby obsłużyć go wyżej.
       // Jeśli chcesz przekazać błąd: prom(Promise.reject(error));
       // Dla uproszczenia, teraz po prostu nie wywołujemy callbacka z tokenem.
       // Logika w `request` obsłuży to jako nieudane odświeżenie.
       console.error("[API Queue] Błąd podczas odświeżania, żądanie nie zostanie ponowione automatycznie przez kolejkę.", error);
    } else if (token) {
      prom(token);
    }
  });
  failedQueue = []; // Wyczyść kolejkę
};

/**
 * Niestandardowy błąd API z dodatkowymi informacjami
 */
export class ApiError extends Error {
  status: number;
  data?: any; // Ustawione jako opcjonalne

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    // Ustawienie prototypu jest ważne dla instanceof
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Klasa obsługująca zapytania do API z automatycznym odświeżaniem tokenu.
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }

  private normalizeUrl(endpoint: string): string {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return `${this.baseUrl}${normalizedEndpoint}`;
  }

  private isRefreshTokenEndpoint(endpoint: string): boolean {
    // Dostosuj ścieżkę do swojego endpointu odświeżania
    return endpoint.includes('/api/auth/refresh-token/');
  }

  // Usunięto sanitizePayloadForLogging i sanitizeResponseForLogging dla zwięzłości
  // Można je dodać z powrotem, jeśli są potrzebne

  private async parseErrorResponse(response: Response): Promise<ApiError> {
    let errorMessage = `Błąd API: ${response.status} ${response.statusText}`;
    let errorData: any = null;
    try {
      const data = await response.json();
      errorData = data; // Zapisz dane błędu
      // Bardziej rozbudowane parsowanie komunikatu błędu
      if (typeof data === 'string') errorMessage = data;
      else if (data?.detail) errorMessage = data.detail;
      else if (data?.message) errorMessage = data.message;
      else if (data?.error) errorMessage = data.error;
      else if (data?.non_field_errors) errorMessage = data.non_field_errors.join(', ');
      else {
        const fieldErrors = Object.entries(data || {})
          .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
          .join('; ');
        if (fieldErrors) errorMessage = fieldErrors;
      }
    } catch (e) {
      // Błąd parsowania JSON - zostawiamy ogólny komunikat
      console.warn(`[API] Nie udało się sparsować odpowiedzi błędu jako JSON dla statusu ${response.status}.`);
    }
    return new ApiError(errorMessage, response.status, errorData);
  }

  /**
   * Główna metoda wykonująca zapytania fetch z obsługą tokenów i odświeżania.
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    authenticated: boolean = true // Domyślnie zapytania są uwierzytelnione
  ): Promise<T> {
    const url = this.normalizeUrl(endpoint);
    const headers = { ...options.headers } as Record<string, string>;

    // Domyślne nagłówki - dodajemy Accept
    headers['Accept'] = 'application/json';
    // Content-Type tylko jeśli nie jest to FormData
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Dołącz token, jeśli zapytanie jest uwierzytelnione
    if (authenticated) {
      const token = await authService.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`; // Używamy Bearer
      } else if (!this.isRefreshTokenEndpoint(endpoint)) {
        // Jeśli zapytanie wymaga tokenu, a go nie ma (i nie jest to odświeżanie)
        console.warn(`[API] Próba wykonania uwierzytelnionego zapytania (${endpoint}) bez tokenu.`);
        // Można rzucić błąd lub pozwolić API zwrócić 401, co obsłuży logika poniżej
         throw new ApiError('Brak tokenu dostępu do uwierzytelnionego zapytania.', 401);
      }
    }

    const config: RequestInit = { ...options, headers };

    // Logowanie zapytania (opcjonalne)
    if (DEBUG) console.log(`🚀 API REQ: ${config.method || 'GET'} ${endpoint}`);

    try {
      let response = await fetch(url, config);

      // --- Obsługa Błędu 401 (Unauthorized) ---
      if (response.status === 401 && authenticated && !this.isRefreshTokenEndpoint(endpoint)) {
        console.log(`[API] Otrzymano 401 dla ${endpoint}. Próba odświeżenia tokenu...`);

        if (!isRefreshing) {
          // Pierwsze zapytanie, które dostało 401 - rozpoczynamy odświeżanie
          isRefreshing = true;
          try {
            const newAccessToken = await authService.refreshAccessToken(); // Wywołaj odświeżanie
            if (newAccessToken) {
              console.log('[API] Token pomyślnie odświeżony.');
              processQueue(null, newAccessToken); // Powiadom oczekujące zapytania o sukcesie
              // Ponów oryginalne zapytanie z nowym tokenem
              headers['Authorization'] = `Bearer ${newAccessToken}`;
              response = await fetch(url, { ...config, headers }); // Wykonaj zapytanie ponownie
            } else {
              // Odświeżanie nie powiodło się (np. refresh token wygasł)
              console.error('[API] Odświeżanie tokenu nie powiodło się.');
               const refreshError = new ApiError('Sesja wygasła lub błąd odświeżania tokenu.', 401);
              processQueue(refreshError, null); // Powiadom oczekujące zapytania o błędzie
              throw refreshError; // Rzuć błąd, aby obsłużyć go wyżej (np. wylogowanie)
            }
          } catch (refreshError: any) {
             console.error('[API] Krytyczny błąd podczas próby odświeżenia tokenu:', refreshError);
             processQueue(refreshError, null); // Powiadom o błędzie
             // Rzuć błąd dalej, aby np. wylogować użytkownika
             throw new ApiError(refreshError.message || 'Błąd odświeżania tokenu.', refreshError.status || 401);
          } finally {
            isRefreshing = false; // Zakończono proces odświeżania
          }
        } else {
          // Inne zapytanie dostało 401, podczas gdy odświeżanie już trwa - dodaj do kolejki
          console.log(`[API] Odświeżanie w toku, dodawanie ${endpoint} do kolejki.`);
          return new Promise<T>((resolve, reject) => {
            failedQueue.push(async (newAccessToken: string) => {
              try {
                  // Ponów zapytanie z nowym tokenem otrzymanym przez kolejkę
                  headers['Authorization'] = `Bearer ${newAccessToken}`;
                  const retryResponse = await fetch(url, { ...config, headers });
                  if (!retryResponse.ok) {
                      // Jeśli ponowione zapytanie też zwróci błąd
                      throw await this.parseErrorResponse(retryResponse);
                  }
                  // Rozwiąż Promise z wynikiem ponowionego zapytania
                  const data = await this.handleResponse<T>(retryResponse);
                  resolve(data);
              } catch (retryError) {
                  reject(retryError); // Odrzuć Promise, jeśli ponowienie się nie powiedzie
              }
            });
          });
        }
      } // Koniec obsługi 401

      // --- Obsługa Innych Odpowiedzi ---
      if (!response.ok) {
        // Jeśli odpowiedź nie jest OK (i nie była to obsłużona 401)
        throw await this.parseErrorResponse(response);
      }

      // Obsłuż pomyślną odpowiedź
      return await this.handleResponse<T>(response);

    } catch (error) {
      // Złap błędy sieciowe lub inne nieprzewidziane błędy fetch
      if (error instanceof ApiError) {
        // Jeśli to już jest nasz ApiError, rzuć go dalej
        console.error(`[API] Błąd ${error.status} dla ${config.method || 'GET'} ${endpoint}: ${error.message}`, error.data);
        throw error;
      } else if (error instanceof Error) {
         console.error(`[API] Błąd sieciowy lub nieznany dla ${config.method || 'GET'} ${endpoint}: ${error.message}`, error);
          throw new ApiError(error.message, 0); // Status 0 dla błędów sieciowych/niesklasyfikowanych
      } else {
         console.error(`[API] Nieznany typ błędu dla ${config.method || 'GET'} ${endpoint}:`, error);
          throw new ApiError('Wystąpił nieznany błąd', 0);
      }
    }
  }

  /**
   * Przetwarza pomyślną odpowiedź fetch.
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    // Obsługa pustych odpowiedzi (204 No Content)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return {} as T; // Zwróć pusty obiekt
    }

    // Sprawdź Content-Type
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      try {
          const data = await response.json();
          // Logowanie odpowiedzi (opcjonalne)
          // if (DEBUG) console.log(`✅ API RES: ${response.status} dla ${response.url}`, data);
          return data as T;
      } catch (jsonError) {
           console.error(`[API] Błąd parsowania JSON dla ${response.url}:`, jsonError);
           throw new ApiError('Nieprawidłowa odpowiedź JSON z serwera.', response.status);
      }
    } else {
      // Jeśli nie JSON, zwróć obiekt Response (np. dla plików)
      // Można dodać obsługę innych typów (text, blob)
      console.log(`[API] Otrzymano odpowiedź inną niż JSON (${contentType}) dla ${response.url}`);
      return response as unknown as T; // Rzutowanie, zakładając, że wywołujący wie, czego się spodziewać
    }
  }

  // --- Metody Pomocnicze dla Żądań HTTP ---

  async get<T>(endpoint: string, authenticated: boolean = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, authenticated);
  }

  async post<T>(endpoint: string, data: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> {
    const options: RequestInit = {
      method: 'POST',
      headers: headers,
    };
    if (data instanceof FormData) {
      options.body = data;
      // Usuń Content-Type, fetch sam go ustawi dla FormData
      if (options.headers) delete options.headers['Content-Type'];
    } else if (data !== undefined && data !== null) { // Tylko jeśli data istnieje
      options.body = JSON.stringify(data);
       // Upewnij się, że Content-Type jest ustawiony dla JSON
      options.headers = { 'Content-Type': 'application/json', ...options.headers };
    }
    return this.request<T>(endpoint, options, authenticated);
  }

  async put<T>(endpoint: string, data: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> {
    const options: RequestInit = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers }, // PUT zazwyczaj wysyła JSON
      body: JSON.stringify(data),
    };
    return this.request<T>(endpoint, options, authenticated);
  }

  async patch<T>(endpoint: string, data: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> {
    const options: RequestInit = {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers }, // PATCH zazwyczaj wysyła JSON
      body: JSON.stringify(data),
    };
    return this.request<T>(endpoint, options, authenticated);
  }

  async delete<T>(endpoint: string, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers: headers }, authenticated);
  }
}

// Eksportuj instancję singletona ApiClient
const api = new ApiClient(API_URL);
export default api;