import Constants from 'expo-constants';

const DEFAULT_API_URL = 'http://localhost:8000'; // Użyj odpowiedniego domyślnego URL
const DEFAULT_DEBUG = true; // Zmień na false dla produkcji

export const API_URL = Constants.expoConfig?.extra?.API_URL as string || DEFAULT_API_URL;
export const DEBUG = Constants.expoConfig?.extra?.DEBUG === undefined
    ? DEFAULT_DEBUG
    : Constants.expoConfig?.extra?.DEBUG as boolean;

if (!API_URL) {
    console.warn('API_URL is not defined, using default:', DEFAULT_API_URL);
}
console.log(`[ENV] DEBUG mode: ${DEBUG}, API_URL: ${API_URL}`);

export default { API_URL, DEBUG };