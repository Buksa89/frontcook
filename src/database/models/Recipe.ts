// src/database/models/Recipe.ts
import { Model, Q } from '@nozbe/watermelondb';
import {
  associations, children, date, field, immutableRelation,
  lazy, relation, text, writer
} from '@nozbe/watermelondb/decorators';
import type { Query, Relation, Database, Collection, Model as WDBModel } from '@nozbe/watermelondb';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, distinctUntilChanged } from 'rxjs/operators';

import type RecipeTag from './RecipeTag';
import type Ingredient from './Ingredient';
import IngredientModel from './Ingredient'; // Użyjemy też do operacji prepare
import type RecipeImageLocal from './RecipeImageLocal';
import type Tag from './Tag';
import { getCurrentUserId } from '../../services/auth/authUserIdProvider';
import { parseIngredient } from '../../utils/ingredientParser';
// --- DODAJ IMPORT UUID ---
import { v4 as uuidv4 } from 'uuid';
// -----------------------

// Interfejs dla danych formularza
interface RecipeFormData {
  name: string;
  description: string;
  prepTime: string; // Przyjmujemy string z formularza
  totalTime: string; // Przyjmujemy string z formularza
  servings: string; // Przyjmujemy string z formularza
  ingredients: string; // Blok tekstu ze składnikami
  instructions: string;
  notes: string;
  selectedTags: Tag[]; // Tablica wybranych modeli Tag
  nutrition?: string | null;
  video?: string | null;
  source?: string | null;
  // image?: string | null; // Zarządzanie obrazkami odbywa się oddzielnie
}

