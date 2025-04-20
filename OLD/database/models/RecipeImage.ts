// src/database/models/RecipeImage.ts

import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  immutableRelation,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Database, Relation, Collection } from '@nozbe/watermelondb'; // Dodano Collection
import type Recipe from './Recipe';
import type { Observable } from 'rxjs'; // Dodano Observable
// Usunięto AuthService, bo nie jest używany w metodach statycznych

// --- NOWA IMPLEMENTACJA ---

export class RecipeImage extends Model {
  static table = 'recipe_images'; // Standardowa definicja
  static associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' },
  } as const;

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  // @date('created_at') createdAt!: number; // Opcjonalne
  @field('recipe_id') recipeId!: string;
  @text('image_url') imageUrl?: string | null; // URL zamiast ścieżki
  // @text('thumbnail_url') thumbnailUrl?: string | null; // Opcjonalnie
  @field('order') order!: number;

  @immutableRelation('recipes', 'recipe_id') recipe!: Relation<Recipe>;

  // --- Metody Instancji ---
  getImageUrl(): string | null | undefined {
    return this.imageUrl;
  }
  // getThumbnailUrl(): string | null | undefined { return this.thumbnailUrl; }

  @writer async updateOrder(newOrder: number) {
    // ... (bez zmian)
    await this.update(img => { img.order = newOrder; });
  }

  @writer async deleteImage() {
    // ... (bez zmian)
    console.log(`[DB RecipeImage] Oznaczanie obrazka ${this.id} jako usunięte (lokalnie).`);
    await this.markAsDeleted();
  }

  // --- Metody Statyczne ---
  static observeForRecipe(database: Database, recipeId: string): Observable<RecipeImage[]> {
    // ... (bez zmian)
    return database
        .get<RecipeImage>(this.table)
        .query(Q.where('recipe_id', recipeId), Q.sortBy('order', Q.asc))
        .observe();
  }

   // --- Przygotowanie do batch (dodane) ---
   prepareUpdateOrder(newOrder: number): RecipeImage {
      return this.prepareUpdate(img => {
         img.order = newOrder;
      });
   }

   prepareDeleteImage(): RecipeImage {
       return this.prepareMarkAsDeleted();
   }

}

export default RecipeImage;