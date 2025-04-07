import { text } from '@nozbe/watermelondb/decorators';
import SyncModel from './SyncModel';
import { processImageFromTemp } from '../../app/utils/imageProcessor';
import { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import recipeImageApi from '../../app/api/recipeImage';
import * as FileSystem from 'expo-file-system';
import { needsProcessing } from '../../app/utils/imageProcessor';
import { Observable } from 'rxjs';

class RecipeImage extends SyncModel {
  static table = 'recipe_images';
  
  @text('image') image?: string;
  @text('thumbnail') thumbnail?: string;

  // Method to get image path
  getImage(): string | undefined {
    return this.image;
  }

  // Method to get thumbnail path
  getThumbnail(): string | undefined {
    return this.thumbnail;
  }

  // Metoda do przetwarzania obrazu
  static async processImage(
    image: string | null,
    syncId: string
  ): Promise<{ mainImagePath: string | null, thumbnailPath: string | null }> {
    if (!image) {
      return { mainImagePath: null, thumbnailPath: null };
    }

    try {
      // Pobierz ścieżkę istniejącego obrazu
      const existingImagePath = `${FileSystem.documentDirectory}images/${syncId}.jpg`;

      // Sprawdź czy obraz wymaga przetworzenia
      const shouldProcess = await needsProcessing(image, existingImagePath);

      if (shouldProcess) {
        const processedImages = await processImageFromTemp(image, syncId);
        return processedImages;
      } else {
        // Zakładamy że istnieje też miniatura jeśli istnieje główny obraz
        const thumbPath = existingImagePath?.replace('.jpg', '_thumb.jpg');
        return {
          mainImagePath: existingImagePath,
          thumbnailPath: thumbPath
        };
      }
    } catch (error) {
      console.error('Error in RecipeImage.processImage:', error);
      return { mainImagePath: null, thumbnailPath: null };
    }
  }

  // Metoda statyczna do tworzenia nowego obrazu przepisu
  static async create(
    database: Database,
    syncId: string,
    image: string | null, // Teraz to ścieżka do pliku tymczasowego
    // Optional SyncModel fields
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: Date,
    isDeleted?: boolean
  ): Promise<RecipeImage> {
    try {
      // Przetwórz obraz tymczasowy i uzyskaj ścieżki do plików
      const { mainImagePath, thumbnailPath } = await RecipeImage.processImage(image, syncId);
      
      // Tworzymy obiekt RecipeImage z przetworzonymi obrazami
      const recipeImage = await SyncModel.create.call(
        this as unknown as (new () => SyncModel) & typeof SyncModel,
        database,
        (record: SyncModel) => {
          const recipeImageRecord = record as RecipeImage;
          
          // Zapisujemy ścieżki do plików
          recipeImageRecord.image = mainImagePath || undefined;
          recipeImageRecord.thumbnail = thumbnailPath || undefined;
          recipeImageRecord.syncId = syncId;
          
          // Set optional SyncModel fields if provided
          if (syncStatusField !== undefined) recipeImageRecord.syncStatusField = syncStatusField;
          if (lastUpdate !== undefined) recipeImageRecord.lastUpdate = lastUpdate;
          if (isDeleted !== undefined) recipeImageRecord.isDeleted = isDeleted;
        }
      ) as RecipeImage;
      
      return recipeImage;
    } catch (error) {
      console.error('Error in RecipeImage.create:', error);
      throw error;
    }
  }

  // Metoda statyczna do tworzenia lub aktualizacji obrazu przepisu (upsert)
  // Przyjmuje syncId przepisu i ścieżkę do pliku tymczasowego
  static async upsert(
    database: Database,
    syncId: string,
    image: string | null, // Teraz to ścieżka do pliku tymczasowego
    // Optional SyncModel fields
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: Date,
    isDeleted?: boolean
  ): Promise<RecipeImage | null> {
    try {
      // Sprawdź, czy już istnieje RecipeImage dla tego syncId
      const existingRecipeImages = await database.get<RecipeImage>('recipe_images')
        .query(Q.where('sync_id', syncId))
        .fetch();

      if (existingRecipeImages.length > 0) {
        // Aktualizujemy istniejący RecipeImage
        const recipeImage = existingRecipeImages[0];
        // Najpierw przetwórz obraz jeśli istnieje, używając wydzielonej metody
        const { mainImagePath, thumbnailPath } = await RecipeImage.processImage(image, syncId);

        // Aktualizujemy rekord z już przetworzonymi obrazami
        await recipeImage.update(record => {
          // Ustawiamy przetworzone ścieżki obrazów, jeśli są dostępne
          if (mainImagePath) {
            record.image = mainImagePath;
            record.thumbnail = thumbnailPath || undefined;
          } else if (image === null) {
            // Jeśli image jest null, usuwamy obraz
            record.image = undefined;
            record.thumbnail = undefined;
          }

          // Update SyncModel fields if provided, otherwise mark as pending
          record.syncStatusField = syncStatusField || 'pending'; // Default to pending on update
          if (lastUpdate !== undefined) record.lastUpdate = lastUpdate;
          if (isDeleted !== undefined) record.isDeleted = isDeleted;
        });
        return recipeImage;
      } else {
        // Nie znaleziono, tworzymy nowy obiekt
        try {
          // Wykorzystujemy metodę create do utworzenia nowego obiektu ze ścieżką do pliku
          const recipeImage = await RecipeImage.create(
            database,
            syncId,
            image,
            syncStatusField || 'pending', // Default to pending on create
            lastUpdate,
            isDeleted
          );
          return recipeImage;
        } catch (createError) {
          console.error('Error creating RecipeImage in upsert:', createError);
          return null;
        }
      }
    } catch (error) {
      console.error('Error in RecipeImage.upsert:', error);
      return null;
    }
  }

  
  // Implementacja metody pre_pull_sync dla RecipeImage
  // Ta metoda jest wywoływana przed synchronizacją RecipeImage (gdyby model był synchronizowany)
  static async deserialize<T extends SyncModel>(
    database: Database,
    serverData: Record<string, any>,
    existingRecord: T | null
  ): Promise<Record<string, any>> {
    // Ensure the existing record is treated as RecipeImage or null for logic within
    const specificExistingRecord = existingRecord as RecipeImage | null;

    try {
      // Najpierw wywołaj deserialize z klasy nadrzędnej, aby przetworzyć podstawowe dane
      const deserializedData = await super.deserialize(database, serverData, existingRecord);

      // Pobierz syncId z obiektu serwera
      const syncId = serverData.sync_id;
      if (!syncId) {
          return deserializedData; // Return base deserialized data if no syncId
      }

      try {
        // Wywołaj metodę do pobrania obrazu z API
        // Pass syncId explicitly
        const updatedServerObject = await RecipeImage.retrieve_image_from_api(database, syncId);

        // Jeśli udało się pobrać obraz (retrieve_image_from_api zwraca teraz obiekt z polem image jako ścieżką temp)
        if (updatedServerObject.image) {
          // Tutaj nie przetwarzamy obrazu, tylko przekazujemy ścieżkę tymczasową dalej.
          // Właściwe przetwarzanie (processImage) powinno nastąpić w upsertBySync (lub podobnej metodzie)
          // po deserializacji, jeśli logika aplikacji tego wymaga.
          // Na potrzeby samego deserialize, po prostu przypisujemy ścieżkę.
          deserializedData.image = updatedServerObject.image;
        } else {
        }
      } catch (error) {
        console.error(`Error fetching image from API during deserialize for syncId ${syncId}:`, error);
      }

      // Zwróć zdeserializowane dane
      return deserializedData;
    } catch (error) {
      console.error(`Error in RecipeImage.deserialize for syncId ${serverData.sync_id || 'N/A'}:`, error);
      // W przypadku błędu zwróć dane po podstawowej deserializacji
      return await super.deserialize(database, serverData, existingRecord);
    }
  }
  
  // Metoda do pobierania obrazu z API na podstawie danych z serwera
  static async retrieve_image_from_api(
    database: Database,
    syncId: string,
    serverObject: Record<string, any> = {}
  ): Promise<Record<string, any>> {
    try {
      // Użyj nowego API do pobrania obrazu jako Blob
      const imageBlob = await recipeImageApi.retrieveImage(syncId);
      
      // Konwertuj Blob na base64 string
      const base64Image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Odcinamy prefiks "data:image/jpeg;base64," jeśli istnieje
          const base64 = base64data.includes('base64,') 
            ? base64data.split('base64,')[1]
            : base64data;
          resolve(base64);
        };
        reader.readAsDataURL(imageBlob);
      });
      
      // Zwróć surowe dane base64 bez przetwarzania
      if (base64Image) {
        // Zapisz base64 do pliku tymczasowego
        const tempDir = FileSystem.cacheDirectory + 'temp/';
        const dirInfo = await FileSystem.getInfoAsync(tempDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
        }
        
        const tempFilePath = tempDir + 'temp_' + syncId + '_' + Date.now() + '.jpg';
        
        // Zapisz base64 do pliku
        await FileSystem.writeAsStringAsync(tempFilePath, `data:image/jpeg;base64,${base64Image}`, {
          encoding: FileSystem.EncodingType.Base64
        });
        
        // Zaktualizuj serverObject o ścieżkę do pliku zamiast danych base64
        const updatedServerObject = {
          ...serverObject,
          image: tempFilePath
        };
        
        return updatedServerObject;
      }
      
      // Jeśli nie udało się pobrać obrazu, zwróć oryginalny obiekt
      return serverObject;
    } catch (error) {
      console.error(`Error in RecipeImage.retrieve_image_from_api for syncId ${syncId}:`, error);
      return serverObject; // Zwróć oryginalny obiekt w przypadku błędu
    }
  }

  // Metoda statyczna do obserwowania zmian w obrazach dla konkretnego przepisu
  // Ta metoda jest nieużywana w przepływie edycji, jeśli usuniemy obserwatora recipeImage
  // Można ją zostawić na później lub usunąć, jeśli nie jest potrzebna gdzie indziej.
  static observeForRecipe(database: Database, syncId: string): Observable<RecipeImage | null> {
    return database
      .get<RecipeImage>('recipe_images')
      .query(
        Q.and(
          Q.where('sync_id', syncId),
          Q.where('is_deleted', false)
        )
      )
      .observeWithColumns(['image', 'thumbnail'])
      .pipe(records => {
        return new Observable(subscriber => {
          const subscription = records.subscribe(images => {
            if (images.length === 0) {
              subscriber.next(null);
            } else {
              subscriber.next(images[0]);
            }
          });
          
          return () => subscription.unsubscribe();
        });
      });
  }
}

export default RecipeImage; 