export default class Recipe extends Model {
  static table = 'recipes';
  static associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'recipe_id' }, // Zmieniono na recipe_tags
    ingredients: { type: 'has_many', foreignKey: 'recipe_id' },
  } as const;

  // --- Pola ---
  @field('user_id') userId!: string | null; // Oczekuje string | null
  @date('last_modified') lastModified!: number; // Oczekuje number (timestamp)
  @date('created_at') createdAt!: number;     // Oczekuje number (timestamp)
  @text('name') name!: string;
  @text('description') description?: string | null;
  @field('rating') rating!: number; // Zakładamy, że zawsze jest (domyślnie 0)
  @field('is_approved') isApproved!: boolean; // Zakładamy, że zawsze jest (domyślnie false?)
  @field('prep_time') prepTime?: number | null; // Przechowujemy jako number
  @field('total_time') totalTime?: number | null; // Przechowujemy jako number
  @field('servings') servings?: number | null; // Przechowujemy jako number
  @text('instructions') instructions!: string;
  @text('notes') notes?: string | null;
  @text('nutrition') nutrition?: string | null;
  @text('video') video?: string | null;
  @text('source') source?: string | null;
  @text('image_url') imageUrl?: string | null; // URL obrazka z serwera

  // --- Relacje Children ---
  @lazy @children('recipe_tags') recipeTags!: Query<RecipeTag>; // Zmieniono na recipe_tags
  @lazy @children('ingredients') ingredients!: Query<Ingredient>;

  // --- Metody Statyczne ---

  static observeAllApproved(database: Database): Observable<Recipe[]> {
    return from(getCurrentUserId()).pipe(
      switchMap(activeUserId => {
        const userClause = activeUserId === null ? Q.where('user_id', null) : Q.where('user_id', activeUserId);
        return database.get<Recipe>(this.table)
          .query(userClause, Q.where('is_approved', true))
          .observe();
      })
    );
  }

   static observeAllPending(database: Database): Observable<Recipe[]> {
     return from(getCurrentUserId()).pipe(
       switchMap(activeUserId => {
         const userClause = activeUserId === null ? Q.where('user_id', null) : Q.where('user_id', activeUserId);
         return database.get<Recipe>(this.table)
           .query(userClause, Q.where('is_approved', false))
           .observe();
       })
     );
   }

   // Funkcja pomocnicza do parsowania stringów na number | null
   private static parseOptionalInt(value: string): number | null {
       const parsed = parseInt(value, 10);
       return !isNaN(parsed) && parsed >= 0 ? parsed : null;
   }
   private static parseServings(value: string): number | null {
        const parsed = parseInt(value, 10);
        return !isNaN(parsed) && parsed > 0 ? parsed : 1; // Domyślnie 1 porcja
    }

  /**
   * Tworzy lub aktualizuje przepis na podstawie danych z formularza.
   * Generuje UUID dla nowych przepisów.
   */
  static async upsertFromFormData(
    database: Database,
    userId: string | null, // Akceptuje string | null
    data: RecipeFormData,
    recipeIdToUpdate?: string // UUID istniejącego przepisu do aktualizacji
  ): Promise<Recipe> {
      const recipesCollection = database.get<Recipe>(this.table);
      const tagsCollection = database.get<Tag>('tags');
      const recipeTagsCollection = database.get<RecipeTag>('recipe_tags'); // Poprawna nazwa tabeli M2M
      const ingredientsCollection = database.get<Ingredient>('ingredients'); // Dodano dla prepareCreate

      let recipe: Recipe;
      const isUpdate = !!recipeIdToUpdate;
      console.log(`[DB Recipe] Zapisywanie przepisu (Update: ${isUpdate}): ${data.name}`);

      // Przygotuj dane do zapisu (parsowanie itp.)
      const recipeData = {
          name: data.name.trim(),
          instructions: data.instructions.trim(),
          description: data.description?.trim() || null, // Użyj || null dla pewności
          prepTime: this.parseOptionalInt(data.prepTime),
          totalTime: this.parseOptionalInt(data.totalTime),
          servings: this.parseServings(data.servings),
          notes: data.notes?.trim() || null,
          nutrition: data.nutrition?.trim() || null,
          video: data.video?.trim() || null,
          source: data.source?.trim() || null,
          // isApproved i rating nie są modyfikowane tutaj, zarządzane przez inne metody
          // imageUrl też nie jest tu ustawiane
      };

      await database.write(async (writer) => {
        const batchOps: WDBModel[] = []; // Tablica na operacje batch

        if (isUpdate) {
          // --- AKTUALIZACJA ---
          if (!recipeIdToUpdate) throw new Error("Brak ID przepisu do aktualizacji");
          try {
                recipe = await recipesCollection.find(recipeIdToUpdate);
          } catch (findError) {
               console.error(`[DB Recipe Upsert] Nie znaleziono przepisu o ID ${recipeIdToUpdate} do aktualizacji.`);
               throw new Error(`Nie znaleziono przepisu do aktualizacji.`);
          }

          // Przygotuj aktualizację pól przepisu
          batchOps.push(recipe.prepareUpdate(record => {
            Object.assign(record, recipeData);
          }));

          // Zarządzanie tagami
          const existingRecipeTags = await recipe.recipeTags.fetch();
          const existingTagIds = new Set(existingRecipeTags.map(rt => rt.tagId));
          const selectedTagIds = new Set(data.selectedTags?.map(t => t.id) ?? []);

          // Przygotuj usunięcie niepotrzebnych powiązań
          existingRecipeTags.forEach(rt => {
            if (!selectedTagIds.has(rt.tagId)) {
              batchOps.push(rt.prepareMarkAsDeleted());
            }
          });

          // Przygotuj dodanie nowych powiązań
          for (const tagId of selectedTagIds) {
            if (!existingTagIds.has(tagId)) {
              try {
                await tagsCollection.find(tagId); // Sprawdź czy tag istnieje
                batchOps.push(recipeTagsCollection.prepareCreate(rt => {
                  rt.recipe.id = recipe.id; // Powiązanie z aktualizowanym przepisem
                  rt.tag.id = tagId;
                  rt.userId = userId; // Przypisz userId
                }));
              } catch (tagFindError) {
                console.warn(`[DB Recipe Upsert] Tag ${tagId} nie znaleziony przy aktualizacji. Pomijanie.`);
              }
            }
          }

          // Zarządzanie składnikami (usuń stare, dodaj nowe)
          const existingIngredients = await recipe.ingredients.fetch();
          existingIngredients.forEach(ing => batchOps.push(ing.prepareMarkAsDeleted()));

          const newIngredientOps = await IngredientModel.createIngredientsFromTextPrepare(database, recipe.id, userId, data.ingredients);
          batchOps.push(...newIngredientOps);

        } else {
          // --- TWORZENIE ---
          // --- GENERUJ UUID ---
          const newRecipeId = uuidv4();
          // --------------------

          // Przygotuj utworzenie przepisu
          recipe = recipesCollection.prepareCreate(record => {
            // --- PRZYPISZ UUID ---
            record._raw.id = newRecipeId;
            // -------------------
            record.userId = userId;
            Object.assign(record, recipeData); // Przypisz sparsowane dane
            // Ustaw wartości domyślne dla nowych przepisów
            record.isApproved = false;
            record.rating = 0;
            record.imageUrl = null;
          });
          batchOps.push(recipe); // Dodaj operację tworzenia przepisu do batcha

          // Przygotuj utworzenie powiązań tagów
          if (data.selectedTags) {
            for (const tag of data.selectedTags) {
              try {
                await tagsCollection.find(tag.id); // Sprawdź czy tag istnieje
                batchOps.push(recipeTagsCollection.prepareCreate(rt => {
                  rt.recipe.id = newRecipeId; // Powiązanie z nowym przepisem
                  rt.tag.id = tag.id;
                  rt.userId = userId; // Przypisz userId
                }));
              } catch (tagFindError) {
                console.warn(`[DB Recipe Upsert] Tag ${tag.id} nie znaleziony przy tworzeniu. Pomijanie.`);
              }
            }
          }

          // Przygotuj utworzenie składników
          const newIngredientOps = await IngredientModel.createIngredientsFromTextPrepare(database, newRecipeId, userId, data.ingredients);
          batchOps.push(...newIngredientOps);
        }

        // Wykonaj wszystkie operacje w jednej transakcji
        if (batchOps.length > 0) {
          await writer.batch(...batchOps);
        }
      }); // Koniec database.write

      // Po transakcji, obiekt 'recipe' z 'prepareCreate' nie jest "żywy".
      // Musimy go pobrać ponownie, jeśli chcemy zwrócić aktualny model.
      // Dla uproszczenia, jeśli tworzyliśmy, pobierzmy go po ID.
      let finalRecipe: Recipe;
      if (!isUpdate && recipe) { // recipe będzie z prepareCreate
        try {
            finalRecipe = await recipesCollection.find(recipe.id); // Znajdź po ID
        } catch (findError) {
             console.error(`[DB Recipe Upsert] Nie można pobrać nowo utworzonego przepisu ${recipe.id}`);
             throw new Error("Nie udało się pobrać utworzonego przepisu.");
        }
      } else {
         // @ts-ignore - Jeśli to była aktualizacja, 'recipe' już jest 'żywym' modelem
         finalRecipe = recipe;
      }

      console.log(`[DB Recipe] Pomyślnie ${isUpdate ? 'zaktualizowano' : 'utworzono'} przepis lokalnie: ${finalRecipe.id}`);
      return finalRecipe; // Zwróć "żywy" model
  }


  // --- Metody Instancji ---
  @writer async markAsDeletedCascade() {
      console.log(`[DB Recipe] Rozpoczynanie usuwania kaskadowego dla przepisu ${this.id} ('${this.name}').`);
      const batchOperations: WDBModel[] = [];

      // Pobierz powiązane rekordy
      const relatedRecipeTags = await this.recipeTags.fetch();
      const relatedIngredients = await this.ingredients.fetch();
      const relatedLocalImages = await this.database.get<RecipeImageLocal>('recipe_images_local').query(Q.where('recipe_id', this.id)).fetch();

      // Przygotuj operacje usunięcia/oznaczenia
      relatedRecipeTags.forEach(rt => batchOperations.push(rt.prepareMarkAsDeleted()));
      relatedIngredients.forEach(ing => batchOperations.push(ing.prepareMarkAsDeleted()));
      // Obrazki lokalne usuwamy trwale, bo nie są synchronizowane
      relatedLocalImages.forEach(img => batchOperations.push(img.prepareDestroyPermanently()));
      // Na koniec oznacz sam przepis do usunięcia
      batchOperations.push(this.prepareMarkAsDeleted());

      // Wykonaj batch
      await this.database.batch(...batchOperations);

      // TODO: Fizyczne usunięcie plików obrazków (poza transakcją DB)
      // await Promise.all(relatedLocalImages.map(img => safeDeleteFile(img.localPath)));
      // await Promise.all(relatedLocalImages.map(img => safeDeleteFile(img.localThumbnailPath)));

      console.log(`[DB Recipe] Zakończono usuwanie kaskadowe dla przepisu ${this.id}.`);
  }

  @writer async updateRating(newRating: number) {
      // Prosta walidacja oceny
      const clampedRating = Math.max(0, Math.min(5, Math.round(newRating))); // Zaokrąglij i ogranicz 0-5
      if (this.rating !== clampedRating) {
          await this.update(recipe => { recipe.rating = clampedRating; });
          console.log(`[DB Recipe] Zaktualizowano ocenę dla ${this.id} na ${clampedRating}.`);
      }
  }

  @writer async toggleApproval() {
      const newState = !this.isApproved;
      await this.update(recipe => { recipe.isApproved = newState; });
      console.log(`[DB Recipe] Zmieniono status zatwierdzenia dla ${this.id} na ${newState}.`);
  }

  async getLocalThumbnailPath(): Promise<string | null> {
      try {
        const localImage = await this.database.get<RecipeImageLocal>('recipe_images_local')
                                            .query(Q.where('recipe_id', this.id), Q.take(1)).fetch();
        return localImage.length > 0 ? (localImage[0].localThumbnailPath ?? null) : null;
      } catch (error) {
          console.error(`[DB Recipe] Błąd pobierania ścieżki miniaturki dla ${this.id}:`, error);
          return null;
      }
  }

   observeLocalThumbnailPath(): Observable<string | null> {
       return this.database.get<RecipeImageLocal>('recipe_images_local')
           .query(Q.where('recipe_id', this.id), Q.take(1)).observe()
           .pipe(
               map(results => results.length > 0 ? (results[0].localThumbnailPath ?? null) : null),
               distinctUntilChanged() // Emituj tylko przy zmianie ścieżki
           );
   }

  // --- Przygotowanie do batch ---
   prepareMarkAsDeletedCascade(): WDBModel[] {
       console.warn("prepareMarkAsDeletedCascade nie jest w pełni zaimplementowane dla batch - użyj pełnej metody markAsDeletedCascade w transakcji, aby usunąć też pliki obrazków.");
       // Zwróci tylko operacje na bazie, bez usuwania plików
       const batchOperations: WDBModel[] = [];
       // Można by tu dodać logikę pobierania powiązań, ale bez await, co jest trudne
       batchOperations.push(this.prepareMarkAsDeleted());
       return batchOperations; // Zwraca tylko operację na samym przepisie!
   }
   prepareUpdateRating(newRating: number): Recipe | null {
       const clampedRating = Math.max(0, Math.min(5, Math.round(newRating)));
       if (this.rating === clampedRating) return null;
       return this.prepareUpdate(recipe => { recipe.rating = clampedRating; });
   }
   prepareToggleApproval(): Recipe {
       return this.prepareUpdate(recipe => { recipe.isApproved = !recipe.isApproved; });
   }
}

