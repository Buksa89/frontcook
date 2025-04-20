// src/database/models/Recipe.ts
import { Model, Q } from '@nozbe/watermelondb';
import {
  associations, children, date, field, immutableRelation,
  lazy, relation, text, writer
} from '@nozbe/watermelondb/decorators';
import type { Query, Relation, Database, Collection, Model as WDBModel } from '@nozbe/watermelondb'; // Dodano WDBModel
import { Observable, from, of } from 'rxjs';
import { map, switchMap, distinctUntilChanged } from 'rxjs/operators'; // Dodano distinctUntilChanged

import type RecipeTag from './RecipeTag';
import type Ingredient from './Ingredient';
import IngredientModel from './Ingredient';
import type RecipeImageLocal from './RecipeImageLocal';
import type Tag from './Tag';
import { getCurrentUserId } from '../../services/auth/authUserIdProvider'; // ZMIANA IMPORTU
import { parseIngredient } from '../../utils/ingredientParser'; // Import parsera

// Interfejs dla danych formularza
interface RecipeFormData {
  name: string;
  description: string;
  prepTime: string;
  totalTime: string;
  servings: string;
  ingredients: string;
  instructions: string;
  notes: string;
  selectedTags: Tag[];
  nutrition?: string | null;
  video?: string | null;
  source?: string | null;
  image?: string | null;
}

