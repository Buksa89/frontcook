// src/database/models/Ingredient.ts

import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  relation,
  immutableRelation,
  date, // Dodano import date
  writer // Dodano import writer
} from '@nozbe/watermelondb/decorators';
import type { Database, Relation, Collection } from '@nozbe/watermelondb'; // Dodano Collection
import type Recipe from './Recipe';
import { Observable, from, of } from 'rxjs'; // Dodano of
import { map, switchMap } from 'rxjs/operators';
import { parseIngredient } from '../../app/utils/ingredientParser';

// --- NOWA IMPLEMENTACJA ---

export class Ingredient extends Model {
  static table = 'ingredients'; // Standardowa definicja
  static associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' },
  } as const;

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  // @date('created_at') createdAt!: number; // Opcjonalne
  @field('recipe_id') recipeId!: string;
  @field('amount') amount?: number | null; // Używamy ? i null
  @text('unit') unit?: string | null; // Używamy ? i null
  @text('name') name!: string;
  @text('type') type?: string | null; // Używamy ? i null
  @field('order') order!: number;
  @text('original_str') originalStr?: string | null; // Może być opcjonalny

  @immutableRelation('recipes', 'recipe_id') recipe!: Relation<Recipe>; // Poprawiono typ na Recipe

  // --- Metody Statyczne ---
  static observeForRecipe(database: Database, recipeId: string): Observable<Ingredient[]> {
    // ... (bez zmian w logice)
    return database
        .get<Ingredient>(this.table)
        .query(Q.where('recipe_id', recipeId), Q.sortBy('order', Q.asc)) // Dodano sortowanie
        .observe();
    // Usunięto sortowanie w pipe, bo jest w query
  }

  static async createIngredientsFromText(
    database: Database,
    recipeId: string,
    userId: string,
    ingredientsText: string
  ): Promise<Ingredient[]> {
    // ... (bez zmian w logice)
    try {
        console.log(`[DB Ingredient] Przetwarzanie składników lokalnie dla przepisu ${recipeId}`);
        const ingredientLines = ingredientsText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        console.log(`[DB Ingredient] Tworzenie ${ingredientLines.length} nowych składników lokalnie dla przepisu ${recipeId}`);
        const ingredientsCollection = database.get<Ingredient>(this.table);
        const newIngredients: Ingredient[] = [];
        await database.write(async () => {
          for (let i = 0; i < ingredientLines.length; i++) {
            const line = ingredientLines[i];
            const parsed = parseIngredient(line);
            const newIngredient = await ingredientsCollection.create(ingredient => {
              ingredient.recipeId = recipeId;
              ingredient.userId = userId;
              ingredient.name = parsed.name || line.trim();
              ingredient.amount = parsed.amount ?? null; // Zmieniono undefined na null
              ingredient.unit = parsed.unit ?? null;   // Zmieniono undefined na null
              ingredient.order = i + 1;
              ingredient.originalStr = line;
            });
            newIngredients.push(newIngredient);
          }
        });
        console.log(`[DB Ingredient] Pomyślnie utworzono lokalnie ${newIngredients.length} składników dla przepisu ${recipeId}`);
        return newIngredients;
      } catch (error) {
        console.error(`[DB Ingredient] Błąd podczas lokalnego tworzenia składników: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
  }

  // --- Metody Instancji ---
  @writer async updateIngredient(updates: { amount?: number | null, unit?: string | null, name?: string, order?: number, originalStr?: string }) {
      // ... (bez zmian w logice)
      await this.update(ingredient => {
          if (updates.amount !== undefined) ingredient.amount = updates.amount;
          if (updates.unit !== undefined) ingredient.unit = updates.unit;
          if (updates.name !== undefined) ingredient.name = updates.name;
          if (updates.order !== undefined) ingredient.order = updates.order;
          if (updates.originalStr !== undefined) ingredient.originalStr = updates.originalStr;
      });
  }

  @writer async deleteIngredient() {
      // ... (bez zmian w logice)
      await this.markAsDeleted();
  }
}

export default Ingredient;

export interface IngredientCreateData { // Eksport interfejsu, jeśli potrzebny
    recipeId: string;
    userId: string;
    name: string;
    amount?: number | null; // Zmieniono undefined na null
    unit?: string | null;   // Zmieniono undefined na null
    order: number;
    originalStr: string;
    type?: string | null;
}