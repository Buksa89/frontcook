// src/services/auth/index.ts
import authService from './authService';
import { getCurrentUserId } from './authUserIdProvider';

export {
  authService,
  getCurrentUserId
};

export default authService;