export default class Recipe extends Model {
  static table = 'recipes';
  static associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'recipe_id' },
    ingredients: { type: 'has_many', foreignKey: 'recipe_id' },
  } as const;

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('name') name!: string;
  @text('description') description?: string | null;
  @field('rating') rating!: number;
  @field('is_approved') isApproved!: boolean;
  @field('prep_time') prepTime?: number | null;
  @field('total_time') totalTime?: number | null;
  @field('servings') servings?: number | null;
  @text('instructions') instructions!: string;
  @text('notes') notes?: string | null;
  @text('nutrition') nutrition?: string | null;
  @text('video') video?: string | null;
  @text('source') source?: string | null;
  @text('image_url') imageUrl?: string | null;

  // --- Relacje Children ---
  @lazy @children('recipe_tags') recipeTags!: Query<RecipeTag>;
  @lazy @children('ingredients') ingredients!: Query<Ingredient>;

  // --- Metody Statyczne ---

  static observeAllApproved(database: Database): Observable<Recipe[]> {
    // Używamy nowej funkcji
    return from(getCurrentUserId()).pipe( // ZMIANA WYWOŁANIA
      switchMap(activeUserId => {
        if (!activeUserId) return of([]);
        return database.get<Recipe>(this.table)
          .query(Q.where('user_id', activeUserId), Q.where('is_approved', true))
          .observe();
      })
    );
  }

   static observeAllPending(database: Database): Observable<Recipe[]> {
    // Używamy nowej funkcji
     return from(getCurrentUserId()).pipe( // ZMIANA WYWOŁANIA
       switchMap(activeUserId => {
         if (!activeUserId) return of([]);
         return database.get<Recipe>(this.table)
           .query(Q.where('user_id', activeUserId), Q.where('is_approved', false))
           .observe();
       })
     );
   }

  static async upsertFromFormData(
    database: Database,
    userId: string,
    data: RecipeFormData,
    recipeIdToUpdate?: string
  ): Promise<Recipe> {
    // Logika bez zmian
      const recipesCollection = database.get<Recipe>(this.table);
      const tagsCollection = database.get<Tag>('tags');
      const recipeTagsCollection = database.get<RecipeTag>('recipe_tags');
      let recipe: Recipe;
      const isUpdate = !!recipeIdToUpdate;
      console.log(`[DB Recipe] Zapisywanie przepisu (Update: ${isUpdate}): ${data.name}`);
      await database.write(async (writer) => {
        if (isUpdate) {
          recipe = await recipesCollection.find(recipeIdToUpdate);
          await recipe.update(record => { /* ... aktualizacja pól ... */
            record.name = data.name.trim(); record.instructions = data.instructions.trim();
            record.description = data.description?.trim() ?? null; record.prepTime = data.prepTime ? parseInt(data.prepTime, 10) || null : null;
            record.totalTime = data.totalTime ? parseInt(data.totalTime, 10) || null : null; record.servings = data.servings ? parseInt(data.servings, 10) || 1 : 1;
            record.notes = data.notes?.trim() ?? null; record.nutrition = data.nutrition?.trim() ?? null;
            record.video = data.video?.trim() ?? null; record.source = data.source?.trim() ?? null;
          });
          const existingRecipeTags = await recipe.recipeTags.fetch();
          const existingTagIds = new Set(existingRecipeTags.map(rt => rt.tagId));
          const selectedTagIds = new Set(data.selectedTags?.map(t => t.id) ?? []);
          const tagsToRemove = existingRecipeTags.filter(rt => !selectedTagIds.has(rt.tagId));
          const tagsToAddIds = [...selectedTagIds].filter(id => !existingTagIds.has(id));
          const batchOps: WDBModel[] = tagsToRemove.map(rt => rt.prepareMarkAsDeleted()); // Poprawiony typ
          for (const tagId of tagsToAddIds) {
            try { await tagsCollection.find(tagId); batchOps.push(recipeTagsCollection.prepareCreate(rt => { rt.recipe.id = recipe.id; rt.tag.id = tagId; rt.userId = userId; })); }
            catch (tagFindError) { console.warn(`[DB Recipe] Tag ${tagId} nie znaleziony przy aktualizacji. Pomijanie.`); }
          }
          const existingIngredients = await recipe.ingredients.fetch();
          existingIngredients.forEach(ing => batchOps.push(ing.prepareMarkAsDeleted()));
          const newIngredientOps = await IngredientModel.createIngredientsFromTextPrepare(database, recipe.id, userId, data.ingredients);
          batchOps.push(...newIngredientOps);
          if (batchOps.length > 0) { await writer.batch(...batchOps); }
        } else {
          recipe = await recipesCollection.create(record => { /* ... tworzenie pól ... */
            record.userId = userId; record.name = data.name.trim(); record.instructions = data.instructions.trim();
            record.description = data.description?.trim() ?? null; record.prepTime = data.prepTime ? parseInt(data.prepTime, 10) || null : null;
            record.totalTime = data.totalTime ? parseInt(data.totalTime, 10) || null : null; record.servings = data.servings ? parseInt(data.servings, 10) || 1 : 1;
            record.notes = data.notes?.trim() ?? null; record.nutrition = data.nutrition?.trim() ?? null;
            record.video = data.video?.trim() ?? null; record.source = data.source?.trim() ?? null;
            record.isApproved = false; record.rating = 0; record.imageUrl = null;
          });
          const batchOps: WDBModel[] = []; // Poprawiony typ
          if (data.selectedTags) {
            for (const tag of data.selectedTags) {
               try { await tagsCollection.find(tag.id); batchOps.push(recipeTagsCollection.prepareCreate(rt => { rt.recipe.id = recipe.id; rt.tag.id = tag.id; rt.userId = userId; })); }
               catch (tagFindError) { console.warn(`[DB Recipe] Tag ${tag.id} nie znaleziony przy tworzeniu. Pomijanie.`); }
            }
          }
          const newIngredientOps = await IngredientModel.createIngredientsFromTextPrepare(database, recipe.id, userId, data.ingredients);
          batchOps.push(...newIngredientOps);
          if (batchOps.length > 0) { await writer.batch(...batchOps); }
        }
      });
      // @ts-ignore
      console.log(`[DB Recipe] Pomyślnie ${isUpdate ? 'zaktualizowano' : 'utworzono'} przepis lokalnie: ${recipe.id}`);
      // @ts-ignore
      return recipe;
  }

  // --- Metody Instancji ---
  @writer async markAsDeletedCascade() {
    // Logika bez zmian
      console.log(`[DB Recipe] Rozpoczynanie usuwania kaskadowego dla przepisu ${this.id} ('${this.name}').`);
      const batchOperations: WDBModel[] = []; // Poprawiony typ
      const relatedRecipeTags = await this.recipeTags.fetch();
      const relatedIngredients = await this.ingredients.fetch();
      const relatedLocalImages = await this.database.get<RecipeImageLocal>('recipe_images_local').query(Q.where('recipe_id', this.id)).fetch();
      relatedRecipeTags.forEach(rt => batchOperations.push(rt.prepareMarkAsDeleted()));
      relatedIngredients.forEach(ing => batchOperations.push(ing.prepareMarkAsDeleted()));
      relatedLocalImages.forEach(img => batchOperations.push(img.prepareDestroyPermanently()));
      batchOperations.push(this.prepareMarkAsDeleted());
      await this.database.batch(...batchOperations);
      for (const img of relatedLocalImages) { /* TODO: FileSystem delete */ }
      console.log(`[DB Recipe] Zakończono usuwanie kaskadowe dla przepisu ${this.id}.`);
  }

  @writer async updateRating(newRating: number) {
    // Logika bez zmian
      if (this.rating !== newRating && newRating >= 0 && newRating <= 5) {
          await this.update(recipe => { recipe.rating = newRating; });
          console.log(`[DB Recipe] Zaktualizowano ocenę dla ${this.id} na ${newRating}.`);
      }
  }

  @writer async toggleApproval() {
    // Logika bez zmian
      const newState = !this.isApproved;
      await this.update(recipe => { recipe.isApproved = newState; });
      console.log(`[DB Recipe] Zmieniono status zatwierdzenia dla ${this.id} na ${newState}.`);
  }

  async getLocalThumbnailPath(): Promise<string | null> {
    // Logika bez zmian
      try {
        const localImage = await this.database.get<RecipeImageLocal>('recipe_images_local').query(Q.where('recipe_id', this.id), Q.take(1)).fetch();
        return localImage.length > 0 ? (localImage[0].localThumbnailPath ?? null) : null;
      } catch (error) { console.error(`[DB Recipe] Błąd pobierania ścieżki miniaturki dla ${this.id}:`, error); return null; }
  }

   observeLocalThumbnailPath(): Observable<string | null> {
    // Logika bez zmian
       return this.database.get<RecipeImageLocal>('recipe_images_local')
           .query(Q.where('recipe_id', this.id), Q.take(1)).observe()
           .pipe( map(results => results.length > 0 ? (results[0].localThumbnailPath ?? null) : null), distinctUntilChanged() );
   }

  // --- Przygotowanie do batch ---
   prepareMarkAsDeletedCascade(): WDBModel[] { // Poprawiony typ
       console.warn("prepareMarkAsDeletedCascade nie jest zaimplementowane dla batch - użyj pełnej metody markAsDeletedCascade w transakcji.");
       return [];
   }
   prepareUpdateRating(newRating: number): Recipe | null {
    // Logika bez zmian
       if (this.rating === newRating || newRating < 0 || newRating > 5) return null;
       return this.prepareUpdate(recipe => { recipe.rating = newRating; });
   }
   prepareToggleApproval(): Recipe {
    // Logika bez zmian
       return this.prepareUpdate(recipe => { recipe.isApproved = !recipe.isApproved; });
   }
}

