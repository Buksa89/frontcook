// src/services/api/apiClient.ts
import { API_URL, DEBUG } from '../../config/env';
import AuthStorage from '../auth/authStorage';
import authApi from './authApi';

export class ApiError extends Error {
  status: number;
  data?: any;
  isRefreshError?: boolean;

  constructor(message: string, status: number, data?: any, isRefreshError?: boolean) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isRefreshError = isRefreshError;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

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

  // --- ZMODYFIKOWANA METODA PARSOWANIA BŁĘDU ---
  private async parseErrorResponse(response: Response): Promise<ApiError> {
    let errorMessage = `Błąd API: ${response.status} ${response.statusText || 'Unknown Status'}`;
    let errorData: any = null;
    // --- ZMIANA: Domyślnie isSessionError jest false ---
    let isSessionError = false;

    try {
      const data = await response.json(); errorData = data;
      if (typeof data === 'string') errorMessage = data;
      else if (data?.detail) errorMessage = data.detail;
      else if (data?.message) errorMessage = data.message;
      else if (data?.error) errorMessage = data.error;
      else if (data?.non_field_errors) errorMessage = data.non_field_errors.join(', ');
      else { const fieldErrors = Object.entries(data || {}).map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`).join('; '); if (fieldErrors) errorMessage = fieldErrors; }

      // --- ZMIANA: Oznacz jako błąd sesji dla 401 LUB 403 z kodem 'token_not_valid' ---
      if (response.status === 401 || (response.status === 403 && data?.code === 'token_not_valid')) {
          isSessionError = true;
          // Użyj komunikatu z serwera jeśli jest, inaczej domyślny
          errorMessage = data?.detail || data?.message || 'Sesja wygasła lub token jest nieprawidłowy.';
      }

    } catch (e) { console.warn(`[API] Nie można sparsować odpowiedzi błędu jako JSON dla statusu ${response.status}.`); try { const textData = await response.text(); if (textData) { errorMessage = textData.substring(0, 200); errorData = { rawError: textData }; } } catch (textError) {} }

    // Zwróć ApiError z poprawnie ustawioną flagą isRefreshError
    return new ApiError(errorMessage, response.status, errorData, isSessionError);
  }
  // --- KONIEC ZMODYFIKOWANEJ METODY ---


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
        console.warn(`[API] Wykonanie uwierzytelnionego zapytania (${endpoint}) bez zapisanego access tokenu.`);
        throw new ApiError('Brak aktywnej sesji.', 401, undefined, true); // Rzucamy błąd sesji
      }
    }

    let config: RequestInit = { ...options, headers };

    if (DEBUG) { /* Logowanie zapytania (bez zmian) */ console.log(`🚀 API REQ: ${config.method || 'GET'} ${endpoint}`); if (config.body) { if (config.body instanceof FormData) { console.log('  Payload: [FormData]'); } else { try { const bodyString = JSON.stringify(config.body); console.log(`  Payload: ${bodyString.substring(0, 500)}${bodyString.length > 500 ? '...' : ''}`); } catch { console.log('  Payload: [Opaque Body]'); } } } }


    try {
      let response = await fetch(url, config);
      let parsedError: ApiError | null = null; // Zmienna do przechowywania sparsowanego błędu

      // --- ZMIANA: Sprawdzaj czy odpowiedź jest nie-OK i czy to błąd sesji ---
      if (!response.ok) {
          parsedError = await this.parseErrorResponse(response); // Sparsuj błąd od razu
      }

      // Jeśli zapytanie wymagało autentykacji, nie jest to endpoint odświeżania/logowania
      // I wystąpił błąd, który został oznaczony jako błąd sesji (401 lub 403 z token_not_valid)
      if (
          authenticated &&
          !this.isRefreshTokenEndpoint(endpoint) &&
          !this.isLoginEndpoint(endpoint) &&
          parsedError && parsedError.isRefreshError // Sprawdź flagę isRefreshError
      ) {
          console.log(`[API] Otrzymano błąd sesji (${parsedError.status}) dla ${endpoint}. Próba odświeżenia tokenu...`);

          if (!isRefreshing) {
              isRefreshing = true;
              let newAccessToken: string | null = null;
              try {
                  const currentRefreshToken = await AuthStorage.retrieveRefreshToken();
                  if (!currentRefreshToken) {
                      console.log('[API] Brak refresh tokena w storage. Nie można odświeżyć.');
                      const authError = new ApiError('Sesja wygasła. Zaloguj się ponownie.', 401, undefined, true); // Używamy 401 dla błędu braku RT
                      processQueue(authError, null);
                      throw authError;
                  }

                  newAccessToken = await authApi.refreshToken(currentRefreshToken); // Wywołaj odświeżanie
                  console.log('[API] Token pomyślnie odświeżony.');
                  processQueue(null, newAccessToken);
                  isRefreshing = false;

                  // Ponów oryginalne zapytanie z nowym tokenem
                  headers['Authorization'] = `Bearer ${newAccessToken}`;
                  config = { ...options, headers };
                  response = await fetch(url, config); // Wykonaj ponownie zapytanie

                  // Sprawdź odpowiedź ponowionego zapytania
                  if (!response.ok) {
                      console.error(`[API] Ponowione zapytanie dla ${endpoint} zwróciło błąd ${response.status}.`);
                      // Sparsuj błąd ponowionego zapytania - flaga isRefreshError zależy od tego błędu
                      throw await this.parseErrorResponse(response);
                  }
                  // Jeśli ponowione zapytanie się udało, parsedError staje się nieważny
                  parsedError = null;

              } catch (refreshError: any) {
                  console.error('[API] Błąd podczas procesu odświeżania tokenu lub ponawiania zapytania:', refreshError);
                  // Upewnij się, że rzucany błąd ma flagę isRefreshError ustawioną na true
                  const finalError = refreshError instanceof ApiError && refreshError.isRefreshError
                     ? refreshError
                     : new ApiError(refreshError.message || 'Sesja wygasła. Zaloguj się ponownie.', 401, refreshError.data, true); // Użyj 401 jako statusu błędu sesji

                  processQueue(finalError, null);
                  isRefreshing = false;
                  throw finalError; // Rzuć błąd sesji dalej
              }
          } else {
              // Odświeżanie jest już w toku, dodaj do kolejki
              console.log(`[API] Odświeżanie w toku, dodawanie ${endpoint} do kolejki.`);
              return new Promise<T>((resolve, reject) => {
                  failedQueue.push(async (newAccessToken: string | null) => {
                      if (!newAccessToken) {
                          console.log(`[API Queue] Odświeżanie nie powiodło się, odrzucanie zapytania dla ${endpoint}.`);
                          reject(new ApiError('Sesja wygasła. Zaloguj się ponownie.', 401, undefined, true)); // Błąd sesji
                          return;
                      }
                      try {
                          headers['Authorization'] = `Bearer ${newAccessToken}`;
                          const retryConfig = { ...options, headers };
                          const retryResponse = await fetch(url, retryConfig);
                          if (!retryResponse.ok) {
                              // Sparsuj błąd ponowionego zapytania z kolejki
                              throw await this.parseErrorResponse(retryResponse);
                          }
                          const data = await this.handleResponse<T>(retryResponse);
                          resolve(data);
                      } catch (retryError) { reject(retryError); }
                  });
              });
          }
      }
      // --- KONIEC ZMIENIONEJ LOGIKI OBSŁUGI BŁĘDU SESJI ---

      // Jeśli był błąd, ale nie był to obsłużony błąd sesji (lub ponowienie się nie udało), rzuć go
      if (parsedError) {
          throw parsedError;
      }
      // Jeśli nie było błędu lub odświeżanie się powiodło, przetwórz odpowiedź
      if (!response.ok) { // Dodatkowe zabezpieczenie - nie powinno się zdarzyć
           console.error(`[API] Niespodziewany błąd response.ok=false po logice odświeżania dla ${endpoint}`);
           throw await this.parseErrorResponse(response);
      }
      return await this.handleResponse<T>(response);

    } catch (error) {
      // Zapewnienie, że błąd rzucany dalej jest typu ApiError
      if (error instanceof ApiError) {
          console.error(`[API] Błąd ${error.status} dla ${config.method || 'GET'} ${endpoint}: ${error.message}${error.isRefreshError ? ' (BŁĄD SESJI)' : ''}`, error.data ? JSON.stringify(error.data).substring(0, 300) : '');
          throw error;
      }
      else if (error instanceof Error) {
          console.error(`[API] Błąd sieciowy lub fetch dla ${config.method || 'GET'} ${endpoint}: ${error.message}`, error);
          throw new ApiError(error.message || 'Błąd połączenia sieciowego', 0, undefined, false); // Błędy sieciowe nie są błędami sesji
      } else {
          console.error(`[API] Nieznany typ błędu dla ${config.method || 'GET'} ${endpoint}:`, error);
          throw new ApiError('Wystąpił nieznany błąd', 0, undefined, false);
      }
    }
  }

  // handleResponse i metody pomocnicze (GET, POST itp.) bez zmian
  private async handleResponse<T>(response: Response): Promise<T> { /* ... bez zmian ... */ if (response.status === 204 || response.headers.get('content-length') === '0') { return {} as T; } const contentType = response.headers.get('Content-Type') || ''; if (contentType.includes('application/json')) { try { const data = await response.json(); return data as T; } catch (jsonError) { console.error(`[API] Błąd parsowania JSON dla ${response.url}:`, jsonError); throw new ApiError('Nieprawidłowa odpowiedź JSON z serwera.', response.status); } } else { console.log(`[API] Otrzymano odpowiedź inną niż JSON (${contentType}) dla ${response.url}. Zwracam surową odpowiedź.`); try { const textData = await response.text(); return { rawResponse: textData } as unknown as T; } catch (textError) { console.error(`[API] Błąd odczytu odpowiedzi jako tekst dla ${response.url}:`, textError); throw new ApiError('Nie można odczytać odpowiedzi serwera.', response.status); } } }
  async get<T>(endpoint: string, authenticated: boolean = true): Promise<T> { return this.request<T>(endpoint, { method: 'GET' }, authenticated); }
  async post<T>(endpoint: string, data?: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> { let finalHeaders: Record<string, string> = { ...(headers || {}) }; const options: RequestInit = { method: 'POST' }; if (data instanceof FormData) { options.body = data; delete finalHeaders['Content-Type']; } else if (data !== undefined && data !== null) { options.body = JSON.stringify(data); if (!finalHeaders['Content-Type']) { finalHeaders['Content-Type'] = 'application/json'; } } options.headers = finalHeaders; return this.request<T>(endpoint, options, authenticated); }
  async put<T>(endpoint: string, data: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> { const options: RequestInit = { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data), }; return this.request<T>(endpoint, options, authenticated); }
  async patch<T>(endpoint: string, data: any, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> { const options: RequestInit = { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data), }; return this.request<T>(endpoint, options, authenticated); }
  async delete<T>(endpoint: string, authenticated: boolean = true, headers?: Record<string, string>): Promise<T> { return this.request<T>(endpoint, { method: 'DELETE', headers: headers }, authenticated); }
}

const apiClientInstance = new ApiClient(API_URL);
const apiClient: ApiClient & { ApiError: typeof ApiError } = Object.assign(apiClientInstance, { ApiError });

export default apiClient;