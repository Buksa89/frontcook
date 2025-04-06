/**
 * Moduł do przetwarzania obrazów.
 * Zawiera funkcje do przycinania i optymalizacji obrazów.
 */

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

// Stałe wymiary obrazów odpowiadające złotej proporcji
const TARGET_WIDTH = 1024;
const TARGET_HEIGHT = 633;
const THUMBNAIL_SIZE = 80; // Rozmiar miniatury (kwadrat)

/**
 * Normalizuje dane base64, usuwając prefiks jeśli istnieje
 * @param base64 Dane w formacie base64
 * @returns Znormalizowany string base64 bez prefiksu
 */
export const normalizeBase64 = (base64?: string): string | undefined => {
  if (!base64) return undefined;
  
  // Usuń prefiks "data:image/jpeg;base64," jeśli istnieje
  if (base64.includes('base64,')) {
    return base64.split('base64,')[1];
  }
  return base64;
};

/**
 * Sprawdza czy obraz wymaga przetworzenia
 * @param newImageBase64 Nowe dane obrazu w formacie base64
 * @param existingImageBase64 Opcjonalne istniejące dane obrazu w formacie base64
 * @returns true jeśli obraz wymaga przetworzenia
 */
export const needsProcessing = (newImageBase64?: string, existingImageBase64?: string): boolean => {
  // Jeśli nie ma danych obrazu, nie ma co przetwarzać
  if (!newImageBase64) return false;

  // Jeśli nie ma istniejącego obrazu, a mamy nowy obraz, to trzeba go przetworzyć
  if (!existingImageBase64) return true;
  
  // Normalizujemy oba base64 (usuwamy prefiksy)
  const normalizedNew = normalizeBase64(newImageBase64);
  const normalizedExisting = normalizeBase64(existingImageBase64);
  
  // Porównaj znormalizowane dane
  return normalizedNew !== normalizedExisting;
};

/**
 * Konwertuje base64 string do URI pliku
 * @param base64 Dane obrazu w formacie base64
 * @returns URI pliku tymczasowego
 */
export const base64ToTempFile = async (base64: string): Promise<string> => {
  try {
    const tempDir = FileSystem.cacheDirectory + 'temp/';
    const dirInfo = await FileSystem.getInfoAsync(tempDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
    }
    
    const tempFilePath = tempDir + 'temp_' + Date.now() + '.jpg';
    
    // Sprawdź czy base64 zawiera prefiks 'data:'
    const fileContent = base64.startsWith('data:') 
      ? base64 
      : `data:image/jpeg;base64,${base64}`;
    
    await FileSystem.writeAsStringAsync(tempFilePath, fileContent, {
      encoding: FileSystem.EncodingType.Base64
    });
    
    return tempFilePath;
  } catch (error) {
    console.error('Błąd podczas konwersji base64 do pliku:', error);
    throw error;
  }
};

/**
 * Przycina obraz do określonego rozmiaru i tworzy miniaturę
 * @param imageData Dane obrazu (base64 string lub ścieżka do pliku)
 * @param syncId ID używane do identyfikacji obrazu
 * @returns Obiekt z przetworzonymi danymi obrazu i miniatury
 */
export const cropToSize = async (
  imageData: string,
  syncId: string
): Promise<{ mainImage: string | null, thumbnail: string | null }> => {
  try {
    if (!imageData) {
      console.error('Brak danych obrazu do przetworzenia');
      return { mainImage: null, thumbnail: null };
    }
    
    // Określ źródło obrazu (ścieżka do pliku lub base64)
    let imagePath = imageData;
    let needsCleanup = false;
    
    // Jeśli dane są w formacie base64, zapisz je do pliku tymczasowego
    if (!imageData.startsWith('/') && !imageData.includes('file://')) {
      try {
        imagePath = await base64ToTempFile(imageData);
        needsCleanup = true;
      } catch (error) {
        console.error('Błąd konwersji base64 do pliku:', error);
        return { mainImage: null, thumbnail: null };
      }
    }
    
    // Przetwarzanie głównego obrazu
    const mainImageResult = await ImageManipulator.manipulateAsync(
      imagePath,
      [{ resize: { width: TARGET_WIDTH, height: TARGET_HEIGHT } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    // Przetwarzanie miniatury
    const thumbnailResult = await ImageManipulator.manipulateAsync(
      imagePath,
      [{ resize: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    // Jeśli utworzyliśmy plik tymczasowy, usuń go
    if (needsCleanup) {
      try {
        await FileSystem.deleteAsync(imagePath, { idempotent: true });
      } catch (cleanupError) {
        console.warn('Nie udało się usunąć pliku tymczasowego:', cleanupError);
      }
    }
    
    // Konwertuj URI do base64
    const mainImageBase64 = await FileSystem.readAsStringAsync(mainImageResult.uri, {
      encoding: FileSystem.EncodingType.Base64
    });
    
    const thumbnailBase64 = await FileSystem.readAsStringAsync(thumbnailResult.uri, {
      encoding: FileSystem.EncodingType.Base64
    });
    
    console.log('Obraz przetworzony pomyślnie');
    
    return {
      mainImage: mainImageBase64,
      thumbnail: thumbnailBase64
    };
  } catch (error) {
    console.error('Błąd podczas przetwarzania obrazu:', error);
    return { mainImage: null, thumbnail: null };
  }
};

/**
 * Generuje ścieżki do zapisu plików obrazów
 * @param syncId ID używane w nazwie pliku
 * @returns Ścieżki do plików obrazu i miniatury
 */
export const generateImagePaths = (syncId: string): { mainImagePath: string, thumbnailPath: string } => {
  const dirPath = `${FileSystem.documentDirectory}recipeimage/`;
  const mainImagePath = `${dirPath}processed_${syncId}.jpg`;
  const thumbnailPath = `${dirPath}thumbnail_${syncId}.jpg`;
  
  return { mainImagePath, thumbnailPath };
};

/**
 * Zapisuje dane obrazu do pliku
 * @param imageData Dane obrazu w formacie base64
 * @param filePath Ścieżka docelowa pliku
 * @returns Ścieżka zapisanego pliku lub null w przypadku błędu
 */
export const saveImageToFile = async (imageData: string, filePath: string): Promise<string | null> => {
  try {
    // Upewnij się, że katalog docelowy istnieje
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/') + 1);
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }
    
    // Zapis pliku
    await FileSystem.writeAsStringAsync(filePath, imageData, {
      encoding: FileSystem.EncodingType.Base64
    });
    
    return filePath;
  } catch (error) {
    console.error('Błąd podczas zapisywania obrazu do pliku:', error);
    return null;
  }
};

// Domyślny eksport dla zgodności z Expo Router
export default {
  needsProcessing,
  cropToSize,
  generateImagePaths,
  saveImageToFile,
  base64ToTempFile
}; 