// src/database/models/Recipe.ts

import { Model, Q } from '@nozbe/watermelondb';
import {
  associations, // Poprawny import
  children,
  date,
  field,
  immutableRelation,
  lazy,
  relation,
  text,
  writer,
} from '@nozbe/watermelondb/decorators';
import type { Query, Relation, Database, Collection, Associations } from '@nozbe/watermelondb'; // Poprawne importy typów
import { Observable, from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import type { RecipeTag } from './RecipeTag';
import type { Ingredient } from './Ingredient';
// Importuj Ingredient statycznie dla metody createIngredientsLocal
import IngredientModel from './Ingredient';
import type { RecipeImage } from './RecipeImage';
// Usunięto import Source
import type { Tag } from './Tag';
import AuthService from '../../app/services/auth/authService';

interface RecipeFormData {
  name: string;
  description?: string | null;
  prepTime?: string | null;
  totalTime?: string | null;
  servings?: string | null;
  ingredientsText: string;
  instructions: string;
  notes?: string | null;
  nutrition?: string | null;
  videoUrl?: string | null;
  sourceUrl?: string | null;
  // Usunięto sourceObjId
  selectedTags?: Tag[];
}

export class Recipe extends Model {
  static table = 'recipes'; // Standardowa definicja
  static associations: Associations = {
    // Usunięto recipe_sources
    recipe_tags_through: { type: 'has_many', foreignKey: 'recipe_id' },
    ingredients: { type: 'has_many', foreignKey: 'recipe_id' },
    recipe_images: { type: 'has_many', foreignKey: 'recipe_id' },
  };

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  // @date('created_at') createdAt!: number; // Opcjonalne
  @text('name') name!: string;
  @text('description') description?: string | null;
  @field('rating') rating!: number;
  @field('is_approved') isApproved!: boolean;
  @field('prep_time') prepTime?: number | null;
  @field('total_time') totalTime?: number | null;
  @field('servings') servings?: number | null;
  @text('instructions') instructions!: string; // Zmieniono na wymagane?
  @text('notes') notes?: string | null;
  @text('nutrition') nutrition?: string | null;
  @text('video_url') videoUrl?: string | null;
  @text('source_url') sourceUrl?: string | null;
  // Usunięto @field('source_obj_id') i @relation('recipe_sources', 'source_obj_id')

  // --- Relacje Children ---
  @lazy @children('recipe_tags_through') recipeTags!: Query<RecipeTag>;
  @lazy @children('ingredients') ingredients!: Query<Ingredient>;
  @lazy @children('recipe_images') images!: Query<RecipeImage>;

  // --- Metody Statyczne ---
  static observeAllApproved(database: Database): Observable<Recipe[]> {
      // Użyj getActiveUserId
      return from(AuthService.getActiveUserId()).pipe(
        switchMap(activeUserId => {
          if (!activeUserId) return of([]);
          return database.get<Recipe>(this.table)
            .query(Q.where('user_id', activeUserId), Q.where('is_approved', true))
            .observe();
        })
      );
  }

  static async saveRecipeFromFormData(
      database: Database,
      userId: string,
      data: RecipeFormData,
      recipeIdToUpdate?: string
    ): Promise<Recipe> {
        // ... (logika w środku pozostaje podobna, ale upewnij się, że:)
        // 1. Używa poprawnej nazwy tabeli dla tagów ('recipe_tags')
        // 2. Poprawnie importuje i wywołuje IngredientModel.createIngredientsFromText
        // 3. Nie odwołuje się do sourceObjId

        const recipesCollection = database.get<Recipe>(this.table);
        const tagsCollection = database.get<Tag>('recipe_tags'); // Poprawna nazwa tabeli tagów
        const recipeTagsCollection = database.get<RecipeTag>('recipe_tags_through');

        let recipe: Recipe;
        console.log(`[DB Recipe] Zapisywanie przepisu lokalnie: ${data.name}`);

        await database.write(async () => {
            if (recipeIdToUpdate) {
                // --- AKTUALIZACJA ---
                recipe = await recipesCollection.find(recipeIdToUpdate);
                await recipe.update(record => {
                  record.name = data.name;
                  record.instructions = data.instructions; // Zakładamy, że jest wymagane
                  record.description = data.description ?? null;
                  record.prepTime = data.prepTime ? parseInt(data.prepTime, 10) || null : null; // Użyj null
                  record.totalTime = data.totalTime ? parseInt(data.totalTime, 10) || null : null;
                  record.servings = data.servings ? parseInt(data.servings, 10) || 1 : 1; // Domyślnie 1
                  record.notes = data.notes ?? null;
                  record.nutrition = data.nutrition ?? null;
                  record.videoUrl = data.videoUrl ?? null;
                  record.sourceUrl = data.sourceUrl ?? null;
                  // Usunięto sourceObjId
                });

                // Aktualizacja Tagów (logika bez zmian, używa poprawnych nazw kolekcji)
                const existingRecipeTags = await recipe.recipeTags.fetch();
                const existingTagIds = existingRecipeTags.map(rt => rt.tagId);
                const selectedTagIds = data.selectedTags?.map(t => t.id) ?? [];
                const tagsToRemove = existingRecipeTags.filter(rt => !selectedTagIds.includes(rt.tagId));
                await database.batch(...tagsToRemove.map(rt => rt.prepareMarkAsDeleted())); // Użyj batch
                const tagsToAddIds = selectedTagIds.filter(id => !existingTagIds.includes(id));
                for (const tagId of tagsToAddIds) {
                    try {
                        await tagsCollection.find(tagId);
                        await recipeTagsCollection.create(rt => { rt.recipe.id = recipe.id; rt.tag.id = tagId; rt.userId = userId; });
                    } catch (tagFindError) { console.warn(`[DB Recipe] Tag ${tagId} not found. Skipping.`); }
                }

                // Aktualizacja Składników (logika bez zmian)
                const existingIngredients = await recipe.ingredients.fetch();
                await database.batch(...existingIngredients.map(ing => ing.prepareMarkAsDeleted())); // Użyj batch
                await IngredientModel.createIngredientsFromText(database, recipe.id, userId, data.ingredientsText);

            } else {
                // --- TWORZENIE NOWEGO ---
                recipe = await recipesCollection.create(record => {
                  record.userId = userId;
                  record.name = data.name;
                  record.instructions = data.instructions; // Wymagane?
                  record.description = data.description ?? null;
                  record.prepTime = data.prepTime ? parseInt(data.prepTime, 10) || null : null;
                  record.totalTime = data.totalTime ? parseInt(data.totalTime, 10) || null : null;
                  record.servings = data.servings ? parseInt(data.servings, 10) || 1 : 1;
                  record.notes = data.notes ?? null;
                  record.nutrition = data.nutrition ?? null;
                  record.videoUrl = data.videoUrl ?? null;
                  record.sourceUrl = data.sourceUrl ?? null;
                  // Usunięto sourceObjId
                  record.isApproved = false;
                  record.rating = 0;
                });

                // Dodawanie Tagów (logika bez zmian)
                if (data.selectedTags) {
                    for (const tag of data.selectedTags) {
                        try {
                            await tagsCollection.find(tag.id);
                            await recipeTagsCollection.create(rt => { rt.recipe.id = recipe.id; rt.tag.id = tag.id; rt.userId = userId; });
                        } catch (tagFindError) { console.warn(`[DB Recipe] Tag ${tag.id} not found. Skipping.`); }
                    }
                }
                // Dodawanie Składników (logika bez zmian)
                await IngredientModel.createIngredientsFromText(database, recipe.id, userId, data.ingredientsText);
            }
        });

        // @ts-ignore - recipe jest na pewno przypisane
        console.log(`[DB Recipe] Pomyślnie zapisano przepis lokalnie: ${recipe.id}`);
        // @ts-ignore
        return recipe;
  }

  // --- Metody Instancji ---
  @writer async markAsDeleted() {
      // ... (bez zmian w logice, używa poprawnych nazw relacji)
      console.log(`[DB Recipe] Oznaczanie przepisu ${this.id} i powiązań jako usunięte (lokalnie).`);
      const relatedRecipeTags = await this.recipeTags.fetch();
      const relatedIngredients = await this.ingredients.fetch();
      const relatedImages = await this.images.fetch();
      await this.database.batch( // Użyj batch dla wszystkich operacji usuwania
        ...relatedRecipeTags.map(rt => rt.prepareMarkAsDeleted()),
        ...relatedIngredients.map(ing => ing.prepareMarkAsDeleted()),
        ...relatedImages.map(img => img.prepareMarkAsDeleted()),
        this.prepareMarkAsDeleted() // Na końcu oznacz sam przepis
      );
      console.log(`[DB Recipe] Zakończono oznaczanie jako usunięte dla przepisu ${this.id}.`);
  }

  @writer async updateRating(newRating: number) {
      // ... (bez zmian w logice)
      await this.update(recipe => { recipe.rating = newRating; });
  }

  @writer async toggleApproval() {
      // ... (bez zmian w logice)
      const newState = !this.isApproved;
      await this.update(recipe => { recipe.isApproved = newState; });
  }

  async getPrimaryImage(): Promise<RecipeImage | null> {
      // ... (bez zmian w logice)
      const images = await this.images.query(Q.sortBy('order', Q.asc)).fetch(); // Dodano sortowanie
      return images.length > 0 ? images[0] : null;
  }
}

export default Recipe;