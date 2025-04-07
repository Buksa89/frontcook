/**
 * Moduł do przetwarzania obrazów.
 * Zawiera funkcje do przycinania i optymalizacji obrazów.
 */

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

// Stałe wymiary obrazów odpowiadające złotej proporcji
const TARGET_WIDTH = 1024;
const TARGET_HEIGHT = 633;
const THUMBNAIL_SIZE = 160 // Rozmiar miniatury (kwadrat)

/**
 * Sprawdza czy obraz wymaga przetworzenia
 * @param newImagePath Ścieżka do nowego obrazu
 * @param existingImagePath Opcjonalna ścieżka do istniejącego obrazu
 * @returns true jeśli obraz wymaga przetworzenia
 */
export const needsProcessing = async (newImagePath?: string, existingImagePath?: string): Promise<boolean> => {
  // Jeśli nie ma danych obrazu, nie ma co przetwarzać
  if (!newImagePath) return false;

  // Jeśli nie ma istniejącego obrazu, a mamy nowy obraz, to trzeba go przetworzyć
  if (!existingImagePath) return true;
  
  try {
    
    // Sprawdź czy pliki istnieją
    const newInfo = await FileSystem.getInfoAsync(newImagePath);
    const existingInfo = await FileSystem.getInfoAsync(existingImagePath);
    
    // Jeśli któryś z plików nie istnieje, musimy przetworzyć nowy obraz
    if (!newInfo.exists || !existingInfo.exists) return true;
    
    // Jeśli rozmiary plików są różne, obrazy są różne
    if (newInfo.size !== existingInfo.size) return true;
    
    // Dla uproszczenia przyjmujemy, że różne ścieżki oznaczają różne obrazy
    return true;
  } catch (error) {
    console.error('[ImageProcessor] Błąd podczas porównywania plików:', error);
    // W razie błędu lepiej przetworzyć obraz
    return true;
  }
};

/**
 * Przetwarza obraz z pliku tymczasowego, tworzy główny obraz i miniaturę
 * 
 * @param tempImagePath Ścieżka do pliku tymczasowego
 * @param syncId ID używane do nazwania plików
 * @param existingImagePath Opcjonalna ścieżka do istniejącego obrazu dla porównania
 * @returns Obiekt z ścieżkami do głównego obrazu i miniatury
 */
export const processImageFromTemp = async (
  tempImagePath: string | null, 
  syncId: string,
  existingImagePath?: string
): Promise<{ mainImagePath: string | null, thumbnailPath: string | null }> => {
  if (!tempImagePath) {
    return { mainImagePath: null, thumbnailPath: null };
  }

  try {
    // Sprawdź czy obraz wymaga przetworzenia
    if (!await needsProcessing(tempImagePath, existingImagePath)) {
      console.log(`[ImageProcessor] Obraz nie wymaga przetworzenia dla syncId: ${syncId}`);
      
      // Usuń plik tymczasowy, ale zachowaj istniejący obraz
      try {
        await FileSystem.deleteAsync(tempImagePath, { idempotent: true });
      } catch (cleanupError) {
        console.warn('Nie udało się usunąć pliku tymczasowego:', cleanupError);
      }
      
      // Zakładamy że istnieje też miniatura jeśli istnieje główny obraz
      const thumbPath = existingImagePath?.replace('.jpg', '_thumb.jpg');
      
      return { 
        mainImagePath: existingImagePath || null, 
        thumbnailPath: thumbPath || null 
      };
    }

    // Utwórz docelowy katalog jeśli nie istnieje
    const dirPath = `${FileSystem.documentDirectory}images/`;
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }
    
    // Ścieżki do zapisania obrazów
    const mainImagePath = `${dirPath}${syncId}.jpg`;
    const thumbnailPath = `${dirPath}thumb_${syncId}.jpg`;
    
    // Przetwarzanie głównego obrazu
    const mainImageResult = await ImageManipulator.manipulateAsync(
      tempImagePath,
      [{ resize: { width: TARGET_WIDTH, height: TARGET_HEIGHT } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    // Przetwarzanie miniatury
    const thumbnailResult = await ImageManipulator.manipulateAsync(
      tempImagePath,
      [{ resize: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    // Kopiuj przetworzone obrazy do docelowych lokalizacji
    await FileSystem.copyAsync({
      from: mainImageResult.uri,
      to: mainImagePath
    });
    
    await FileSystem.copyAsync({
      from: thumbnailResult.uri,
      to: thumbnailPath
    });
    
    // Usuń plik tymczasowy
    try {
      await FileSystem.deleteAsync(tempImagePath, { idempotent: true });
    } catch (cleanupError) {
      console.warn('Nie udało się usunąć pliku tymczasowego:', cleanupError);
    }
    
    // Usuń pliki tymczasowe z ImageManipulator
    try {
      await FileSystem.deleteAsync(mainImageResult.uri, { idempotent: true });
      await FileSystem.deleteAsync(thumbnailResult.uri, { idempotent: true });
    } catch (cleanupError) {
      console.warn('Nie udało się usunąć tymczasowych plików z ImageManipulator:', cleanupError);
    }
    
    console.log(`[ImageProcessor] Obrazy przetworzone i zapisane dla syncId: ${syncId}`);
    return { mainImagePath, thumbnailPath };
  } catch (error) {
    console.error('Błąd podczas przetwarzania obrazu:', error);
    return { mainImagePath: null, thumbnailPath: null };
  }
};

/**
 * Zapisuje obraz do pliku tymczasowego
 * @param imageData String w formacie base64 lub ścieżka do pliku
 * @returns Ścieżka do pliku tymczasowego lub null w przypadku błędu
 */
export const saveImageToTempFile = async (imageData: string | null): Promise<string | null> => {
  if (!imageData) return null;
  
  try {
    // Utwórz katalog tymczasowy jeśli nie istnieje
    const tempDir = FileSystem.cacheDirectory + 'temp/';
    const dirInfo = await FileSystem.getInfoAsync(tempDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
    }
    
    const tempFilePath = tempDir + 'temp_' + Date.now() + '.jpg';
    
    // Jeśli to już jest ścieżka do pliku, zwróć ją
    if (imageData.startsWith('file://') || imageData.startsWith('/')) {
      return imageData;
    }
    
    // Sprawdź czy base64 zawiera prefiks 'data:'
    const fileContent = imageData.startsWith('data:') 
      ? imageData 
      : `data:image/jpeg;base64,${imageData}`;
    
    await FileSystem.writeAsStringAsync(tempFilePath, fileContent, {
      encoding: FileSystem.EncodingType.Base64
    });
    
    return tempFilePath;
  } catch (error) {
    console.error('Błąd podczas zapisywania obrazu do pliku tymczasowego:', error);
    return null;
  }
};

// Domyślny eksport dla zgodności z Expo Router
export default {
  needsProcessing,
  processImageFromTemp,
  saveImageToTempFile
}; 