// src/services/api/apiClient.ts
import { API_URL, DEBUG } from '../../config/env';
import AuthStorage from '../auth/authStorage';
// --- ZMIANA: Importuj authApi zamiast authService ---
import authApi from './authApi';
// --- KONIEC ZMIANY ---

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
    return endpoint.includes('/api/auth/refresh-token/');
  }

  private isLoginEndpoint(endpoint: string): boolean {
    return endpoint.includes('/api/auth/login/');
  }

  private async parseErrorResponse(response: Response): Promise<ApiError> {
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

    headers['Accept'] = 'application/json';
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (authenticated) {
      const token = await AuthStorage.retrieveAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else if (!this.isRefreshTokenEndpoint(endpoint) && !this.isLoginEndpoint(endpoint)) {
        console.warn(`[API] Wykonanie uwierzytelnionego zapytania (${endpoint}) bez zapisanego tokenu.`);
        // Rzucamy błąd, aby logika odświeżania/wylogowania mogła zadziałać
        throw new ApiError('Brak tokenu dostępu.', 401);
      }
    }

    let config: RequestInit = { ...options, headers };

    if (DEBUG) {
        console.log(`🚀 API REQ: ${config.method || 'GET'} ${endpoint}`);
        if (config.body) {
          if (config.body instanceof FormData) {
            console.log('  Payload: [FormData]');
          } else {
            const bodyString = String(config.body);
            console.log(`  Payload: ${bodyString.substring(0, 500)}${bodyString.length > 500 ? '...' : ''}`);
          }
        }
    }

    try {
      let response = await fetch(url, config);

      // --- ZMIANA: Obsługa Błędu 401 z użyciem authApi.refreshToken ---
      if (response.status === 401 && authenticated && !this.isRefreshTokenEndpoint(endpoint) && !this.isLoginEndpoint(endpoint)) {
        console.log(`[API] Otrzymano 401 dla ${endpoint}. Próba odświeżenia tokenu...`);

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const currentRefreshToken = await AuthStorage.retrieveRefreshToken();
            if (!currentRefreshToken) {
               console.log('[API] Brak refresh tokena w storage. Nie można odświeżyć. Czyszczenie danych.');
               await AuthStorage.clearAccessToken();
               await AuthStorage.clearActiveUserId();
               // Nie czyścimy refresh tokena, bo go nie ma
               const authError = new ApiError('Brak możliwości odświeżenia sesji.', 401);
               processQueue(authError, null);
               throw authError;
            }

            // Wywołaj dedykowaną funkcję z authApi
            const newAccessToken = await authApi.refreshToken(currentRefreshToken);
            // authApi.refreshToken samo zapisuje nowe tokeny

            console.log('[API] Token pomyślnie odświeżony przez authApi.refreshToken.');
            processQueue(null, newAccessToken); // Powiadom kolejkę o nowym tokenie

            // Ponów oryginalne zapytanie z nowym tokenem
            headers['Authorization'] = `Bearer ${newAccessToken}`;
            config = { ...options, headers }; // Zaktualizuj config
            response = await fetch(url, config); // Ponów zapytanie

            if (!response.ok) {
               console.error(`[API] Ponowione zapytanie dla ${endpoint} również zwróciło błąd ${response.status}.`);
               throw await this.parseErrorResponse(response);
            }
            // Jeśli ponowienie OK, pętla pójdzie dalej i przetworzy odpowiedź

          } catch (refreshError: any) {
             console.error('[API] Błąd podczas procesu odświeżania tokenu (wywołanie authApi.refreshToken lub błąd 401 z API refresh):', refreshError);
             // Jeśli błąd odświeżania to 401, oznacza to problem z refresh tokenem -> wyloguj
             if (refreshError instanceof ApiError && refreshError.status === 401) {
                 console.log('[API] Refresh token nieprawidłowy/wygasł. Czyszczenie danych auth...');
                 await AuthStorage.clearAccessToken();
                 await AuthStorage.clearRefreshToken();
                 await AuthStorage.clearActiveUserId();
             }
             processQueue(refreshError, null); // Powiadom kolejkę o błędzie
             throw refreshError; // Rzuć błąd dalej
          } finally {
            isRefreshing = false;
          }
        } else {
          // Odświeżanie w toku, dodaj do kolejki
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

      if (!response.ok) { throw await this.parseErrorResponse(response); }
      return await this.handleResponse<T>(response);

    } catch (error) {
      if (error instanceof ApiError) { console.error(`[API] Błąd ${error.status} dla ${config.method || 'GET'} ${endpoint}: ${error.message}`, error.data ? JSON.stringify(error.data).substring(0, 300) : ''); throw error; }
      else if (error instanceof Error) { console.error(`[API] Błąd sieciowy lub fetch dla ${config.method || 'GET'} ${endpoint}: ${error.message}`, error); throw new ApiError(error.message || 'Błąd połączenia sieciowego', 0); }
      else { console.error(`[API] Nieznany typ błędu dla ${config.method || 'GET'} ${endpoint}:`, error); throw new ApiError('Wystąpił nieznany błąd', 0); }
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 204 || response.headers.get('content-length') === '0') { return {} as T; }
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) { try { const data = await response.json(); return data as T; } catch (jsonError) { console.error(`[API] Błąd parsowania JSON dla ${response.url}:`, jsonError); throw new ApiError('Nieprawidłowa odpowiedź JSON z serwera.', response.status); } }
    else { console.log(`[API] Otrzymano odpowiedź inną niż JSON (${contentType}) dla ${response.url}`); return response as unknown as T; }
  }

  // Metody pomocnicze GET, POST, PUT, PATCH, DELETE (bez zmian)
  async get<T>(endpoint: string, authenticated: boolean = true): Promise<T> { return this.request<T>(endpoint, { method: 'GET' }, authenticated); }
  async post<T>(endpoint: string, data?: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> { let finalHeaders: Record<string, string> = { ...(headers || {}) }; const options: RequestInit = { method: 'POST' }; if (data instanceof FormData) { options.body = data; delete finalHeaders['Content-Type']; } else if (data !== undefined && data !== null) { options.body = JSON.stringify(data); if (!finalHeaders['Content-Type']) { finalHeaders['Content-Type'] = 'application/json'; } } options.headers = finalHeaders; return this.request<T>(endpoint, options, authenticated); }
  async put<T>(endpoint: string, data: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> { const options: RequestInit = { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data), }; return this.request<T>(endpoint, options, authenticated); }
  async patch<T>(endpoint: string, data: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> { const options: RequestInit = { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data), }; return this.request<T>(endpoint, options, authenticated); }
  async delete<T>(endpoint: string, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> { return this.request<T>(endpoint, { method: 'DELETE', headers: headers }, authenticated); }
}

// Tworzenie instancji i dołączanie klasy błędu do instancji
const apiClientInstance = new ApiClient(API_URL);
// Dodajemy referencję do klasy ApiError do instancji, aby można było jej używać bez importu ApiClient
const apiClient: ApiClient & { ApiError: typeof ApiError } = Object.assign(apiClientInstance, { ApiError });


export default apiClient;