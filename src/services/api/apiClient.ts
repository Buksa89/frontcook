// src/services/api/apiClient.ts
import { API_URL, DEBUG } from '../../config/env';
import AuthStorage from '../auth/authStorage';
import authApi from './authApi'; // Używamy authApi do odświeżania

// Niestandardowy błąd API z flagą isRefreshError
export class ApiError extends Error {
  status: number;
  data?: any;
  isRefreshError?: boolean; // Flaga wskazująca błąd związany z sesją/odświeżaniem

  constructor(message: string, status: number, data?: any, isRefreshError?: boolean) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isRefreshError = isRefreshError; // Ustaw flagę
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
        throw new ApiError('Brak tokenu dostępu.', 401, undefined, true); // Oznacz jako błąd sesji
      }
    }

    let config: RequestInit = { ...options, headers };

    if (DEBUG) {
      console.log(`🚀 API REQ: ${config.method || 'GET'} ${endpoint}`);
      if (config.body) {
        if (config.body instanceof FormData) {
          console.log('  Payload: [FormData]');
        } else {
          try {
            const bodyString = JSON.stringify(config.body); // Spróbuj z JSON.stringify
            console.log(`  Payload: ${bodyString.substring(0, 500)}${bodyString.length > 500 ? '...' : ''}`);
          } catch {
            console.log('  Payload: [Opaque Body]'); // Jak nie JSON to opaque
          }
        }
      }
    }


    try {
      let response = await fetch(url, config);

      // Obsługa Błędu 401 z próbą odświeżenia
      if (response.status === 401 && authenticated && !this.isRefreshTokenEndpoint(endpoint) && !this.isLoginEndpoint(endpoint)) {
        console.log(`[API] Otrzymano 401 dla ${endpoint}. Próba odświeżenia tokenu...`);

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const currentRefreshToken = await AuthStorage.retrieveRefreshToken();
            if (!currentRefreshToken) {
               console.log('[API] Brak refresh tokena w storage. Nie można odświeżyć.');
               const authError = new ApiError('Sesja wygasła. Zaloguj się ponownie.', 401, undefined, true);
               processQueue(authError, null);
               isRefreshing = false;
               throw authError;
            }

            const newAccessToken = await authApi.refreshToken(currentRefreshToken);
            console.log('[API] Token pomyślnie odświeżony.');
            processQueue(null, newAccessToken);

            headers['Authorization'] = `Bearer ${newAccessToken}`;
            config = { ...options, headers };
            response = await fetch(url, config);

            if (!response.ok) {
               console.error(`[API] Ponowione zapytanie dla ${endpoint} również zwróciło błąd ${response.status}.`);
               throw await this.parseErrorResponse(response);
            }

          } catch (refreshError: any) {
             console.error('[API] Błąd podczas procesu odświeżania tokenu:', refreshError);
             const finalError = refreshError instanceof ApiError
                ? new ApiError(refreshError.message || 'Sesja wygasła. Zaloguj się ponownie.', refreshError.status, refreshError.data, true)
                : new ApiError('Sesja wygasła. Zaloguj się ponownie.', 401, undefined, true);
             processQueue(finalError, null);
             isRefreshing = false;
             throw finalError;
          } finally {
             // Flagę isRefreshing resetujemy w blokach try/catch, aby obsłużyć błędy
          }
        } else {
          console.log(`[API] Odświeżanie w toku, dodawanie ${endpoint} do kolejki.`);
          return new Promise<T>((resolve, reject) => {
            failedQueue.push(async (newAccessToken: string | null) => {
               if (!newAccessToken) {
                   console.log(`[API Queue] Odświeżanie nie powiodło się, odrzucanie zapytania dla ${endpoint}.`);
                   reject(new ApiError('Sesja wygasła. Zaloguj się ponownie.', 401, undefined, true));
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
      }

      if (!response.ok) { throw await this.parseErrorResponse(response); }
      return await this.handleResponse<T>(response);

    } catch (error) {
      if (error instanceof ApiError) {
          console.error(`[API] Błąd ${error.status} dla ${config.method || 'GET'} ${endpoint}: ${error.message}${error.isRefreshError ? ' (BŁĄD SESJI)' : ''}`, error.data ? JSON.stringify(error.data).substring(0, 300) : '');
          throw error;
      }
      else if (error instanceof Error) {
          console.error(`[API] Błąd sieciowy lub fetch dla ${config.method || 'GET'} ${endpoint}: ${error.message}`, error);
          throw new ApiError(error.message || 'Błąd połączenia sieciowego', 0);
      } else {
          console.error(`[API] Nieznany typ błędu dla ${config.method || 'GET'} ${endpoint}:`, error);
          throw new ApiError('Wystąpił nieznany błąd', 0);
      }
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
      if (response.status === 204 || response.headers.get('content-length') === '0') {
          return {} as T; // Zwróć pusty obiekt dla No Content
      }
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
          try {
              const data = await response.json();
              return data as T;
          } catch (jsonError) {
              console.error(`[API] Błąd parsowania JSON dla ${response.url}:`, jsonError);
              throw new ApiError('Nieprawidłowa odpowiedź JSON z serwera.', response.status);
          }
      } else {
          console.log(`[API] Otrzymano odpowiedź inną niż JSON (${contentType}) dla ${response.url}. Zwracam surową odpowiedź.`);
          // Zwrócenie surowej odpowiedzi może być problematyczne, rozważ zwrócenie tekstu lub błędu
          try {
              const textData = await response.text();
              return { rawResponse: textData } as unknown as T; // Zwróć obiekt z tekstem
          } catch (textError) {
               console.error(`[API] Błąd odczytu odpowiedzi jako tekst dla ${response.url}:`, textError);
               throw new ApiError('Nie można odczytać odpowiedzi serwera.', response.status);
          }
      }
  }


  // Metody pomocnicze GET, POST, PUT, PATCH, DELETE
  async get<T>(endpoint: string, authenticated: boolean = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, authenticated);
  }

  async post<T>(endpoint: string, data?: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> {
    let finalHeaders: Record<string, string> = { ...(headers || {}) };
    const options: RequestInit = { method: 'POST' };
    if (data instanceof FormData) {
      options.body = data;
      // Przeglądarka/Fetch sam ustawi Content-Type dla FormData z boundary
      delete finalHeaders['Content-Type'];
    } else if (data !== undefined && data !== null) {
      options.body = JSON.stringify(data);
      if (!finalHeaders['Content-Type']) {
        finalHeaders['Content-Type'] = 'application/json';
      }
    }
    options.headers = finalHeaders;
    return this.request<T>(endpoint, options, authenticated);
  }

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

const apiClientInstance = new ApiClient(API_URL);
// Dodajemy referencję do klasy ApiError do instancji
const apiClient: ApiClient & { ApiError: typeof ApiError } = Object.assign(apiClientInstance, { ApiError });

export default apiClient;