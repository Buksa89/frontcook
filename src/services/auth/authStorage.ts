// Placeholder
const AuthStorage = {
    storeAccessToken: async (token: string): Promise<void> => { console.log("TODO: Store Access Token"); },
    retrieveAccessToken: async (): Promise<string | null> => { console.log("TODO: Retrieve Access Token"); return null; },
    storeRefreshToken: async (token: string): Promise<void> => { console.log("TODO: Store Refresh Token"); },
    retrieveRefreshToken: async (): Promise<string | null> => { console.log("TODO: Retrieve Refresh Token"); return null; },
    storeActiveUserId: async (userId: string): Promise<void> => { console.log("TODO: Store User ID"); },
    retrieveActiveUserId: async (): Promise<string | null> => { console.log("TODO: Retrieve User ID"); return null; },
    clearAccessToken: async (): Promise<void> => { console.log("TODO: Clear Access Token"); },
    clearRefreshToken: async (): Promise<void> => { console.log("TODO: Clear Refresh Token"); },
    clearActiveUserId: async (): Promise<void> => { console.log("TODO: Clear User ID"); },
  };
  export default AuthStorage;