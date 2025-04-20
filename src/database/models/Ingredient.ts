import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  relation,
  immutableRelation,
  date,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Relation, associations, Database, Collection } from '@nozbe/watermelondb'; // Dodano Database, Collection, Poprawiono Associations -> associations
import type Recipe from './Recipe';
import { Observable } from 'rxjs';
import { parseIngredient } from '../../utils/ingredientParser'; // Przywrócono poprawną ścieżkę

export default class Ingredient extends Model {
  static table = 'ingredients';
  static associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' },
  } as const;

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @field('recipe_id') recipeId!: string;
  @text('amount') amount?: string | null; // Zgodnie ze schematem (string)
  @text('unit') unit?: string | null;
  @text('name') name!: string;
  @text('type') type?: string | null;
  @field('order') order!: number;
  @text('original_str') originalStr?: string | null;

  // --- Relacje ---
  @immutableRelation('recipes', 'recipe_id') recipe!: Relation<Recipe>;

  // --- Metody Statyczne ---

  /** Obserwuje składniki dla danego przepisu, posortowane wg kolejności. */
  static observeForRecipe(database: Database, recipeId: string): Observable<Ingredient[]> {
    return database
      .get<Ingredient>(this.table)
      .query(
          Q.where('recipe_id', recipeId),
          Q.sortBy('order', Q.asc) // Sortuj rosnąco po kolejności
        )
      .observe();
  }

  /**
   * Tworzy składniki na podstawie tekstu (np. wklejonego lub z importu).
   * Każda linia tekstu jest traktowana jako osobny składnik.
   */
  static async createIngredientsFromText(
    database: Database,
    recipeId: string,
    userId: string,
    ingredientsText: string
  ): Promise<Ingredient[]> {
    try {
      console.log(`[DB Ingredient] Przetwarzanie i tworzenie składników dla przepisu ${recipeId}`);
      const ingredientLines = ingredientsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0); // Ignoruj puste linie

      if (ingredientLines.length === 0) {
          console.log(`[DB Ingredient] Brak linii składników do przetworzenia dla przepisu ${recipeId}`);
          return []; // Zwróć pustą tablicę, jeśli nie ma linii
      }

      console.log(`[DB Ingredient] Tworzenie ${ingredientLines.length} składników lokalnie dla przepisu ${recipeId}`);
      const ingredientsCollection = database.get<Ingredient>(this.table);
      const newIngredientsBatch: Ingredient[] = []; // Tablica do zbierania operacji create

      // Przygotuj operacje tworzenia dla batch
      for (let i = 0; i < ingredientLines.length; i++) {
        const line = ingredientLines[i];
        const parsed = parseIngredient(line); // Użyj parsera

        newIngredientsBatch.push(
          ingredientsCollection.prepareCreate(ingredient => {
            ingredient.recipeId = recipeId;
            ingredient.userId = userId;
            // Użyj sparsowanej nazwy lub oryginalnej linii jako fallback
            ingredient.name = parsed.name || line;
            // Zapisz sparsowaną ilość jako string lub null
            ingredient.amount = parsed.amount !== null && !isNaN(parsed.amount) ? String(parsed.amount) : null;
            ingredient.unit = parsed.unit ?? null;
            ingredient.order = i + 1; // Kolejność na podstawie linii
            ingredient.originalStr = line;
            // ingredient.type = parsed.type ?? null; // Jeśli parser zwraca typ
          })
        );
      }

      // Wykonaj wszystkie operacje tworzenia w jednej transakcji batch
      let createdIngredients: Ingredient[] = newIngredientsBatch; // Przypisz przygotowane modele
      await database.write(async () => {
        await database.batch(...newIngredientsBatch); // Wykonaj batch, który nie zwraca modeli
      });

      console.log(`[DB Ingredient] Pomyślnie utworzono lokalnie ${createdIngredients.length} składników dla przepisu ${recipeId}`);
      return createdIngredients; // Zwróć przygotowane modele

    } catch (error) {
      console.error(`[DB Ingredient] Błąd podczas lokalnego tworzenia składników z tekstu:`, error);
      throw error; // Rzuć błąd dalej
    }
  }

  // --- Metody Instancji ---

  /** Aktualizuje dane składnika. */
  @writer async updateIngredient(updates: {
    amount?: string | null,
    unit?: string | null,
    name?: string,
    order?: number,
    originalStr?: string,
    type?: string | null
  }) {
    const currentUpdate: Partial<Ingredient> = {}; // Obiekt do zbierania zmian

    if (updates.amount !== undefined) currentUpdate.amount = updates.amount;
    if (updates.unit !== undefined) currentUpdate.unit = updates.unit;
    if (updates.name !== undefined) currentUpdate.name = updates.name.trim();
    if (updates.order !== undefined) currentUpdate.order = updates.order;
    if (updates.originalStr !== undefined) currentUpdate.originalStr = updates.originalStr;
    if (updates.type !== undefined) currentUpdate.type = updates.type;

    if (Object.keys(currentUpdate).length > 0) {
       await this.update(ingredient => {
           Object.assign(ingredient, currentUpdate);
       });
       console.log(`[DB Ingredient] Zaktualizowano składnik ${this.id}. Zmiany:`, currentUpdate);
    } else {
        console.log(`[DB Ingredient] Brak zmian do zastosowania dla składnika ${this.id}.`);
    }
  }

  /** Oznacza składnik jako usunięty. */
  @writer async deleteIngredient() {
    console.log(`[DB Ingredient] Oznaczanie składnika ${this.id} jako usunięte.`);
    await this.markAsDeleted();
  }

  // --- Przygotowanie do batch ---
  prepareUpdateIngredient(updates: { amount?: string | null, unit?: string | null, name?: string, order?: number, originalStr?: string, type?: string | null }): Ingredient {
       const currentUpdate: Partial<Ingredient> = {};
       if (updates.amount !== undefined) currentUpdate.amount = updates.amount;
       if (updates.unit !== undefined) currentUpdate.unit = updates.unit;
       if (updates.name !== undefined) currentUpdate.name = updates.name.trim();
       if (updates.order !== undefined) currentUpdate.order = updates.order;
       if (updates.originalStr !== undefined) currentUpdate.originalStr = updates.originalStr;
       if (updates.type !== undefined) currentUpdate.type = updates.type;

       return this.prepareUpdate(ingredient => {
           Object.assign(ingredient, currentUpdate);
       });
   }

  prepareDeleteIngredient(): Ingredient {
       return this.prepareMarkAsDeleted();
   }
}

// Interfejs danych do tworzenia (opcjonalny)
export interface IngredientCreateData {
  recipeId: string;
  userId: string;
  name: string;
  amount?: string | null;
  unit?: string | null;
  order: number;
  originalStr?: string | null;
  type?: string | null;
}