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
 * Próbuje usunąć stary obrazek i miniaturę powiązane z danym syncId.
 * Nie rzuca błędu, jeśli pliki nie istnieją.
 */
const cleanupOldImages = async (syncId: string) => {
  const dirPath = `${FileSystem.documentDirectory}images/`;
  // console.log(`[ImageProcessor Cleanup] Attempting to cleanup old images for syncId: ${syncId}`);
  try {
    // Odczytaj zawartość katalogu
    const files = await FileSystem.readDirectoryAsync(dirPath);
    
    // Znajdź pliki pasujące do wzorca syncId (*.jpg) i thumb_syncId (*.jpg)
    const oldMainImages = files.filter(f => f.startsWith(`${syncId}_`) && f.endsWith('.jpg'));
    const oldThumbnails = files.filter(f => f.startsWith(`thumb_${syncId}_`) && f.endsWith('.jpg'));
    
    const filesToDelete = [...oldMainImages, ...oldThumbnails];
    
    if (filesToDelete.length > 0) {
      // console.log(`[ImageProcessor Cleanup] Found old files to delete:`, filesToDelete);
      for (const file of filesToDelete) {
        try {
          await FileSystem.deleteAsync(`${dirPath}${file}`, { idempotent: true });
          // console.log(`[ImageProcessor Cleanup] Deleted old file: ${file}`);
        } catch (deleteError) {
          console.warn(`[ImageProcessor Cleanup] Failed to delete old file ${file}:`, deleteError); // Keep warning
        }
      }
    } else {
        // console.log(`[ImageProcessor Cleanup] No old files found for syncId: ${syncId}`);
    }
  } catch (error) {
    // Ignorujemy błędy (np. katalog nie istnieje przy pierwszym razie)
    // console.warn(`[ImageProcessor Cleanup] Error reading directory or finding files for cleanup:`, error);
  }
};

/**
 * Przetwarza obraz z pliku tymczasowego, tworzy główny obraz i miniaturę
 * 
 * @param tempImagePath Ścieżka do pliku tymczasowego
 * @param syncId ID używane do grupowania plików (ale nie jako jedyna część nazwy)
 * @returns Obiekt z ścieżkami do głównego obrazu i miniatury
 */
export const processImageFromTemp = async (
  tempImagePath: string | null,
  syncId: string
): Promise<{ mainImagePath: string | null, thumbnailPath: string | null }> => {
  if (!tempImagePath) {
    return { mainImagePath: null, thumbnailPath: null };
  }

  try {
    // Nie potrzebujemy już needsProcessing, bo zawsze tworzymy nowe pliki
    /*
    if (!await needsProcessing(tempImagePath)) { // needsProcessing doesn't need existingImagePath anymore
      // ... stara logika pomijania ...
    }
    */

    // Utwórz docelowy katalog jeśli nie istnieje
    const dirPath = `${FileSystem.documentDirectory}images/`;
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }

    // -- Czyszczenie starych obrazów PRZED zapisaniem nowych --
    await cleanupOldImages(syncId);

    // Generuj unikalne nazwy plików z timestampem
    const timestamp = Date.now();
    const mainImageFilename = `${syncId}_${timestamp}.jpg`;
    const thumbnailFilename = `thumb_${syncId}_${timestamp}.jpg`;
    const mainImagePath = `${dirPath}${mainImageFilename}`;
    const thumbnailPath = `${dirPath}${thumbnailFilename}`;
    // console.log(`[ImageProcessor] New paths: Main=${mainImagePath}, Thumb=${thumbnailPath}`);

    // Przetwarzanie głównego obrazu
    // console.log(`[ImageProcessor] Processing main image from ${tempImagePath}`);
    const mainImageResult = await ImageManipulator.manipulateAsync(
      tempImagePath,
      [{ resize: { width: TARGET_WIDTH, height: TARGET_HEIGHT } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    // console.log(`[ImageProcessor] Main image processed to temp URI: ${mainImageResult.uri}`);

    // Przetwarzanie miniatury
    // console.log(`[ImageProcessor] Processing thumbnail from ${tempImagePath}`);
    const thumbnailResult = await ImageManipulator.manipulateAsync(
      tempImagePath,
      [{ resize: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    // console.log(`[ImageProcessor] Thumbnail processed to temp URI: ${thumbnailResult.uri}`);

    // Kopiuj przetworzone obrazy do docelowych lokalizacji
    // console.log(`[ImageProcessor] Copying main image to ${mainImagePath}`);
    await FileSystem.copyAsync({
      from: mainImageResult.uri,
      to: mainImagePath
    });
    // console.log(`[ImageProcessor] Copying thumbnail to ${thumbnailPath}`);
    await FileSystem.copyAsync({
      from: thumbnailResult.uri,
      to: thumbnailPath
    });
    // console.log(`[ImageProcessor] Copy complete.`);

    // Usuń plik tymczasowy (z ImagePicker/kamery)
    try {
      // console.log(`[ImageProcessor] Deleting source temp file: ${tempImagePath}`);
      await FileSystem.deleteAsync(tempImagePath, { idempotent: true });
    } catch (cleanupError) {
      console.warn('[ImageProcessor] Failed to delete source temp file:', cleanupError); // Keep warning
    }

    // Usuń pliki tymczasowe z ImageManipulator
    try {
      // console.log(`[ImageProcessor] Deleting manipulator temp files: ${mainImageResult.uri}, ${thumbnailResult.uri}`);
      await FileSystem.deleteAsync(mainImageResult.uri, { idempotent: true });
      await FileSystem.deleteAsync(thumbnailResult.uri, { idempotent: true });
    } catch (cleanupError) {
      console.warn('[ImageProcessor] Failed to delete manipulator temp files:', cleanupError); // Keep warning
    }

    // console.log(`[ImageProcessor] Image processing successful for syncId: ${syncId}`);
    return { mainImagePath, thumbnailPath };

  } catch (error) {
    // console.error(`[ImageProcessor] Error during processing image for syncId ${syncId}:`, error);
    // console.error(`[ImageProcessor] Error stack: ${error instanceof Error ? error.stack : 'No stack'}`);
    console.error(`Error processing image for syncId ${syncId}:`, error); // Keep generic error
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
    
    // console.log(`[ImageProcessor] Zapisano obraz do pliku tymczasowego: ${tempFilePath}`);
    return tempFilePath;
  } catch (error) {
    // console.error('Błąd podczas zapisywania obrazu do pliku tymczasowego:', error);
    console.error('Error saving image to temp file:', error); // Keep generic error
    return null;
  }
};

// Domyślny eksport dla zgodności z Expo Router
export default {
  needsProcessing,
  processImageFromTemp,
  saveImageToTempFile
}; 