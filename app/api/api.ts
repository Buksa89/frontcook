import { API_URL, DEBUG } from '../constants/env';
import authService from '../services/auth';

/**
 * Niestandardowy błąd API z dodatkowymi informacjami
 */
export class ApiError extends Error {
  status: number;
  data: any;
  
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

type RefreshTokenHandler = () => Promise<string | null>;
type AccessTokenGetter = () => Promise<string | null>;

/**
 * Klasa obsługująca zapytania do API
 */
class ApiClient {
  private baseUrl: string;
  private isRefreshing: boolean = false;
  private refreshTokenHandler: RefreshTokenHandler | null = null;
  private accessTokenGetter: AccessTokenGetter | null = null;

  constructor(baseUrl: string) {
    // Upewnij się, że baseUrl kończy się pojedynczym ukośnikiem
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }

  setRefreshTokenHandler(handler: RefreshTokenHandler) {
    this.refreshTokenHandler = handler;
  }

  setAccessTokenGetter(getter: AccessTokenGetter) {
    this.accessTokenGetter = getter;
  }

  /**
   * Sprawdza, czy endpoint jest endpointem odświeżania tokena
   */
  private isRefreshTokenEndpoint(endpoint: string): boolean {
    return endpoint.endsWith('/api/auth/refresh-token/');
  }

  /**
   * Normalizuje URL, aby uniknąć podwójnych ukośników
   * @param baseUrl Bazowy URL
   * @param endpoint Endpoint API
   * @returns Znormalizowany URL
   */
  private normalizeUrl(baseUrl: string, endpoint: string): string {
    // Usuń ukośnik z początku endpointu, jeśli istnieje
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    
    // Połącz baseUrl (który zawsze kończy się ukośnikiem) z endpointem (bez początkowego ukośnika)
    return `${baseUrl}${normalizedEndpoint}`;
  }