// Mergowanie deklaracji dla IngredientModel (bez zmian)
declare module './Ingredient' {
    interface Ingredient {}
    interface IngredientModelStatic {
         createIngredientsFromTextPrepare(database: Database, recipeId: string, userId: string, ingredientsText: string): Promise<Ingredient[]>;
    }
}
IngredientModel.createIngredientsFromTextPrepare = async function( database: Database, recipeId: string, userId: string, ingredientsText: string ): Promise<Ingredient[]> {
    // Logika bez zmian
    const ingredientLines = ingredientsText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (ingredientLines.length === 0) return [];
    const ingredientsCollection = database.get<Ingredient>(IngredientModel.table);
    const newIngredientsBatch: Ingredient[] = [];
    for (let i = 0; i < ingredientLines.length; i++) {
      const line = ingredientLines[i]; const parsed = parseIngredient(line);
      newIngredientsBatch.push( ingredientsCollection.prepareCreate(ingredient => {
          ingredient.recipeId = recipeId; ingredient.userId = userId; ingredient.name = parsed.name || line;
          ingredient.amount = parsed.amount !== null && !isNaN(parsed.amount) ? String(parsed.amount) : null;
          ingredient.unit = parsed.unit ?? null; ingredient.order = i + 1; ingredient.originalStr = line;
        }) );
    } return newIngredientsBatch;
};