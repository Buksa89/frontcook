import AuthService from './authService';


export const {
  login,
  logout,
  refreshAccessToken,
  getAuthData
} = AuthService;

export default AuthService; 