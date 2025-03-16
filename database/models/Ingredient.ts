import { field, text, relation } from '@nozbe/watermelondb/decorators'
import { associations } from '@nozbe/watermelondb'
import { Database, Model, Collection } from '@nozbe/watermelondb'
import { Q } from '@nozbe/watermelondb'
import BaseModel from './BaseModel'
import Recipe from './Recipe'
import { parseIngredient } from '../../app/utils/ingredientParser'
import { Observable, from } from 'rxjs'
import { switchMap } from 'rxjs/operators'
import { v4 as uuidv4 } from 'uuid'
import AuthService from '../../app/services/auth/authService'

export default class Ingredient extends BaseModel {
  static table = 'ingredients'
  static associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' }
  } as const

  // Fields specific to Ingredient
  @field('amount') amount!: number | null
  @text('unit') unit!: string | null
  @text('name') name!: string
  @text('type') type!: string | null
  @field('recipe_id') recipeId!: string
  @field('order') order!: number
  @text('original_str') originalStr!: string

  // Relation to access the related Recipe
  @relation('recipes', 'recipe_id') recipe!: Recipe

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

    // Get active user
    const activeUser = await AuthService.getActiveUser();

    // Prepare all operations
    const operations: Model[] = [
      // Mark existing ingredients as deleted by preparing update operations
      ...existingIngredients.map(ingredient => 
        ingredient.prepareUpdate(record => {
          record.isDeleted = true;
          record.syncStatus = 'pending';
          record.lastUpdate = new Date().toISOString();
        })
      ),
      // Create new ingredients
      ...ingredientLines.map((line, index) => {
        const parsed = parseIngredient(line);
        return ingredientsCollection.prepareCreate(ingredient => {
          // Set ingredient-specific fields
          ingredient.recipeId = recipeId;
          ingredient.order = index + 1;
          ingredient.originalStr = line;
          ingredient.amount = parsed.amount;
          ingredient.unit = parsed.unit;
          ingredient.name = parsed.name;
          ingredient.type = null;
          
          // Apply base model defaults to ensure all required fields are set correctly
          BaseModel.applyBaseModelDefaults(ingredient, activeUser);
        });
      })
    ];

    return operations;
  }

  // Helper method to get sync data for this ingredient
  getSyncData(): Record<string, any> {
    const baseData = super.getSyncData();
    return {
      ...baseData,
      object_type: 'ingredient',
      name: this.name,
      amount: this.amount,
      unit: this.unit,
      type: this.type,
      order: this.order,
      original_str: this.originalStr,
      recipe: this.recipe?.syncId  // Use sync_id of the recipe
    };
  }

  // Static method to find a recipe by sync_id
  static async findRecipeBySyncId(database: Database, recipeSyncId: string): Promise<Recipe | null> {
    const recipes = await database.get<Recipe>('recipes')
      .query(Q.where('sync_id', recipeSyncId))
      .fetch();
    
    return recipes.length > 0 ? recipes[0] : null;
  }

  // Method to find matching records with recipe sync_id mapping
  static async findMatchingRecordsWithRecipe(
    database: Database,
    serverObject: Record<string, any>
  ): Promise<Ingredient[]> {
    // If this is an ingredient and it has a recipe field (which is a sync_id)
    if (serverObject.object_type === 'ingredient' && serverObject.recipe) {
      try {
        // Find the recipe by sync_id
        const recipe = await Ingredient.findRecipeBySyncId(database, serverObject.recipe);
        
        if (recipe) {
          // Set recipeId to the local ID of the recipe
          serverObject.recipeId = recipe.id;
          console.log(`[DB ${this.table}] Mapped recipe sync_id ${serverObject.recipe} to local ID ${recipe.id}`);
        } else {
          console.error(`[DB ${this.table}] Could not find recipe with sync_id ${serverObject.recipe}`);
          // If we can't find the recipe, we can't create the ingredient
          return [];
        }
      } catch (error) {
        console.error(`[DB ${this.table}] Error mapping recipe sync_id to local ID:`, error);
        return [];
      }
    }
    
    // Call the base implementation to find matching records
    const records = await BaseModel.findMatchingRecords.call(this, database, serverObject);
    return records as Ingredient[];
  }
} 