// Rozszerzenie modułu Ingredient dla metody prepare (bez zmian)
declare module './Ingredient' {
    interface Ingredient {}
    interface IngredientModelStatic {
         createIngredientsFromTextPrepare(database: Database, recipeId: string, userId: string | null, ingredientsText: string): Promise<Ingredient[]>;
    }
}
// Implementacja metody prepare (bez zmian - już używa UUID)
IngredientModel.createIngredientsFromTextPrepare = async function( database: Database, recipeId: string, userId: string | null, ingredientsText: string ): Promise<Ingredient[]> {
    const ingredientLines = ingredientsText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (ingredientLines.length === 0) return [];
    const ingredientsCollection = database.get<Ingredient>(IngredientModel.table);
    const newIngredientsBatch: Ingredient[] = [];
    for (let i = 0; i < ingredientLines.length; i++) {
      const line = ingredientLines[i]; const parsed = parseIngredient(line);
      const newId = uuidv4(); // Generuj UUID
      newIngredientsBatch.push( ingredientsCollection.prepareCreate(ingredient => {
          ingredient._raw.id = newId; // Przypisz UUID
          ingredient.recipeId = recipeId; ingredient.userId = userId; ingredient.name = parsed.name || line;
          ingredient.amount = parsed.amount !== null && !isNaN(parsed.amount) ? String(parsed.amount) : null;
          ingredient.unit = parsed.unit ?? null; ingredient.order = i + 1; ingredient.originalStr = line;
        }) );
    } return newIngredientsBatch;
};