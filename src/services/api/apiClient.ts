// src/services/api/apiClient.ts
import { API_URL, DEBUG } from '../../config/env';
import AuthStorage from '../auth/authStorage';
// Importuj instancję authService - teraz bezpieczne
import authService from '../auth/authService';

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

// Kolejka oczekujących żądań podczas odświeżania
type PendingRequestCallback = (token: string | null) => void;
let isRefreshing = false;
let failedQueue: PendingRequestCallback[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(callback => callback(token));
  failedQueue = [];
};

/**
 * Klient API z automatycznym odświeżaniem tokenu.
 */
class ApiClient {
  private baseUrl: string;
  // Nie potrzebujemy już refreshTokenFunction

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }

  // setRefreshTokenFunction zostało usunięte

  private normalizeUrl(endpoint: string): string {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return `${this.baseUrl}${normalizedEndpoint}`;
  }

  private isRefreshTokenEndpoint(endpoint: string): boolean {
    return endpoint.includes('/api/auth/refresh-token/');
  }

   private isLoginEndpoint(endpoint: string): boolean {
     return endpoint.includes('/api/auth/login/');
   }

  private async parseErrorResponse(response: Response): Promise<ApiError> {
    // Logika bez zmian
    let errorMessage = `Błąd API: ${response.status} ${response.statusText || 'Unknown Status'}`;
    let errorData: any = null;
    try {
      const data = await response.json(); errorData = data;
      if (typeof data === 'string') errorMessage = data;
      else if (data?.detail) errorMessage = data.detail;
      else if (data?.message) errorMessage = data.message;
      else if (data?.error) errorMessage = data.error;
      else if (data?.non_field_errors) errorMessage = data.non_field_errors.join(', ');
      else { const fieldErrors = Object.entries(data || {}).map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`).join('; '); if (fieldErrors) errorMessage = fieldErrors; }
    } catch (e) { console.warn(`[API] Nie udało się sparsować odpowiedzi błędu jako JSON dla statusu ${response.status}.`); try { const textData = await response.text(); if (textData) { errorMessage = textData.substring(0, 200); errorData = { rawError: textData }; } } catch (textError) {} }
    return new ApiError(errorMessage, response.status, errorData);
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    authenticated: boolean = true
  ): Promise<T> {
    const url = this.normalizeUrl(endpoint);
    let headers = { ...options.headers } as Record<string, string>;

    // Domyślne nagłówki
    headers['Accept'] = 'application/json';
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Dołącz token
    if (authenticated) {
      const token = await AuthStorage.retrieveAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else if (!this.isRefreshTokenEndpoint(endpoint)) {
        console.warn(`[API] Wykonanie uwierzytelnionego zapytania (${endpoint}) bez zapisanego tokenu.`);
        delete headers['Authorization'];
      }
    }

    let config: RequestInit = { ...options, headers };

    if (DEBUG) console.log(`🚀 API REQ: ${config.method || 'GET'} ${endpoint}`);

    try {
      let response = await fetch(url, config);

      // --- Obsługa Błędu 401 ---
      if (response.status === 401 && authenticated && !this.isRefreshTokenEndpoint(endpoint) && !this.isLoginEndpoint(endpoint)) {
        console.log(`[API] Otrzymano 401 dla ${endpoint}. Próba odświeżenia tokenu...`);

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            // Wywołaj metodę bezpośrednio z zaimportowanego authService
            const newAccessToken = await authService.refreshAccessToken();
            if (newAccessToken) {
              console.log('[API] Token pomyślnie odświeżony przez authService.refreshAccessToken.');
              processQueue(null, newAccessToken);
              headers['Authorization'] = `Bearer ${newAccessToken}`;
              config = { ...options, headers };
              response = await fetch(url, config);

              if (!response.ok) {
                 console.error(`[API] Ponowione zapytanie dla ${endpoint} również zwróciło błąd ${response.status}.`);
                 throw await this.parseErrorResponse(response);
              }
            } else {
              console.error('[API] Odświeżanie tokenu nie powiodło się (authService zwrócił null).');
               const refreshError = new ApiError('Sesja wygasła lub błąd odświeżania tokenu.', 401);
              processQueue(refreshError, null);
              throw refreshError;
            }
          } catch (refreshError: any) {
             console.error('[API] Krytyczny błąd podczas wywoływania authService.refreshAccessToken:', refreshError);
             processQueue(refreshError, null);
             throw new ApiError(refreshError.message || 'Błąd odświeżania tokenu.', refreshError.status || 401);
          } finally {
            isRefreshing = false;
          }
        } else {
          // Dodaj do kolejki
          console.log(`[API] Odświeżanie w toku, dodawanie ${endpoint} do kolejki.`);
          return new Promise<T>((resolve, reject) => {
            failedQueue.push(async (newAccessToken: string | null) => {
               if (!newAccessToken) {
                   console.log(`[API Queue] Odświeżanie nie powiodło się, odrzucanie zapytania dla ${endpoint}.`);
                   reject(new ApiError('Odświeżanie tokenu nie powiodło się.', 401));
                   return;
               }
              try {
                  headers['Authorization'] = `Bearer ${newAccessToken}`;
                  const retryConfig = { ...options, headers };
                  const retryResponse = await fetch(url, retryConfig);
                  if (!retryResponse.ok) { throw await this.parseErrorResponse(retryResponse); }
                  const data = await this.handleResponse<T>(retryResponse);
                  resolve(data);
              } catch (retryError) { reject(retryError); }
            });
          });
        }
      } // Koniec obsługi 401

      // --- Obsługa Innych Odpowiedzi ---
      if (!response.ok) { throw await this.parseErrorResponse(response); }
      return await this.handleResponse<T>(response);

    } catch (error) {
      // Obsługa błędów (bez zmian)
      if (error instanceof ApiError) { console.error(`[API] Błąd ${error.status} dla ${config.method || 'GET'} ${endpoint}: ${error.message}`, error.data ? JSON.stringify(error.data).substring(0, 300) : ''); throw error; }
      else if (error instanceof Error) { console.error(`[API] Błąd sieciowy lub fetch dla ${config.method || 'GET'} ${endpoint}: ${error.message}`, error); throw new ApiError(error.message || 'Błąd połączenia sieciowego', 0); }
      else { console.error(`[API] Nieznany typ błędu dla ${config.method || 'GET'} ${endpoint}:`, error); throw new ApiError('Wystąpił nieznany błąd', 0); }
    }
  }

  /** Przetwarza pomyślną odpowiedź fetch. */
  private async handleResponse<T>(response: Response): Promise<T> {
    // Logika bez zmian
    if (response.status === 204 || response.headers.get('content-length') === '0') { return {} as T; }
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) { try { const data = await response.json(); return data as T; } catch (jsonError) { console.error(`[API] Błąd parsowania JSON dla ${response.url}:`, jsonError); throw new ApiError('Nieprawidłowa odpowiedź JSON z serwera.', response.status); } }
    else { console.log(`[API] Otrzymano odpowiedź inną niż JSON (${contentType}) dla ${response.url}`); return response as unknown as T; }
  }

  // --- Metody Pomocnicze (bez zmian) ---
  async get<T>(endpoint: string, authenticated: boolean = true): Promise<T> { return this.request<T>(endpoint, { method: 'GET' }, authenticated); }
  async post<T>(endpoint: string, data?: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> {
    // Zmiana: Tworzymy nowy obiekt nagłówków zamiast modyfikować istniejący
    let finalHeaders: Record<string, string> = { ...(headers || {}) };
    const options: RequestInit = { method: 'POST' };

    if (data instanceof FormData) {
      options.body = data;
      // Usuwamy Content-Type z naszego nowego obiektu
      delete finalHeaders['Content-Type'];
    } else if (data !== undefined && data !== null) {
      options.body = JSON.stringify(data);
      // Dodajemy Content-Type do naszego nowego obiektu, jeśli go nie ma
      if (!finalHeaders['Content-Type']) {
          finalHeaders['Content-Type'] = 'application/json';
      }
    }

    // Przypisujemy finalny obiekt nagłówków do opcji
    options.headers = finalHeaders;

    return this.request<T>(endpoint, options, authenticated);
  }
  async put<T>(endpoint: string, data: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> { /* ... jak poprzednio ... */ const options: RequestInit = { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data), }; return this.request<T>(endpoint, options, authenticated); }
  async patch<T>(endpoint: string, data: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> { /* ... jak poprzednio ... */ const options: RequestInit = { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data), }; return this.request<T>(endpoint, options, authenticated); }
  async delete<T>(endpoint: string, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> { /* ... jak poprzednio ... */ return this.request<T>(endpoint, { method: 'DELETE', headers: headers }, authenticated); }
}

const apiClient = new ApiClient(API_URL);
export default apiClient;