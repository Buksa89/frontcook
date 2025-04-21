// src/database/models/RecipeImageLocal.ts
import { Model } from '@nozbe/watermelondb';
import { field, text, immutableRelation, writer, date } from '@nozbe/watermelondb/decorators'; // Dodano writer, date dla potencjalnych przyszłych pól
import type { Relation, associations, Database, Model as WDBModel } from '@nozbe/watermelondb'; // Dodano Database, WDBModel
import type Recipe from './Recipe';
import { Q } from '@nozbe/watermelondb'; // Dodano Q

export default class RecipeImageLocal extends Model {
  static table = 'recipe_images_local';

  static associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' },
  } as const;

  // --- Pola ---
  // ID jest generowane automatycznie przez WatermelonDB (nie musi być UUID)
  @field('recipe_id') recipeId!: string; // Powiązanie z przepisem (UUID)
  @text('local_path') localPath?: string | null;
  @text('local_thumbnail_path') localThumbnailPath?: string | null;
  @text('original_remote_url') originalRemoteUrl?: string | null; // URL, z którego pobrano
  @field('last_processed_timestamp') lastProcessedTimestamp?: number | null; // Kiedy ostatnio przetworzono

  // --- Relacje ---
  @immutableRelation('recipes', 'recipe_id') recipe!: Relation<Recipe>;

  // --- Metody Statyczne ---

  /** Znajduje lub tworzy (przygotowuje) lokalny rekord obrazka dla przepisu */
  static async findOrCreatePrepare(database: Database, recipeId: string): Promise<RecipeImageLocal> {
      const collection = database.get<RecipeImageLocal>(this.table);
      const existing = await collection.query(Q.where('recipe_id', recipeId)).fetch();
      if (existing.length > 0) {
          return existing[0]; // Zwróć istniejący
      } else {
          // Przygotuj nowy, ID zostanie nadane automatycznie przez WDB
          return collection.prepareCreate(record => {
              record.recipeId = recipeId;
              record.localPath = null;
              record.localThumbnailPath = null;
              record.originalRemoteUrl = null;
              record.lastProcessedTimestamp = null;
          });
      }
  }

  // --- Metody Instancji ---

  /** Aktualizuje ścieżki i URL dla lokalnego obrazka */
  @writer async updatePaths(paths: { mainPath: string | null, thumbPath: string | null, remoteUrl: string | null }) {
    await this.update(record => {
        record.localPath = paths.mainPath;
        record.localThumbnailPath = paths.thumbPath;
        record.originalRemoteUrl = paths.remoteUrl;
        record.lastProcessedTimestamp = Date.now();
    });
  }

  /** Przygotowuje operację update dla batch */
  prepareUpdatePaths(paths: { mainPath: string | null, thumbPath: string | null, remoteUrl: string | null }): RecipeImageLocal {
     return this.prepareUpdate(record => {
        record.localPath = paths.mainPath;
        record.localThumbnailPath = paths.thumbPath;
        record.originalRemoteUrl = paths.remoteUrl;
        record.lastProcessedTimestamp = Date.now();
    });
  }

  /** Usuwa rekord lokalnego obrazka (nie pliki!) */
  @writer async deleteRecord() {
      // Ponieważ ten model nie jest synchronizowany, używamy destroyPermanently
      await this.destroyPermanently();
  }

   /** Przygotowuje operację trwałego usunięcia dla batch */
   prepareDeleteRecord(): RecipeImageLocal {
       return this.prepareDestroyPermanently();
   }
}