import authService from './authService';
import { storeTokens, getTokens, removeTokens, isAuthenticated } from './authStorage';
import { refreshAccessToken } from './refreshTokens';

export {
  storeTokens,
  getTokens,
  removeTokens,
  isAuthenticated,
  refreshAccessToken
};

export default authService; 