  /**
   * Bezpiecznie loguje payload, usuwając wrażliwe dane jak hasła
   * @param data Dane do zalogowania
   * @returns Bezpieczna kopia danych bez wrażliwych informacji
   */
  private sanitizePayloadForLogging(data: any): any {
    if (!data) return data;
    
    // Jeśli to nie jest obiekt, zwróć dane bez zmian
    if (typeof data !== 'object') return data;
    
    // Utwórz kopię danych
    const sanitized = { ...data };
    
    // Lista kluczy, które mogą zawierać wrażliwe dane
    const sensitiveKeys = [
      'password', 'password1', 'password2', 'new_password', 'old_password', 'confirm_password', 
      'token', 'refresh', 'access', 'refresh_token', 'access_token', 'id_token', 'auth_token',
      'jwt', 'api_key', 'secret', 'secret_key', 'authorization'
    ];
    
    // Usuń wrażliwe dane
    sensitiveKeys.forEach(key => {
      if (key in sanitized) {
        sanitized[key] = '***HIDDEN***';
      }
    });
    
    // Dodatkowo sprawdź klucze, które zawierają słowo "token" lub "password"
    Object.keys(sanitized).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('token') || 
        lowerKey.includes('password') || 
        lowerKey.includes('secret') || 
        lowerKey.includes('auth') ||
        lowerKey.includes('key')
      ) {
        sanitized[key] = '***HIDDEN***';
      }
    });
    
    return sanitized;
  }

  /**
   * Bezpiecznie loguje odpowiedź, usuwając wrażliwe dane jak tokeny
   * @param data Dane odpowiedzi do zalogowania
   * @returns Bezpieczna kopia danych bez wrażliwych informacji
   */
  private sanitizeResponseForLogging(data: any): any {
    return this.sanitizePayloadForLogging(data);
  }

  /**
   * Parsuje błąd z odpowiedzi API
   * @param response Odpowiedź z API
   * @returns Obiekt z informacjami o błędzie
   */
  private async parseErrorResponse(response: Response): Promise<ApiError> {
    try {
      const data = await response.json();
      
      // Obsługa różnych formatów błędów z API
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      
      if (typeof data === 'string') {
        errorMessage = data;
      } else if (data.detail) {
        errorMessage = data.detail;
      } else if (data.message) {
        errorMessage = data.message;
      } else if (data.error) {
        errorMessage = data.error;
      } else if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
        errorMessage = data.non_field_errors.join(', ');
      } else {
        // Sprawdź, czy są błędy pól formularza
        const fieldErrors: string[] = [];
        for (const [field, errors] of Object.entries(data)) {
          if (Array.isArray(errors)) {
            fieldErrors.push(`${field}: ${(errors as string[]).join(', ')}`);
          } else if (typeof errors === 'string') {
            fieldErrors.push(`${field}: ${errors}`);
          }
        }
        
        if (fieldErrors.length > 0) {
          errorMessage = fieldErrors.join('; ');
        }
      }
      
      return new ApiError(errorMessage, response.status, data);
    } catch (e) {
      // Jeśli nie można sparsować JSON, zwróć ogólny błąd
      return new ApiError(
        `API error: ${response.status} ${response.statusText}`, 
        response.status
      );
    }
  }

  /**
   * Pobiera access token używając gettera lub z authService
   */
  private async getAccessToken(): Promise<string | null> {
    if (this.accessTokenGetter) {
      return this.accessTokenGetter();
    }
    
    // No fallback available
    return null;
  }

  /**
   * Wykonuje zapytanie do API
   * @param endpoint Endpoint API
   * @param options Opcje zapytania
   * @returns Odpowiedź z API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.normalizeUrl(this.baseUrl, endpoint);
    
    // Domyślne nagłówki
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const config = {
      ...options,
      headers,
    };

    // Loguj zapytanie, jeśli DEBUG jest włączony
    if (DEBUG) {
      let requestPayload = null;
      if (options.body && typeof options.body === 'string') {
        try {
          requestPayload = JSON.parse(options.body);
          requestPayload = this.sanitizePayloadForLogging(requestPayload);
        } catch (e) {
          requestPayload = 'Nieprawidłowy format JSON';
        }
      }
      
      console.log(`🚀 API REQUEST: ${options.method || 'GET'} ${url}`);
      if (requestPayload) {
        console.log('📦 Request Payload:', requestPayload);
      }
    }

    try {
      const response = await fetch(url, config);
      
      // Sprawdź, czy odpowiedź jest OK (status 200-299)
      if (!response.ok) {
        // Specjalna obsługa błędu 401 dla endpointu refresh-token
        if (response.status === 401 && this.isRefreshTokenEndpoint(endpoint)) {
          if (DEBUG) {
            console.log('❌ Refresh token wygasł lub jest nieprawidłowy');
          }
          // Wyrzuć specjalny błąd dla nieważnego refresh tokena
          throw new ApiError('Refresh token expired', 401);
        }

        // Standardowa obsługa błędu 401 dla innych endpointów
        if (response.status === 401 && !this.isRefreshTokenEndpoint(endpoint) && !this.isRefreshing) {
          if (DEBUG) {
            console.log(`🔄 Token expired, attempting to refresh...`);
          }
          
          this.isRefreshing = true;
          try {
            const newToken = await this.refreshToken();
            
            if (newToken) {
              if (DEBUG) {
                console.log(`🔑 Token refreshed successfully, retrying request...`);
              }
              
              // Powtórz zapytanie z nowym tokenem
              const newHeaders = {
                ...headers,
                'Authorization': `Bearer ${newToken}`,
              };
              
              const newConfig = {
                ...config,
                headers: newHeaders,
              };
              
              const newResponse = await fetch(url, newConfig);
              
              if (!newResponse.ok) {
                const error = await this.parseErrorResponse(newResponse);
                
                // Loguj pełny URL i payload (bez haseł) w przypadku błędu
                let payload = null;
                if (options.body && typeof options.body === 'string') {
                  try {
                    payload = JSON.parse(options.body);
                    payload = this.sanitizePayloadForLogging(payload);
                  } catch (e) {
                    payload = 'Nieprawidłowy format JSON';
                  }
                }
                
                console.error(`API ERROR: ${newResponse.status} ${newResponse.statusText}`);
                console.error(`URL: ${url}`);
                console.error(`Method: ${options.method}`);
                console.error(`Payload:`, payload);
                
                throw error;
              }
              
              // Jeśli odpowiedź jest pusta, zwróć pusty obiekt
              if (newResponse.status === 204) {
                if (DEBUG) {
                  console.log(`✅ API RESPONSE (after token refresh): ${newResponse.status} No Content`);
                }
                return {} as T;
              }
              
              // Obsługa kodu 205 (Reset Content) lub pustej odpowiedzi
              if (newResponse.status === 205 || newResponse.headers.get('content-length') === '0') {
                if (DEBUG) {
                  console.log(`✅ API RESPONSE (after token refresh): ${newResponse.status} ${newResponse.status === 205 ? 'Reset Content' : 'Empty Response'}`);
                }
                return {} as T;
              }
              
              // Parsuj odpowiedź jako JSON
              const newResponseData = await newResponse.json();
              
              // Loguj odpowiedź, jeśli DEBUG jest włączony
              if (DEBUG) {
                console.log(`✅ API RESPONSE (after token refresh): ${newResponse.status} ${newResponse.statusText}`);
                console.log('📦 Response Data:', this.sanitizeResponseForLogging(newResponseData));
              }
              
              return newResponseData;
            }
            
            if (DEBUG) {
              console.log(`❌ Token refresh failed, proceeding with error handling...`);
            }
          } catch (e) {
            if (e instanceof ApiError) {
              throw e;
            }
            
            // Loguj pełny URL w przypadku innych błędów
            console.error(`API request failed: ${url}`);
            console.error('Error details:', e);
            
            throw new ApiError(
              e instanceof Error ? e.message : 'Unknown API error',
              0
            );
          }
        }
        
        // Jeśli nie udało się odświeżyć tokenu lub status to nie 401
        const error = await this.parseErrorResponse(response);
        
        // Loguj pełny URL i payload (bez haseł) w przypadku błędu
        let payload = null;
        if (options.body && typeof options.body === 'string') {
          try {
            payload = JSON.parse(options.body);
            payload = this.sanitizePayloadForLogging(payload);
          } catch (e) {
            payload = 'Nieprawidłowy format JSON';
          }
        }
        
        console.error(`API ERROR: ${response.status} ${response.statusText}`);
        console.error(`URL: ${url}`);
        console.error(`Method: ${options.method}`);
        console.error(`Payload:`, payload);
        
        throw error;
      }
      
      // Jeśli odpowiedź jest pusta, zwróć pusty obiekt
      if (response.status === 204) {
        if (DEBUG) {
          console.log(`✅ API RESPONSE: ${response.status} No Content`);
        }
        return {} as T;
      }
      
      // Obsługa kodu 205 (Reset Content) lub pustej odpowiedzi
      if (response.status === 205 || response.headers.get('content-length') === '0') {
        if (DEBUG) {
          console.log(`✅ API RESPONSE: ${response.status} ${response.status === 205 ? 'Reset Content' : 'Empty Response'}`);
        }
        return {} as T;
      }
      
      // Parsuj odpowiedź jako JSON
      const responseData = await response.json();
      
      // Loguj odpowiedź, jeśli DEBUG jest włączony
      if (DEBUG) {
        console.log(`✅ API RESPONSE: ${response.status} ${response.statusText}`);
        console.log('📦 Response Data:', this.sanitizeResponseForLogging(responseData));
      }
      
      return responseData;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Loguj pełny URL w przypadku innych błędów
      console.error(`API request failed: ${url}`);
      console.error('Error details:', error);
      
      throw new ApiError(
        error instanceof Error ? error.message : 'Unknown API error',
        0
      );
    }
  }

  /**
   * Wykonuje zapytanie GET
   * @param endpoint Endpoint API
   * @param authenticated Czy zapytanie wymaga uwierzytelnienia
   * @returns Odpowiedź z API
   */
  async get<T>(endpoint: string, authenticated: boolean = false): Promise<T> {
    const options: RequestInit = {
      method: 'GET',
    };
    
    if (authenticated) {
      const accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        throw new ApiError('No access token available', 401);
      }
      
      options.headers = {
        'Authorization': `Bearer ${accessToken}`,
      };
    }
    
    return this.request<T>(endpoint, options);
  }

  /**
   * Wykonuje zapytanie POST
   * @param endpoint Endpoint API
   * @param data Dane do wysłania
   * @param authenticated Czy zapytanie wymaga uwierzytelnienia
   * @param additionalHeaders Dodatkowe nagłówki do wysłania
   * @returns Odpowiedź z API
   */
  async post<T>(
    endpoint: string, 
    data: any, 
    authenticated: boolean = false,
    additionalHeaders: Record<string, string> = {}
  ): Promise<T> {
    const options: RequestInit = {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { ...additionalHeaders }
    };
    
    if (authenticated) {
      const accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        throw new ApiError('No access token available', 401);
      }
      
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
      };
    }
    
    return this.request<T>(endpoint, options);
  }

  /**
   * Wykonuje zapytanie PUT
   * @param endpoint Endpoint API
   * @param data Dane do wysłania
   * @param authenticated Czy zapytanie wymaga uwierzytelnienia
   * @returns Odpowiedź z API
   */
  async put<T>(endpoint: string, data: any, authenticated: boolean = true): Promise<T> {
    const options: RequestInit = {
      method: 'PUT',
      body: JSON.stringify(data),
    };
    
    if (authenticated) {
      const accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        throw new ApiError('No access token available', 401);
      }
      
      options.headers = {
        'Authorization': `Bearer ${accessToken}`,
      };
    }
    
    return this.request<T>(endpoint, options);
  }

  /**
   * Wykonuje zapytanie PATCH
   * @param endpoint Endpoint API
   * @param data Dane do wysłania
   * @param authenticated Czy zapytanie wymaga uwierzytelnienia
   * @returns Odpowiedź z API
   */
  async patch<T>(endpoint: string, data: any, authenticated: boolean = true): Promise<T> {
    const options: RequestInit = {
      method: 'PATCH',
      body: JSON.stringify(data),
    };
    
    if (authenticated) {
      const accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        throw new ApiError('No access token available', 401);
      }
      
      options.headers = {
        'Authorization': `Bearer ${accessToken}`,
      };
    }
    
    return this.request<T>(endpoint, options);
  }

  /**
   * Wykonuje zapytanie DELETE
   * @param endpoint Endpoint API
   * @param authenticated Czy zapytanie wymaga uwierzytelnienia
   * @returns Odpowiedź z API
   */
  async delete<T>(endpoint: string, authenticated: boolean = true): Promise<T> {
    const options: RequestInit = {
      method: 'DELETE',
    };
    
    if (authenticated) {
      const accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        throw new ApiError('No access token available', 401);
      }
      
      options.headers = {
        'Authorization': `Bearer ${accessToken}`,
      };
    }
    
    return this.request<T>(endpoint, options);
  }

  private async refreshToken(): Promise<string | null> {
    this.isRefreshing = true;
    try {
      if (!this.refreshTokenHandler) {
        throw new Error('Refresh token handler not set');
      }
      const newToken = await this.refreshTokenHandler();
      this.isRefreshing = false;
      return newToken;
    } catch (error) {
      this.isRefreshing = false;
      throw error;
    }
  }
}

// Eksportuj instancję ApiClient
const api = new ApiClient(API_URL);
export default api; 