import { Model, Q } from '@nozbe/watermelondb';
import {
  associations, children, date, field, immutableRelation,
  lazy, relation, text, writer
} from '@nozbe/watermelondb/decorators';
import type { Query, Relation, Database, Collection, Associations } from '@nozbe/watermelondb';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import type RecipeTag from './RecipeTag';
import type Ingredient from './Ingredient';
import IngredientModel from './Ingredient'; // Pełna klasa do metod statycznych
import type RecipeImageLocal from './RecipeImageLocal'; // Lokalny model obrazka
import type Tag from './Tag';
import AuthService from '../../services/auth/authService';

// Interfejs dla danych formularza (można przenieść do types)
interface RecipeFormData {
  name: string;
  description: string;
  prepTime: string;
  totalTime: string;
  servings: string;
  ingredients: string; // Zmieniono z ingredientsText dla spójności
  instructions: string;
  notes: string;
  selectedTags: Tag[]; // Przyjmuje obiekty Tag
  nutrition?: string | null;
  video?: string | null; // Zgodnie ze schematem
  source?: string | null; // Zgodnie ze schematem
  image?: string | null; // Ścieżka do LOKALNEGO pliku tymczasowego z ImagePicker
}


export default class Recipe extends Model {
  static table = 'recipes';
  static associations: Associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'recipe_id' },
    ingredients: { type: 'has_many', foreignKey: 'recipe_id' },
    // Brak bezpośredniej relacji WDB do RecipeImageLocal
  };

  // --- Pola (zgodne ze schematem) ---
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

  /** Obserwuje wszystkie ZATWIERDZONE przepisy dla zalogowanego użytkownika. */
  static observeAllApproved(database: Database): Observable<Recipe[]> {
    return from(AuthService.getActiveUserId()).pipe(
      switchMap(activeUserId => {
        if (!activeUserId) return of([]);
        return database.get<Recipe>(this.table)
          .query(
              Q.where('user_id', activeUserId),
              Q.where('is_approved', true) // Tylko zatwierdzone
              // Można dodać domyślne sortowanie, np. po nazwie
              // Q.sortBy('name', Q.asc)
            )
          .observe();
      })
    );
  }

   /** Obserwuje wszystkie NIEZATWIERDZONE przepisy dla zalogowanego użytkownika. */
   static observeAllPending(database: Database): Observable<Recipe[]> {
     return from(AuthService.getActiveUserId()).pipe(
       switchMap(activeUserId => {
         if (!activeUserId) return of([]);
         return database.get<Recipe>(this.table)
           .query(
               Q.where('user_id', activeUserId),
               Q.where('is_approved', false) // Tylko niezatwierdzone
               // Sortowanie np. po dacie utworzenia malejąco (najnowsze pierwsze)
               // Q.sortBy('created_at', Q.desc)
             )
           .observe();
       })
     );
   }


  /**
   * Tworzy lub aktualizuje przepis na podstawie danych z formularza.
   * Obsługuje aktualizację powiązanych tagów i składników.
   * NIE obsługuje bezpośrednio uploadu obrazka - zakłada, że ścieżka w `data.image`
   * jest już obsługiwana przez `ImageService` lub API.
   */
  static async upsertFromFormData(
    database: Database,
    userId: string,
    data: RecipeFormData,
    recipeIdToUpdate?: string
  ): Promise<Recipe> {

    const recipesCollection = database.get<Recipe>(this.table);
    const tagsCollection = database.get<Tag>('tags'); // Nazwa tabeli tagów
    const recipeTagsCollection = database.get<RecipeTag>('recipe_tags'); // Nazwa tabeli pośredniczącej

    let recipe: Recipe;
    const isUpdate = !!recipeIdToUpdate;
    console.log(`[DB Recipe] Zapisywanie przepisu (Update: ${isUpdate}): ${data.name}`);

    await database.write(async (writer) => { // Używamy writer do operacji batch
      if (isUpdate) {
        // --- AKTUALIZACJA ---
        recipe = await recipesCollection.find(recipeIdToUpdate);
        await recipe.update(record => {
          record.name = data.name.trim();
          record.instructions = data.instructions.trim();
          record.description = data.description?.trim() ?? null;
          record.prepTime = data.prepTime ? parseInt(data.prepTime, 10) || null : null;
          record.totalTime = data.totalTime ? parseInt(data.totalTime, 10) || null : null;
          record.servings = data.servings ? parseInt(data.servings, 10) || 1 : 1;
          record.notes = data.notes?.trim() ?? null;
          record.nutrition = data.nutrition?.trim() ?? null;
          record.video = data.video?.trim() ?? null;
          record.source = data.source?.trim() ?? null;
          // NIE aktualizujemy imageUrl tutaj - tym zarządza PULL i ImageService
          // Możemy ewentualnie zaktualizować inne pola, np. rating, jeśli są w formularzu
        });

        // Aktualizacja Tagów
        const existingRecipeTags = await recipe.recipeTags.fetch();
        const existingTagIds = new Set(existingRecipeTags.map(rt => rt.tagId));
        const selectedTagIds = new Set(data.selectedTags?.map(t => t.id) ?? []);

        const tagsToRemove = existingRecipeTags.filter(rt => !selectedTagIds.has(rt.tagId));
        const tagsToAddIds = [...selectedTagIds].filter(id => !existingTagIds.has(id));

        const batchOps: Model[] = tagsToRemove.map(rt => rt.prepareMarkAsDeleted());

        for (const tagId of tagsToAddIds) {
          try {
            // Sprawdź czy tag istnieje zanim dodasz powiązanie
            await tagsCollection.find(tagId);
            batchOps.push(recipeTagsCollection.prepareCreate(rt => {
              rt.recipe.id = recipe.id;
              rt.tag.id = tagId;
              rt.userId = userId;
            }));
          } catch (tagFindError) {
            console.warn(`[DB Recipe] Tag ${tagId} nie znaleziony przy aktualizacji. Pomijanie.`);
          }
        }

        // Aktualizacja Składników - usuń stare, dodaj nowe
        const existingIngredients = await recipe.ingredients.fetch();
        existingIngredients.forEach(ing => batchOps.push(ing.prepareMarkAsDeleted()));

        // Utwórz nowe składniki (funkcja zwraca prepareCreate)
        const newIngredientOps = await IngredientModel.createIngredientsFromTextPrepare(
            database, recipe.id, userId, data.ingredients
        );
        batchOps.push(...newIngredientOps);

        // Wykonaj wszystkie operacje (update przepisu jest już wykonany)
        if (batchOps.length > 0) {
           await writer.batch(...batchOps);
        }

      } else {
        // --- TWORZENIE NOWEGO ---
        recipe = await recipesCollection.create(record => {
          record.userId = userId;
          record.name = data.name.trim();
          record.instructions = data.instructions.trim();
          record.description = data.description?.trim() ?? null;
          record.prepTime = data.prepTime ? parseInt(data.prepTime, 10) || null : null;
          record.totalTime = data.totalTime ? parseInt(data.totalTime, 10) || null : null;
          record.servings = data.servings ? parseInt(data.servings, 10) || 1 : 1;
          record.notes = data.notes?.trim() ?? null;
          record.nutrition = data.nutrition?.trim() ?? null;
          record.video = data.video?.trim() ?? null;
          record.source = data.source?.trim() ?? null;
          record.isApproved = false; // Nowe przepisy domyślnie niezatwierdzone
          record.rating = 0;
          record.imageUrl = null; // Początkowo brak URL obrazka
        });

        const batchOps: Model[] = [];

        // Dodawanie Tagów
        if (data.selectedTags) {
          for (const tag of data.selectedTags) {
             try {
                  await tagsCollection.find(tag.id); // Sprawdź czy tag istnieje
                  batchOps.push(recipeTagsCollection.prepareCreate(rt => {
                      rt.recipe.id = recipe.id;
                      rt.tag.id = tag.id;
                      rt.userId = userId;
                  }));
              } catch (tagFindError) {
                  console.warn(`[DB Recipe] Tag ${tag.id} nie znaleziony przy tworzeniu. Pomijanie.`);
              }
          }
        }
        // Dodawanie Składników
        const newIngredientOps = await IngredientModel.createIngredientsFromTextPrepare(
            database, recipe.id, userId, data.ingredients
        );
        batchOps.push(...newIngredientOps);

        if (batchOps.length > 0) {
           await writer.batch(...batchOps);
        }
      }
    }); // Koniec database.write()

    // @ts-ignore - recipe jest na pewno przypisane w transakcji
    console.log(`[DB Recipe] Pomyślnie ${isUpdate ? 'zaktualizowano' : 'utworzono'} przepis lokalnie: ${recipe.id}`);
    // @ts-ignore
    return recipe;
  }


  // --- Metody Instancji ---

  /** Oznacza przepis i wszystkie powiązane dane (RecipeTag, Ingredient, RecipeImageLocal) jako usunięte. */
  @writer async markAsDeletedCascade() {
    console.log(`[DB Recipe] Rozpoczynanie usuwania kaskadowego dla przepisu ${this.id} ('${this.name}').`);
    const batchOperations: Model[] = [];

    // Pobierz powiązane rekordy
    const relatedRecipeTags = await this.recipeTags.fetch();
    const relatedIngredients = await this.ingredients.fetch();
    // Pobierz powiązane lokalne obrazki (wymaga zapytania, bo nie ma relacji @children)
    const relatedLocalImages = await this.database.get<RecipeImageLocal>('recipe_images_local')
                                      .query(Q.where('recipe_id', this.id)).fetch();

    // Przygotuj usunięcie powiązań RecipeTag
    relatedRecipeTags.forEach(rt => batchOperations.push(rt.prepareMarkAsDeleted()));
    // Przygotuj usunięcie składników
    relatedIngredients.forEach(ing => batchOperations.push(ing.prepareMarkAsDeleted()));
    // Przygotuj usunięcie lokalnych obrazków (są tylko lokalne, więc destroyPermanently)
    relatedLocalImages.forEach(img => batchOperations.push(img.prepareDestroyPermanently()));
    // Przygotuj usunięcie samego przepisu
    batchOperations.push(this.prepareMarkAsDeleted());

    // Wykonaj wszystkie operacje w jednej transakcji batch
    await this.database.batch(...batchOperations);

    // Dodatkowo usuń pliki z FileSystem dla lokalnych obrazków
    for (const img of relatedLocalImages) {
       // TODO: Implement FileSystem delete logic here, using img.localPath and img.localThumbnailPath
       // await deleteLocalImageFile(img.localPath);
       // await deleteLocalImageFile(img.localThumbnailPath);
    }

    console.log(`[DB Recipe] Zakończono usuwanie kaskadowe dla przepisu ${this.id}. Usunięto ${relatedRecipeTags.length} tagów, ${relatedIngredients.length} składników, ${relatedLocalImages.length} obrazków.`);
  }

  /** Aktualizuje ocenę przepisu. */
  @writer async updateRating(newRating: number) {
    if (this.rating !== newRating && newRating >= 0 && newRating <= 5) {
        await this.update(recipe => { recipe.rating = newRating; });
        console.log(`[DB Recipe] Zaktualizowano ocenę dla ${this.id} na ${newRating}.`);
    }
  }

  /** Przełącza stan zatwierdzenia przepisu. */
  @writer async toggleApproval() {
    const newState = !this.isApproved;
    await this.update(recipe => { recipe.isApproved = newState; });
    console.log(`[DB Recipe] Zmieniono status zatwierdzenia dla ${this.id} na ${newState}.`);
  }

  /** Pobiera lokalną ścieżkę do miniaturki (asynchronicznie). */
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

   /** Obserwuje lokalną ścieżkę do miniaturki. */
   observeLocalThumbnailPath(): Observable<string | null> {
       return this.database.get<RecipeImageLocal>('recipe_images_local')
           .query(Q.where('recipe_id', this.id), Q.take(1))
           .observe()
           .pipe(
               map(results => results.length > 0 ? (results[0].localThumbnailPath ?? null) : null),
               distinctUntilChanged() // Emituj tylko przy zmianie ścieżki
           );
   }


  // --- Przygotowanie do batch ---
   prepareMarkAsDeletedCascade(): Model[] {
       // Ta operacja jest złożona (fetch + delete). Lepiej wykonać w transakcji przez metodę instancji.
       console.warn("prepareMarkAsDeletedCascade nie jest zaimplementowane dla batch - użyj pełnej metody markAsDeletedCascade w transakcji.");
       return [];
   }

   prepareUpdateRating(newRating: number): Recipe | null {
       if (this.rating === newRating || newRating < 0 || newRating > 5) return null;
       return this.prepareUpdate(recipe => { recipe.rating = newRating; });
   }

    prepareToggleApproval(): Recipe {
        return this.prepareUpdate(recipe => { recipe.isApproved = !recipe.isApproved; });
    }

}

