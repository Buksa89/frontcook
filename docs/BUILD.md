npx expo prebuild -p android
cd android && ./gradlew assembleRelease

npx expo start --tunnel -c