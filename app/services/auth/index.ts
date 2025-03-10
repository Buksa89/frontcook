import authService from './authService';
import { storeTokens, removeTokens, isAuthenticated, getRefreshToken, getAccessToken } from './authStorage';
import { refreshAccessToken } from './refreshTokens';

export {
  storeTokens,
  removeTokens,
  isAuthenticated,
  refreshAccessToken,
  getRefreshToken,
  getAccessToken
};

export default authService; 