// Dodajemy nową, pomocniczą metodę statyczną do Ingredient dla batchowania
declare module './Ingredient' { // Używamy declaration merging
    interface Ingredient {
        // Dodajemy metodę prepareCreate jako część interfejsu, chociaż jest statyczna w implementacji
        // To jest obejście ograniczeń TypeScript dla metod statycznych w operacjach batch
    }
    interface IngredientModelStatic { // Interfejs dla statycznych metod
         createIngredientsFromTextPrepare(
             database: Database,
             recipeId: string,
             userId: string,
             ingredientsText: string
         ): Promise<Ingredient[]>; // Zwraca tablicę przygotowanych operacji
    }
}

// Implementacja metody statycznej dla batch
IngredientModel.createIngredientsFromTextPrepare = async function(
    database: Database,
    recipeId: string,
    userId: string,
    ingredientsText: string
): Promise<Ingredient[]> {
    const ingredientLines = ingredientsText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (ingredientLines.length === 0) return [];

    const ingredientsCollection = database.get<Ingredient>(IngredientModel.table);
    const newIngredientsBatch: Ingredient[] = [];

    for (let i = 0; i < ingredientLines.length; i++) {
      const line = ingredientLines[i];
      const parsed = parseIngredient(line);
      newIngredientsBatch.push(
        ingredientsCollection.prepareCreate(ingredient => {
          ingredient.recipeId = recipeId;
          ingredient.userId = userId;
          ingredient.name = parsed.name || line;
          ingredient.amount = parsed.amount !== null && !isNaN(parsed.amount) ? String(parsed.amount) : null;
          ingredient.unit = parsed.unit ?? null;
          ingredient.order = i + 1;
          ingredient.originalStr = line;
        })
      );
    }
    return newIngredientsBatch;
};