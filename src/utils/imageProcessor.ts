import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

// Stałe wymiary i jakość
const TARGET_WIDTH = 1024;
const TARGET_HEIGHT = 633; // Złota proporcja ~1.618
const TARGET_COMPRESS = 0.8; // Kompresja dla głównego obrazka (0.0 - 1.0)
const THUMBNAIL_SIZE = 160; // Rozmiar kwadratowej miniaturki
const THUMBNAIL_COMPRESS = 0.7; // Kompresja dla miniaturki

// Katalog do przechowywania obrazków
export const IMAGES_DIRECTORY = `${FileSystem.documentDirectory}recipe_images/`; // Zmieniono nazwę katalogu

/**
 * Zapewnia, że katalog na obrazki istnieje.
 */
const ensureImagesDirectoryExists = async (): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(IMAGES_DIRECTORY);
  if (!dirInfo.exists) {
    console.log(`[ImageProcessor] Tworzenie katalogu na obrazki: ${IMAGES_DIRECTORY}`);
    await FileSystem.makeDirectoryAsync(IMAGES_DIRECTORY, { intermediates: true });
  }
};

/**
 * Generuje unikalne nazwy plików dla obrazka i miniaturki.
 */
const generateFileNames = (recipeId: string): { mainFileName: string; thumbFileName: string } => {
    const timestamp = Date.now(); // Unikalny timestamp
    const mainFileName = `recipe_${recipeId}_${timestamp}.jpg`;
    const thumbFileName = `thumb_${recipeId}_${timestamp}.jpg`;
    return { mainFileName, thumbFileName };
};

/**
 * Bezpiecznie usuwa plik, jeśli istnieje.
 */
export const safeDeleteFile = async (filePath: string | null | undefined): Promise<void> => {
    if (!filePath) return;
    try {
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists) {
            // console.log(`[ImageProcessor] Usuwanie pliku: ${filePath}`);
            await FileSystem.deleteAsync(filePath, { idempotent: true });
        }
    } catch (error) {
        console.warn(`[ImageProcessor] Nie udało się usunąć pliku ${filePath}:`, error);
    }
};


/**
 * Pobiera obraz z URL, przetwarza go i miniaturkę, a następnie zapisuje lokalnie.
 * Zwraca ścieżki do zapisanych plików lub null w przypadku błędu.
 */
export const downloadAndProcessImage = async (
  remoteUrl: string,
  recipeId: string
): Promise<{ mainPath: string; thumbPath: string } | null> => {
  let downloadedFilePath: string | null = null;
  let processedMainUri: string | null = null;
  let processedThumbUri: string | null = null;

  try {
    await ensureImagesDirectoryExists();
    console.log(`[ImageProcessor] Pobieranie obrazka dla ${recipeId} z URL: ${remoteUrl}`);

    // Pobierz plik do tymczasowej lokalizacji
    const tempFileInfo = await FileSystem.downloadAsync(
      remoteUrl,
      FileSystem.cacheDirectory + `download_${recipeId}_${Date.now()}.tmp` // Unikalna nazwa tymczasowa
    );
    downloadedFilePath = tempFileInfo.uri;

    if (tempFileInfo.status !== 200) {
      throw new Error(`Nie udało się pobrać obrazka. Status: ${tempFileInfo.status}`);
    }
    console.log(`[ImageProcessor] Obrazek dla ${recipeId} pobrany do: ${downloadedFilePath}`);

    // Wygeneruj docelowe nazwy plików
    const { mainFileName, thumbFileName } = generateFileNames(recipeId);
    const mainPath = `${IMAGES_DIRECTORY}${mainFileName}`;
    const thumbPath = `${IMAGES_DIRECTORY}${thumbFileName}`;

    // Przetwarzanie głównego obrazu (resize, crop - fill, compress)
    console.log(`[ImageProcessor] Przetwarzanie głównego obrazka dla ${recipeId}`);
    const mainResult = await ImageManipulator.manipulateAsync(
      downloadedFilePath,
      [
        { resize: { width: TARGET_WIDTH } } // Najpierw przeskaluj do szerokości, zachowując proporcje
        // Można dodać crop, jeśli chcemy *dokładnie* TARGET_HEIGHT, ale fill jest często lepsze
        // { crop: { originX: 0, originY: 0, width: TARGET_WIDTH, height: TARGET_HEIGHT } }
      ],
      { compress: TARGET_COMPRESS, format: ImageManipulator.SaveFormat.JPEG }
    );
    processedMainUri = mainResult.uri;

    // Przetwarzanie miniatury (resize, crop - cover, compress)
     console.log(`[ImageProcessor] Przetwarzanie miniaturki dla ${recipeId}`);
     const thumbResult = await ImageManipulator.manipulateAsync(
       downloadedFilePath, // Użyj oryginalnie pobranego pliku do miniaturki
       [{ resize: { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE } }], // Skaluj do kwadratu (cover)
       { compress: THUMBNAIL_COMPRESS, format: ImageManipulator.SaveFormat.JPEG }
     );
     processedThumbUri = thumbResult.uri;


    // Kopiuj przetworzone pliki do docelowego katalogu
    console.log(`[ImageProcessor] Kopiowanie przetworzonych obrazków dla ${recipeId}`);
    await FileSystem.copyAsync({ from: processedMainUri, to: mainPath });
    await FileSystem.copyAsync({ from: processedThumbUri, to: thumbPath });

    console.log(`[ImageProcessor] Pomyślnie przetworzono i zapisano obrazki dla ${recipeId}`);
    return { mainPath, thumbPath };

  } catch (error) {
    console.error(`[ImageProcessor] Błąd podczas pobierania/przetwarzania obrazka dla ${recipeId}:`, error);
    return null;
  } finally {
    // Posprzątaj pliki tymczasowe (pobrany i przetworzone)
    if (downloadedFilePath) await safeDeleteFile(downloadedFilePath);
    if (processedMainUri) await safeDeleteFile(processedMainUri);
    if (processedThumbUri) await safeDeleteFile(processedThumbUri);
  }
};