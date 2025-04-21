// src/database/models/Ingredient.ts
import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  relation,
  immutableRelation,
  date,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Relation, associations, Database, Collection, Model as WDBModel } from '@nozbe/watermelondb';
import type Recipe from './Recipe';
import { Observable } from 'rxjs';
import { parseIngredient } from '../../utils/ingredientParser';
// --- DODAJ IMPORT UUID ---
import { v4 as uuidv4 } from 'uuid';
// -----------------------

export default class Ingredient extends Model {
  static table = 'ingredients';
  static associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' },
  } as const;

  // --- Pola ---
  @field('user_id') userId!: string | null; // Oczekuje string | null
  @date('last_modified') lastModified!: number; // Oczekuje number (timestamp)
  @date('created_at') createdAt!: number;     // Oczekuje number (timestamp)
  @field('recipe_id') recipeId!: string;     // Powiązanie z przepisem (string UUID)
  @text('amount') amount?: string | null;
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
   * Tworzy składniki na podstawie tekstu (np. wklejonego lub z importu) z UUID.
   * Każda linia tekstu jest traktowana jako osobny składnik.
   */
  static async createIngredientsFromText(
    database: Database,
    recipeId: string,
    userId: string | null, // Akceptuje string | null
    ingredientsText: string
  ): Promise<Ingredient[]> {
    try {
      console.log(`[DB Ingredient] Przetwarzanie i tworzenie składników dla przepisu ${recipeId}`);
      const ingredientLines = ingredientsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (ingredientLines.length === 0) {
          console.log(`[DB Ingredient] Brak linii składników do przetworzenia dla przepisu ${recipeId}`);
          return [];
      }

      console.log(`[DB Ingredient] Tworzenie ${ingredientLines.length} składników lokalnie z UUID dla przepisu ${recipeId}`);
      const ingredientsCollection = database.get<Ingredient>(this.table);
      const newIngredientsBatch: Ingredient[] = []; // Tablica do zbierania przygotowanych operacji

      // Przygotuj operacje tworzenia dla batch
      for (let i = 0; i < ingredientLines.length; i++) {
        const line = ingredientLines[i];
        const parsed = parseIngredient(line);
        // --- GENERUJ UUID ---
        const newId = uuidv4();
        // -------------------

        newIngredientsBatch.push(
          ingredientsCollection.prepareCreate(ingredient => {
            // --- PRZYPISZ UUID ---
            ingredient._raw.id = newId;
            // -------------------
            ingredient.recipeId = recipeId;
            ingredient.userId = userId; // Przypisz string | null
            ingredient.name = parsed.name || line; // Użyj sparsowanej nazwy lub oryginalnej linii
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
      await database.write(async () => {
        await database.batch(...newIngredientsBatch); // Wykonaj batch
      });

      // WAŻNE: newIngredientsBatch zawiera tylko przygotowane operacje.
      // Po wykonaniu batch, te obiekty nie są automatycznie "żywymi" modelami.
      // Jeśli potrzebujesz zwrócić faktycznie utworzone modele, musisz je pobrać ponownie.
      // W tym przypadku zwrócimy pustą tablicę, bo najczęściej nie potrzebujemy tych modeli od razu.
      // Jeśli są potrzebne, trzeba by zrobić query po batchu.
      const createdIds = newIngredientsBatch.map(op => op.id); // Pobierz ID z przygotowanych operacji
      console.log(`[DB Ingredient] Pomyślnie utworzono lokalnie ${createdIds.length} składników dla przepisu ${recipeId}. IDs: ${createdIds.join(', ')}`);
      // Zwróć pustą tablicę lub wykonaj query, jeśli modele są potrzebne
      return []; // Zwracamy pustą tablicę dla uproszczenia

    } catch (error) {
      console.error(`[DB Ingredient] Błąd podczas lokalnego tworzenia składników z tekstu:`, error);
      throw error;
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

       // Sprawdź czy są jakiekolwiek zmiany
       if (Object.keys(currentUpdate).length === 0) {
           // Zwróć oryginalny obiekt, jeśli nie ma zmian (prepareUpdate nie zadziała bez zmian)
           // Lub rzuć błąd/zwróć null, w zależności od oczekiwań
           console.warn(`[DB Ingredient prepareUpdateIngredient] Brak zmian dla ${this.id}`);
           return this; // Zwrócenie 'this' jest bezpieczne, bo batch zignoruje niezmienione
       }

       return this.prepareUpdate(ingredient => {
           Object.assign(ingredient, currentUpdate);
       });
   }

  prepareDeleteIngredient(): Ingredient {
       return this.prepareMarkAsDeleted();
   }
}

// Dodajemy deklarację 'interface IngredientModelStatic' (bez zmian funkcjonalnych)
// aby uniknąć błędów TS dotyczących rozszerzania modułu.
// Realna implementacja jest poniżej.
declare module './Ingredient' {
    interface Ingredient {}
    interface IngredientModelStatic {
         createIngredientsFromTextPrepare(database: Database, recipeId: string, userId: string | null, ingredientsText: string): Promise<Ingredient[]>;
    }
}

/**
 * Przygotowuje operacje tworzenia składników dla batch (z UUID).
 */
Ingredient.createIngredientsFromTextPrepare = async function(
     database: Database,
     recipeId: string,
     userId: string | null, // Akceptuje string | null
     ingredientsText: string
 ): Promise<Ingredient[]> {
      const ingredientLines = ingredientsText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (ingredientLines.length === 0) return [];

      const ingredientsCollection = database.get<Ingredient>(Ingredient.table);
      const newIngredientsBatch: Ingredient[] = [];

      for (let i = 0; i < ingredientLines.length; i++) {
        const line = ingredientLines[i];
        const parsed = parseIngredient(line);
        // --- GENERUJ UUID ---
        const newId = uuidv4();
        // -------------------
        newIngredientsBatch.push(
          ingredientsCollection.prepareCreate(ingredient => {
            // --- PRZYPISZ UUID ---
            ingredient._raw.id = newId;
            // -------------------
            ingredient.recipeId = recipeId;
            ingredient.userId = userId; // Przypisz string | null
            ingredient.name = parsed.name || line;
            ingredient.amount = parsed.amount !== null && !isNaN(parsed.amount) ? String(parsed.amount) : null;
            ingredient.unit = parsed.unit ?? null;
            ingredient.order = i + 1;
            ingredient.originalStr = line;
          })
        );
      }
      return newIngredientsBatch; // Zwróć przygotowane operacje
 };

// Interfejs danych do tworzenia (bez zmian)
export interface IngredientCreateData {
  recipeId: string;
  userId: string | null; // Zmieniono na string | null
  name: string;
  amount?: string | null;
  unit?: string | null;
  order: number;
  originalStr?: string | null;
  type?: string | null;
}