import { text } from '@nozbe/watermelondb/decorators';
import SyncModel from './SyncModel';
import { needsProcessing, cropToSize, generateImagePaths, saveImageToFile } from '../../app/utils/imageProcessor';
import { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import recipeImageApi from '../../app/api/recipeImage';
import * as FileSystem from 'expo-file-system';

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

  // Metoda statyczna do tworzenia nowego obrazu przepisu
  static async create(
    database: Database,
    syncId: string,
    image: string | null,
    // Optional SyncModel fields
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: Date,
    isDeleted?: boolean
  ): Promise<RecipeImage> {
    try {
      console.log(`[RecipeImage] Tworzenie nowego obrazu dla syncId: ${syncId}`);
      
      // Przetwórz obraz przed utworzeniem rekordu, jeśli jest dostępny
      let processedImagePath: string | undefined = undefined;
      let processedThumbnailPath: string | undefined = undefined;
      
      // Przy tworzeniu zawsze przetwarzamy obraz jeśli istnieje
      // Nie ma potrzeby sprawdzać needsProcessing, bo nie ma z czym porównać
      if (image && syncId) {
        try {
          console.log(`[RecipeImage] Przetwarzanie obrazu podczas tworzenia dla syncId: ${syncId}`);
          
          // Przetwórz obraz - otrzymujemy dane w base64
          const processedImages = await cropToSize(image, syncId);
          
          if (processedImages.mainImage && processedImages.thumbnail) {
            // Generuj ścieżki do plików
            const { mainImagePath, thumbnailPath } = generateImagePaths(syncId);
            
            // Zapisz pliki
            const savedMainImagePath = await saveImageToFile(processedImages.mainImage, mainImagePath);
            const savedThumbnailPath = await saveImageToFile(processedImages.thumbnail, thumbnailPath);
            
            // Zapamiętaj ścieżki do plików
            processedImagePath = savedMainImagePath || undefined;
            processedThumbnailPath = savedThumbnailPath || undefined;
            
            console.log(`[RecipeImage] Obraz przetworzony i zapisany podczas tworzenia dla syncId: ${syncId}`);
          }
        } catch (processingError) {
          console.error(`[RecipeImage] Błąd podczas przetwarzania obrazu przy tworzeniu:`, processingError);
          // Nie przerywamy działania, kontynuujemy z tworzeniem rekordu bez obrazu
        }
      }
      
      // Tworzymy obiekt RecipeImage z wszystkimi danymi od razu
      const recipeImage = await SyncModel.create.call(
        this as unknown as (new () => SyncModel) & typeof SyncModel,
        database,
        (record: SyncModel) => {
          const recipeImageRecord = record as RecipeImage;
          
          // Zapisujemy przetworzone obrazy lub ustawiamy undefined
          recipeImageRecord.image = processedImagePath;
          recipeImageRecord.thumbnail = processedThumbnailPath;
          recipeImageRecord.syncId = syncId;
          
          // Set optional SyncModel fields if provided
          if (syncStatusField !== undefined) recipeImageRecord.syncStatusField = syncStatusField;
          if (lastUpdate !== undefined) recipeImageRecord.lastUpdate = lastUpdate;
          if (isDeleted !== undefined) recipeImageRecord.isDeleted = isDeleted;
        }
      ) as RecipeImage;
      
      console.log(`[RecipeImage] Pomyślnie utworzono obraz dla syncId: ${syncId}`);
      return recipeImage;
    } catch (error) {
      console.error(`[RecipeImage] Błąd podczas tworzenia obrazu:`, error);
      throw error;
    }
  }

  // Metoda statyczna do tworzenia lub aktualizacji obrazu przepisu (upsert)
  // Przyjmuje syncId przepisu i obraz jako base64 string
  static async upsert(
    database: Database,
    syncId: string,
    image: string | null, // Obraz w formacie base64
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
        
        // Aktualizujemy rekord - funkcja update automatycznie przetworzy obraz jeśli potrzeba
        await recipeImage.update(record => {
          // Ustawiamy obraz lub czyścimy jeśli null
          if (image !== undefined) record.image = image || undefined;
          
          // Update SyncModel fields if provided
          if (syncStatusField !== undefined) record.syncStatusField = syncStatusField;
          if (lastUpdate !== undefined) record.lastUpdate = lastUpdate;
          if (isDeleted !== undefined) record.isDeleted = isDeleted;
        });
        
        return recipeImage;
      } else {
        // Nie znaleziono, tworzymy nowy obiekt
        try {
          // Wykorzystujemy metodę create do utworzenia nowego obiektu z obrazem w formacie base64
          const recipeImage = await RecipeImage.create(
            database, 
            syncId, 
            image,
            syncStatusField,
            lastUpdate,
            isDeleted
          );
          console.log(`[RecipeImage] Utworzono nowy obraz dla syncId: ${syncId} przez upsert`);
          return recipeImage;
        } catch (createError) {
          console.error(`[RecipeImage] Błąd podczas tworzenia obrazu w upsert:`, createError);
          return null;
        }
      }
    } catch (error) {
      console.error(`[RecipeImage] Błąd podczas upsert obrazu:`, error);
      return null;
    }
  }

  // Metoda statyczna do aktualizacji obrazu przepisu
  static async update(
    database: Database,
    recipeImageId: string,
    image?: string | null,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: Date,
    isDeleted?: boolean
  ): Promise<RecipeImage | null> {
    try {
      const recipeImage = await database
        .get<RecipeImage>('recipe_images')
        .find(recipeImageId);
      
      if (!recipeImage) {
        console.log(`[DB ${this.table}] RecipeImage with id ${recipeImageId} not found`);
        return null;
      }
      
      console.log(`[DB ${this.table}] Updating recipe image ${recipeImageId} with provided fields`);
      
      // Use the update method directly from the model instance
      await recipeImage.update(record => {
        // Update only provided fields
        if (image !== undefined) record.image = image || undefined;
        
        // Update SyncModel fields if provided
        if (syncId !== undefined) record.syncId = syncId;
        if (syncStatusField !== undefined) record.syncStatusField = syncStatusField;
        if (lastUpdate !== undefined) record.lastUpdate = lastUpdate;
        if (isDeleted !== undefined) record.isDeleted = isDeleted;
      });
      
      console.log(`[DB ${this.table}] Successfully updated recipe image ${recipeImageId}`);
      return recipeImage;
    } catch (error) {
      console.error(`[DB ${this.table}] Error updating recipe image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Nadpisujemy metodę update, aby automatycznie przetwarzać obraz jeśli potrzeba
  async update(
    recordUpdater?: (record: this) => void
  ): Promise<this> {
    // Zapamiętaj aktualny obraz
    const originalImage = this.image;
    let currentImage = this.image;
    
    // Najpierw zastosuj standardowe aktualizacje w pamięci, żeby sprawdzić czy obraz się zmienia
    if (recordUpdater) {
      const tempRecord = { ...this, image: this.image } as this;
      recordUpdater(tempRecord);
      currentImage = tempRecord.image;
    }
    
    // Sprawdzamy, czy potrzebujemy przetwarzać obraz 
    // Jeśli image się zmienił i jest to base64 (a nie ścieżka)
    const needsImageProcessing = 
      this.syncId !== undefined && 
      currentImage !== undefined && 
      currentImage !== originalImage && 
      needsProcessing(currentImage, originalImage);
    
    // Jeśli potrzebujemy przetwarzać obraz, robimy to przed aktualizacją
    let newImagePath: string | undefined = undefined;
    let newThumbnailPath: string | undefined = undefined;
    
    if (needsImageProcessing && this.syncId && currentImage) {
      try {
        console.log(`[RecipeImage] Przetwarzanie obrazu podczas update: ${this.syncId}`);
        
        // Przetwórz obraz - otrzymujemy dane w base64
        const processedImages = await cropToSize(currentImage, this.syncId);
        
        if (processedImages.mainImage && processedImages.thumbnail) {
          // Generuj ścieżki do plików
          const { mainImagePath, thumbnailPath } = generateImagePaths(this.syncId);
          
          // Zapisz pliki
          const savedMainImage = await saveImageToFile(processedImages.mainImage, mainImagePath);
          const savedThumbnail = await saveImageToFile(processedImages.thumbnail, thumbnailPath);
          
          newImagePath = savedMainImage || undefined;
          newThumbnailPath = savedThumbnail || undefined;
          
          console.log(`[RecipeImage] Obraz przetworzony i zapisany podczas update dla: ${this.syncId}`);
        }
      } catch (error) {
        console.error(`[RecipeImage] Błąd podczas przetwarzania obrazu:`, error);
      }
    }
    
    // Wykonaj pojedynczą aktualizację z wszystkimi zmianami
    return await super.update(record => {
      // Najpierw zastosuj standardowe aktualizacje
      if (recordUpdater) {
        recordUpdater(record);
      }
      
      // Jeśli mamy przetworzone obrazy I nadal mamy ten sam obraz który przewarzaliśmy
      // (żeby nie nadpisać nowego obrazu ustawionego przez recordUpdater)
      if (newImagePath && newThumbnailPath && record.image === currentImage) {
        // Usuń stare pliki, jeśli istnieją i są różne od nowych
        if (originalImage && originalImage !== newImagePath && originalImage.startsWith('/')) {
          FileSystem.deleteAsync(originalImage, { idempotent: true })
            .catch(err => console.error(`[RecipeImage] Błąd usuwania pliku ${originalImage}:`, err));
        }
        
        if (this.thumbnail && this.thumbnail !== newThumbnailPath && this.thumbnail.startsWith('/')) {
          FileSystem.deleteAsync(this.thumbnail, { idempotent: true })
            .catch(err => console.error(`[RecipeImage] Błąd usuwania pliku ${this.thumbnail}:`, err));
        }
        
        // Zaktualizuj ścieżki do plików
        record.image = newImagePath;
        record.thumbnail = newThumbnailPath;
        console.log(`[RecipeImage] Ścieżki do plików zaktualizowane dla: ${this.syncId}`);
      }
    });
  }
  
  // Implementacja metody pre_pull_sync dla RecipeImage
  // Ta metoda jest wywoływana przed synchronizacją RecipeImage (gdyby model był synchronizowany)
  static async pre_pull_sync<T extends SyncModel>(
    database: Database,
    serverObject: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      // Pobierz syncId z obiektu servera
      const syncId = serverObject.sync_id;
      console.log(`[RecipeImage.pre_pull_sync] Wywołano dla syncId: ${syncId}`);
      
      // Wywołaj metodę do pobrania obrazu z API i zaktualizuj serverObject
      const updatedServerObject = await RecipeImage.retrieve_image_from_api(database, syncId, serverObject);
      
      console.log(`[RecipeImage.pre_pull_sync] Zaktualizowano dane obrazu dla syncId: ${syncId}`);
      
      // Zwróć zaktualizowany obiekt serwera
      return updatedServerObject;
    } catch (error) {
      console.error(`[RecipeImage.pre_pull_sync] Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // W przypadku błędu zwróć oryginalny obiekt
      return serverObject;
    }
  }
  
  // Metoda do pobierania obrazu z API na podstawie danych z serwera
  static async retrieve_image_from_api(
    database: Database,
    syncId: string,
    serverObject: Record<string, any> = {}
  ): Promise<Record<string, any>> {
    try {
      console.log(`[RecipeImage.retrieve_image_from_api] Wywołanie API dla syncId: ${syncId}`);
      
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
        // Zaktualizuj serverObject o dane base64
        const updatedServerObject = {
          ...serverObject,
          image: base64Image
        };
        
        console.log(`[RecipeImage.retrieve_image_from_api] Pobrano obraz dla syncId: ${syncId}`);
        return updatedServerObject;
      }
      
      // Jeśli nie udało się pobrać obrazu, zwróć oryginalny obiekt
      return serverObject;
    } catch (error) {
      console.error(`[RecipeImage.retrieve_image_from_api] Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return serverObject; // Zwróć oryginalny obiekt w przypadku błędu
    }
  }
}

export default RecipeImage; 