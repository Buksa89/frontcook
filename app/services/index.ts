import authService from './auth';
import { asyncStorageService } from './storage';

export { authService, asyncStorageService };

export default {
  auth: authService,
  asyncStorage: asyncStorageService
}; 