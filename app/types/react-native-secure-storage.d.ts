declare module 'react-native-secure-storage' {
  const EncryptedStorage: {
    setItem: (key: string, value: string) => Promise<void>;
    getItem: (key: string) => Promise<string | null>;
    removeItem: (key: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  
  export default EncryptedStorage;
} 