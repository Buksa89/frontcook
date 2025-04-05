import { text } from '@nozbe/watermelondb/decorators';
import SyncModel from './SyncModel';
import { needsProcessing, cropToSize } from '../../app/utils/imageProcessor';
import { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

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

  // Metoda statyczna do tworzenia lub aktualizacji obrazu przepisu
  // Przyjmuje syncId przepisu i obraz
  static async createOrUpdate(
    database: Database,
    syncId: string,
    image: string | null
  ): Promise<RecipeImage | null> {
    try {
      // Sprawdź, czy już istnieje RecipeImage dla tego syncId
      const existingRecipeImages = await database.get<RecipeImage>('recipe_images')
        .query(Q.where('sync_id', syncId))
        .fetch();
        
      let recipeImage: RecipeImage;
      
      if (existingRecipeImages.length > 0) {
        // Aktualizujemy istniejący RecipeImage
        recipeImage = existingRecipeImages[0];
        await recipeImage.update(record => {
          record.image = image || undefined;
          // Miniatura zostanie wygenerowana automatycznie w metodzie update
          // jeśli obraz się zmienił i wymaga przetworzenia
        });
        console.log(`[RecipeImage] Zaktualizowano obraz dla syncId: ${syncId}`);
      } else {
        // Tworzymy nowy RecipeImage
        recipeImage = await SyncModel.create.call(
          this as unknown as (new () => SyncModel) & typeof SyncModel,
          database,
          (record: SyncModel) => {
            const recipeImageRecord = record as RecipeImage;
            recipeImageRecord.image = image || undefined;
            recipeImageRecord.syncId = syncId;
            // Miniatura zostanie wygenerowana automatycznie w metodzie update
            // po utworzeniu rekordu
          }
        ) as RecipeImage;
        console.log(`[RecipeImage] Utworzono nowy obraz dla syncId: ${syncId}`);
      }
      
      return recipeImage;
    } catch (error) {
      console.error(`[RecipeImage] Błąd podczas tworzenia/aktualizacji obrazu:`, error);
      return null;
    }
  }

  // Nadpisujemy metodę update, aby automatycznie przetwarzać obraz jeśli potrzeba
  async update(recordUpdater?: (record: this) => void): Promise<this> {
    // Zapamiętaj aktualny obraz
    const originalImage = this.image;
    
    // Wywołaj oryginalną metodę update
    const result = await super.update(record => {
      // Zastosuj standardowe aktualizacje
      if (recordUpdater) {
        recordUpdater(record);
      }
    });

    // Sprawdź, czy obraz się zmienił i czy wymaga przetworzenia
    if (this.image && this.image !== originalImage && needsProcessing(this.image)) {
      try {
        console.log(`[RecipeImage] Przetwarzanie obrazu: ${this.image}, syncId: ${this.syncId}`);
        const processedImages = await cropToSize(this.image, this.syncId);
        
        if (processedImages.mainImage) {
          // Używamy database.write bezpośrednio, aby uniknąć nieskończonej rekurencji
          // przy wywoływaniu update
            await super.update(record => {
              record.image = processedImages.mainImage || undefined;
              record.thumbnail = processedImages.thumbnail || undefined;
              // Ustaw status synchronizacji na 'pending', ponieważ modyfikujemy rekord
              record.syncStatusField = 'pending';
              // Aktualizujemy lastUpdate ręcznie, ponieważ omijamy standardową ścieżkę update
              record.lastUpdate = new Date();
            });
          
          console.log(`[RecipeImage] Obraz przetworzony: ${processedImages.mainImage}, miniatura: ${processedImages.thumbnail}`);
        }
      } catch (error) {
        console.error(`[RecipeImage] Błąd podczas przetwarzania obrazu:`, error);
      }
    }

    return this;
  }
}

export default RecipeImage; 