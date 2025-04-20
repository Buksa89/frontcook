import { API_URL, DEBUG } from '../../config/env';
import AuthStorage from '../auth/authStorage'; // Importujemy AuthStorage do pobierania tokenu

// Niestandardowy błąd API
export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Podstawowy klient API z obsługą tokenu Bearer.
 * Odświeżanie tokenu zostanie dodane później.
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }

  private normalizeUrl(endpoint: string): string {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    // Zwracamy pełny URL
    return `${this.baseUrl}${normalizedEndpoint}`;
  }

  private async parseErrorResponse(response: Response): Promise<ApiError> {
    let errorMessage = `Błąd API: ${response.status} ${response.statusText || 'Unknown Status'}`;
    let errorData: any = null;
    try {
      const data = await response.json();
      errorData = data;
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
      console.warn(`[API] Nie udało się sparsować odpowiedzi błędu jako JSON dla statusu ${response.status}.`);
      // Spróbuj odczytać jako tekst, jeśli JSON zawiedzie
      try {
          const textData = await response.text();
          if (textData) {
              errorMessage = textData.substring(0, 200); // Pokaż fragment tekstu błędu
              errorData = { rawError: textData };
          }
      } catch (textError) {
          // Ignoruj błąd odczytu tekstu
      }
    }
    return new ApiError(errorMessage, response.status, errorData);
  }

  /**
   * Główna metoda wykonująca zapytania fetch.
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    authenticated: boolean = true
  ): Promise<T> {
    const url = this.normalizeUrl(endpoint);
    const headers = { ...options.headers } as Record<string, string>;

    // Domyślne nagłówki
    headers['Accept'] = 'application/json';
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Dołącz token, jeśli zapytanie jest uwierzytelnione
    if (authenticated) {
      const token = await AuthStorage.retrieveAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        // Na razie tylko ostrzeżenie, obsługa 401 będzie później
        console.warn(`[API] Wykonanie uwierzytelnionego zapytania (${endpoint}) bez tokenu.`);
        // Rzucamy błąd od razu, aby uniknąć niepotrzebnego wywołania API
        throw new ApiError('Brak tokenu dostępu do uwierzytelnionego zapytania.', 401);
      }
    }

    const config: RequestInit = { ...options, headers };

    if (DEBUG) console.log(`🚀 API REQ: ${config.method || 'GET'} ${endpoint}`);

    try {
      const response = await fetch(url, config);

      // --- Obsługa błędów HTTP ---
      if (!response.ok) {
         // Tutaj później dodamy logikę odświeżania tokenu dla 401
         if (response.status === 401 && authenticated) {
             console.error(`[API] Otrzymano 401 dla ${endpoint}. Odświeżanie tokenu nie zostało jeszcze zaimplementowane.`);
             // Rzuć błąd, który może spowodować wylogowanie
             throw await this.parseErrorResponse(response); // Rzuć błąd API
         }
         // Dla innych błędów po prostu rzuć ApiError
         throw await this.parseErrorResponse(response);
      }

      // --- Obsługa pomyślnej odpowiedzi ---
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        // if (DEBUG) console.log(`✅ API RES: ${response.status} (No Content) dla ${endpoint}`);
        return {} as T; // Zwróć pusty obiekt dla 204 No Content
      }

      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        try {
            const data = await response.json();
            // if (DEBUG) console.log(`✅ API RES: ${response.status} dla ${endpoint}`, data);
            return data as T;
        } catch (jsonError) {
             console.error(`[API] Błąd parsowania JSON dla ${endpoint}:`, jsonError);
             throw new ApiError('Nieprawidłowa odpowiedź JSON z serwera.', response.status);
        }
      } else {
        // Dla innych typów odpowiedzi (np. pliki), zwróć obiekt Response
        // console.log(`✅ API RES: ${response.status} (Non-JSON: ${contentType}) dla ${endpoint}`);
        return response as unknown as T;
      }

    } catch (error) {
      if (error instanceof ApiError) {
        console.error(`[API] Błąd ${error.status} dla ${config.method || 'GET'} ${endpoint}: ${error.message}`, error.data);
        throw error; // Rzuć dalej ApiError
      } else if (error instanceof Error) {
         // Błędy sieciowe (TypeError: Network request failed) lub inne błędy fetch
         console.error(`[API] Błąd sieciowy lub fetch dla ${config.method || 'GET'} ${endpoint}: ${error.message}`, error);
         throw new ApiError(error.message || 'Błąd połączenia sieciowego', 0); // Status 0 dla błędów sieciowych
      } else {
         console.error(`[API] Nieznany typ błędu dla ${config.method || 'GET'} ${endpoint}:`, error);
         throw new ApiError('Wystąpił nieznany błąd', 0);
      }
    }
  }

  // --- Metody Pomocnicze ---
  async get<T>(endpoint: string, authenticated: boolean = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, authenticated);
  }

  async post<T>(endpoint: string, data?: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> {
    const options: RequestInit = {
      method: 'POST',
      headers: headers,
    };
    if (data instanceof FormData) {
      options.body = data;
      // Usuń Content-Type, fetch sam go ustawi dla FormData
      if (options.headers) delete options.headers['Content-Type'];
    } else if (data !== undefined && data !== null) {
      options.body = JSON.stringify(data);
      options.headers = { 'Content-Type': 'application/json', ...options.headers };
    }
    return this.request<T>(endpoint, options, authenticated);
  }

  // Dodaj metody PUT, PATCH, DELETE w razie potrzeby (analogicznie do POST)
  async put<T>(endpoint: string, data: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> {
    const options: RequestInit = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data),
    };
    return this.request<T>(endpoint, options, authenticated);
  }

  async patch<T>(endpoint: string, data: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> {
     const options: RequestInit = {
       method: 'PATCH',
       headers: { 'Content-Type': 'application/json', ...headers },
       body: JSON.stringify(data),
     };
     return this.request<T>(endpoint, options, authenticated);
   }

  async delete<T>(endpoint: string, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers: headers }, authenticated);
  }
}

// Eksportuj instancję singletona
const apiClient = new ApiClient(API_URL);
export default apiClient;