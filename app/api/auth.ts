import api from './api';

// Interfejsy dla danych uwierzytelniania
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  username: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  password2: string;
}

export interface RegisterResponse {
  username: string;
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ResetPasswordResponse {
  detail: string;
}

export interface RefreshTokenRequest {
  refresh: string;
}

export interface RefreshTokenResponse {
  access: string;
  refresh: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface LogoutResponse {
  detail?: string;
}

export class AuthApi {
  /**
   * Loguje użytkownika
   * @param credentials Dane logowania (username/email i hasło)
   * @returns Tokeny dostępu i odświeżania
   */
  static async login(credentials: LoginRequest): Promise<LoginResponse> {
    return api.post<LoginResponse>('/api/auth/login/', credentials);
  }

  /**
   * Rejestruje nowego użytkownika
   * @param userData Dane użytkownika (username, email, hasło, potwierdzenie hasła)
   * @returns Dane utworzonego użytkownika
   */
  static async register(userData: RegisterRequest): Promise<RegisterResponse> {
    return api.post<RegisterResponse>('/api/auth/register/', userData);
  }

  /**
   * Wysyła link do resetowania hasła
   * @param data Dane do resetowania hasła (email)
   * @returns Informacja o wysłaniu linku
   */
  static async resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    return api.post<ResetPasswordResponse>('/api/auth/forgot-password/', data);
  }

  /**
   * Wylogowuje użytkownika
   * @param refreshToken Token odświeżania do unieważnienia
   * @param accessToken Token dostępu do autoryzacji żądania
   * @returns Informacja o wylogowaniu
   */
  static async logout(refreshToken: string, accessToken: string): Promise<LogoutResponse> {
    const data: LogoutRequest = { refresh_token: refreshToken };
    const headers = {
      Authorization: `Bearer ${accessToken}`
    };
    return api.post<LogoutResponse>('/api/auth/logout/', data, false, headers);
  }

  /**
   * Odświeża token dostępu
   * @param refreshToken Token odświeżania
   * @returns Nowy token dostępu
   */
  static async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const data: RefreshTokenRequest = { refresh: refreshToken };
    return api.post<RefreshTokenResponse>('/api/auth/refresh-token/', data);
  }
}

export default AuthApi;
