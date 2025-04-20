// src/database/models/RecipeTag.ts

import { Model, Q } from '@nozbe/watermelondb'; // Dodano Q
import {
  field,
  date,
  relation,
  immutableRelation,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Database, Relation, Collection } from '@nozbe/watermelondb'; // Dodano Collection
import type { Associations } from '@nozbe/watermelondb/Model';
import type Recipe from './Recipe';
import type Tag from './Tag';

// --- NOWA IMPLEMENTACJA ---

export class RecipeTag extends Model {
  static table = 'recipe_tags_through'; // Standardowa definicja
  static associations: Associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' },
    recipe_tags: { type: 'belongs_to', key: 'tag_id' },
  };

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  // @date('created_at') createdAt!: number; // Opcjonalne
  @field('recipe_id') recipeId!: string;
  @field('tag_id') tagId!: string;

  @immutableRelation('recipes', 'recipe_id') recipe!: Relation<Recipe>;
  @immutableRelation('recipe_tags', 'tag_id') tag!: Relation<Tag>;

  // --- Metody Instancji ---
  @writer async deleteLink() {
      // ... (bez zmian)
      console.log(`[DB RecipeTag] Oznaczanie powiązania ${this.id} (Recipe: ${this.recipeId}, Tag: ${this.tagId}) jako usunięte (lokalnie).`);
      await this.markAsDeleted();
  }

  // --- Metody Statyczne ---
  static async createLink(database: Database, userId: string, recipeId: string, tagId: string): Promise<RecipeTag> {
      // ... (bez zmian)
      const collection = database.get<RecipeTag>(this.table);
      const existing = await collection.query(
          Q.where('recipe_id', recipeId), Q.where('tag_id', tagId), Q.where('user_id', userId)
      ).fetch();
      if (existing.length > 0) {
          console.warn(`[DB RecipeTag] Powiązanie Recipe ${recipeId} - Tag ${tagId} już istnieje.`);
          return existing[0];
      }
      const newLink = await database.write(async () => {
          return await collection.create(link => { link.userId = userId; link.recipeId = recipeId; link.tagId = tagId; });
      });
      console.log(`[DB RecipeTag] Utworzono nowe powiązanie lokalnie: ${newLink.id}`);
      return newLink;
  }

   // --- Przygotowanie do batch (dodane) ---
   prepareDeleteLink(): RecipeTag {
       return this.prepareMarkAsDeleted();
   }
}

export default RecipeTag;