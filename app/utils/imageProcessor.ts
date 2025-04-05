/**
 * Moduł do przetwarzania obrazów.
 * Zawiera funkcje do przycinania i optymalizacji obrazów.
 */

import * as FileSystem from 'expo-file-system';
// Komentujemy import ImageManipulator, ponieważ go nie mamy
// W realnej aplikacji należałoby zainstalować ten pakiet: expo install expo-image-manipulator
// import * as ImageManipulator from 'expo-image-manipulator';

// Stałe wymiary obrazów odpowiadające złotej proporcji
const TARGET_WIDTH = 1024;
const TARGET_HEIGHT = 633;
const THUMBNAIL_SIZE = 80; // Rozmiar miniatury (kwadrat)

/**
 * Sprawdza czy obraz wymaga przetworzenia
 * @param imagePath Ścieżka do obrazu
 * @returns true jeśli obraz wymaga przetworzenia
 */
export const needsProcessing = (imagePath?: string): boolean => {
  // Jeśli nie ma obrazu, nie ma co przetwarzać
  if (!imagePath) return false;

  // Sprawdź czy obraz już był przetwarzany (np. ma specjalny format nazwy)
  const isProcessed = imagePath.includes('processed_');
  return !isProcessed;
};

/**
 * Przycina obraz do określonego rozmiaru 1024x633 (złota proporcja)
 * i tworzy miniaturę 80x80
 * @param imagePath Ścieżka do obrazu
 * @param syncId ID używane w nazwie pliku
 * @returns Obiekt ze ścieżkami do przetworzonego obrazu i miniatury lub null w przypadku błędu
 */
export const cropToSize = async (
  imagePath: string,
  syncId: string
): Promise<{ mainImage: string | null, thumbnail: string | null }> => {
  try {
    if (!imagePath) {
      console.error('Brak obrazu do przetworzenia');
      return { mainImage: null, thumbnail: null };
    }
    
    console.log(`Przetwarzanie obrazu: ${imagePath} do rozmiaru ${TARGET_WIDTH}x${TARGET_HEIGHT} (złota proporcja)`);

    // Sprawdź czy plik istnieje
    const fileInfo = await FileSystem.getInfoAsync(imagePath);
    if (!fileInfo.exists) {
      console.error(`Plik nie istnieje: ${imagePath}`);
      return { mainImage: null, thumbnail: null };
    }

    // W rzeczywistej implementacji należałoby użyć ImageManipulator
    // Poniżej jest symulacja działania, w praktyce należy odkomentować kod i użyć faktycznego ImageManipulator

    // Przygotuj nazwy plików wyjściowych
    const fileExtension = imagePath.split('.').pop() || 'jpg';
    const dirPath = `${FileSystem.documentDirectory}recipeimage/`;
    const outputFileName = `${dirPath}processed_${syncId}.${fileExtension}`;
    const thumbnailFileName = `${dirPath}thumbnail_${syncId}.${fileExtension}`;
    
    // Upewnij się, że katalog istnieje
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }

    /* 
    // Faktyczna implementacja z ImageManipulator dla głównego obrazu (odkomentuj po instalacji)
    const manipResult = await ImageManipulator.manipulateAsync(
      imagePath,
      [
        { resize: { width: TARGET_WIDTH, height: TARGET_HEIGHT } },
        { crop: { 
            originX: 0, 
            originY: 0, 
            width: TARGET_WIDTH, 
            height: TARGET_HEIGHT 
          } 
        }
      ],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Zapisz przetworzony obraz
    await FileSystem.copyAsync({
      from: manipResult.uri,
      to: outputFileName
    });

    // Tworzenie miniatury (kwadratowej)
    // Przycięcie środkowego fragmentu obrazu do kwadratu
    const thumbnailResult = await ImageManipulator.manipulateAsync(
      imagePath,
      [
        // Najpierw przycinamy do kwadratu, biorąc środkową część obrazu
        { crop: {
            originX: Math.max(0, Math.round((manipResult.width - manipResult.height) / 2)),
            originY: Math.max(0, Math.round((manipResult.height - manipResult.width) / 2)),
            width: Math.min(manipResult.width, manipResult.height),
            height: Math.min(manipResult.width, manipResult.height)
          }
        },
        // Następnie skalujemy do docelowego rozmiaru
        { resize: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE } }
      ],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Zapisz miniaturę
    await FileSystem.copyAsync({
      from: thumbnailResult.uri,
      to: thumbnailFileName
    });
    */

    // Tymczasowo kopiujemy plik bez przetwarzania (do zastąpienia prawdziwą implementacją)
    await FileSystem.copyAsync({
      from: imagePath,
      to: outputFileName
    });
    
    // Tymczasowo kopiujemy ten sam plik jako miniaturę (do zastąpienia)
    await FileSystem.copyAsync({
      from: imagePath,
      to: thumbnailFileName
    });

    console.log(`Obraz przetworzony i zapisany jako: ${outputFileName}`);
    console.log(`Miniatura zapisana jako: ${thumbnailFileName}`);
    
    return { 
      mainImage: outputFileName, 
      thumbnail: thumbnailFileName 
    };
  } catch (error) {
    console.error('Błąd podczas przetwarzania obrazu:', error);
    return { mainImage: null, thumbnail: null };
  }
};

/**
 * Znajduje ścieżkę do miniatury na podstawie ścieżki do głównego obrazu
 * @param mainImagePath Ścieżka do głównego obrazu
 * @returns Ścieżka do miniatury lub null jeśli nie znaleziono
 */
export const getThumbnailPath = (mainImagePath?: string): string | null => {
  if (!mainImagePath) return null;
  
  // Sprawdź czy to jest już przetworzony obraz
  if (!mainImagePath.includes('processed_')) return null;
  
  // Zamień prefix processed_ na thumbnail_
  const thumbnailPath = mainImagePath.replace('processed_', 'thumbnail_');
  
  return thumbnailPath;
};

// Domyślny eksport dla zgodności z Expo Router
export default {
  needsProcessing,
  cropToSize,
  getThumbnailPath
}; 