import { field, text, relation } from '@nozbe/watermelondb/decorators'
import { associations } from '@nozbe/watermelondb'
import { Database, Model } from '@nozbe/watermelondb'
import { Q } from '@nozbe/watermelondb'
import BaseModel from './BaseModel'
import Recipe from './Recipe'
import { parseIngredient } from '../../app/utils/ingredientParser'
import { Observable, from } from 'rxjs'
import { switchMap } from 'rxjs/operators'

export default class Ingredient extends BaseModel {
  static table = 'ingredients'
  static associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' }
  } as const

  // Query methods
  static observeForRecipe(database: Database, recipeId: string): Observable<Ingredient[]> {
    return from(database.get<Recipe>('recipes').findAndObserve(recipeId)).pipe(
      switchMap(recipe => {
        if (!recipe) return new Observable<Ingredient[]>(subscriber => subscriber.next([]));
        return database
          .get<Ingredient>('ingredients')
          .query(
            Q.and(
              Q.where('recipe_id', recipe.id),
              Q.where('is_deleted', false)
            )
          )
          .observe()
          .pipe(
            switchMap(ingredients => 
              new Observable<Ingredient[]>(subscriber => 
                subscriber.next(ingredients.sort((a, b) => a.order - b.order))
              )
            )
          );
      })
    );
  }

  static async prepareIngredientsFromText(
    database: Database,
    recipeId: string,
    ingredientsText: string
  ): Promise<Model[]> {
    const ingredientsCollection = database.get<Ingredient>('ingredients');
    
    // Split text into lines and remove empty lines
    const ingredientLines = ingredientsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Get existing ingredients
    const existingIngredients = await ingredientsCollection
      .query(
        Q.and(
          Q.where('recipe_id', recipeId),
          Q.where('is_deleted', false)
        )
      )
      .fetch();

    // Prepare all operations
    const operations: Model[] = [
      // Mark existing ingredients as deleted by preparing update operations
      ...existingIngredients.map(ingredient => 
        ingredient.prepareUpdate(record => {
          record.isDeleted = true;
          record.syncStatus = 'pending';
          record.lastSync = new Date().toISOString();
        })
      ),
      // Create new ingredients
      ...ingredientLines.map((line, index) => {
        const parsed = parseIngredient(line);
        return ingredientsCollection.prepareCreate(ingredient => {
          ingredient.recipeId = recipeId;
          ingredient.order = index + 1;
          ingredient.originalStr = line;
          ingredient.amount = parsed.amount;
          ingredient.unit = parsed.unit;
          ingredient.name = parsed.name;
          ingredient.type = null;
        });
      })
    ];

    return operations;
  }

  @field('remote_id') remoteId!: string | null
  @field('amount') amount!: number | null
  @text('unit') unit!: string | null
  @text('name') name!: string
  @text('type') type!: string | null
  @field('recipe_id') recipeId!: string
  @field('order') order!: number
  @text('original_str') originalStr!: string

  // Relation to access the related Recipe
  @relation('recipes', 'recipe_id') recipe!: Recipe
} 