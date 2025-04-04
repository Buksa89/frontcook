import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'OmNomNom',
  slug: 'przepisy',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  updates: {
    fallbackToCacheTimeout: 0
  },
  assetBundlePatterns: [
    '**/*'
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.adamdelezuch89.przepisy',
    config: {
      usesNonExemptEncryption: false
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF'
    },
    package: 'com.adamdelezuch89.przepisy'
  },
  web: {
    favicon: './assets/favicon.png'
  },
  extra: {
    ...config.extra,
    API_URL: process.env.API_URL,
    DEBUG: process.env.DEBUG ? process.env.DEBUG.toLowerCase() === 'true' : true,
  }
}); 