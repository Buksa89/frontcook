import { field, text, relation } from '@nozbe/watermelondb/decorators'
import { associations } from '@nozbe/watermelondb'
import { Database, Model, Collection } from '@nozbe/watermelondb'
import { Q } from '@nozbe/watermelondb'
import SyncModel from './SyncModel'
import Recipe from './Recipe'
import { parseIngredient } from '../../app/utils/ingredientParser'
import { Observable, from } from 'rxjs'
import { switchMap } from 'rxjs/operators'
import { v4 as uuidv4 } from 'uuid'
import AuthService from '../../app/services/auth/authService'

export default class Ingredient extends SyncModel {
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
          SyncModel.applySyncModelDefaults(ingredient, activeUser);
        });
      })
    ];

    return operations;
  }

  // Helper method to get sync data for this ingredient
  getSyncData(): Record<string, any> {
    // Pobierz sync_id przepisu, jeśli jest dostępny
    let recipeSyncId = null;
    
    // Najpierw sprawdź, czy mamy dostęp do obiektu recipe przez relację
    if (this.recipe) {
      recipeSyncId = this.recipe.syncId;
    }
    
    // Jeśli nie, sprawdź, czy mamy dostęp do obiektu recipe przez pole _recipe ustawione przez SyncService
    if (!recipeSyncId && (this as any)._recipe) {
      recipeSyncId = (this as any)._recipe.syncId;
    }
    
    // Jeśli nadal nie mamy sync_id przepisu, logujemy informację
    if (!recipeSyncId && this.recipeId) {
      console.log(`[DB ${this.table}] No recipe object available, trying to get sync_id for recipe_id: ${this.recipeId}`);
      // Nie możemy użyć await bezpośrednio w metodzie synchronicznej, więc zwracamy dane bez recipe
      // Pole recipe zostanie dodane w metodzie push w SyncService
    }
    
    return {
      object_type: 'ingredient',
      sync_id: this.syncId,
      last_update: this.lastUpdate,
      is_deleted: this.isDeleted,
      name: this.name,
      amount: this.amount,
      unit: this.unit,
      type: this.type,
      order: this.order,
      original_str: this.originalStr,
      recipe: recipeSyncId,  // Używamy sync_id przepisu
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
        } else {
          console.log(`[DB ${this.table}] Recipe with sync_id ${serverObject.recipe} not found yet, will retry later`);
          // Instead of failing, we'll return an empty array to indicate this object should be retried later
          return [];
        }
      } catch (error) {
        console.log(`[DB ${this.table}] Error finding recipe with sync_id ${serverObject.recipe}, will retry later`);
        // Instead of failing, we'll return an empty array to indicate this object should be retried later
        return [];
      }
    }
    
    // Call the base implementation to find matching records
    const records = await SyncModel.findMatchingRecords.call(this as unknown as (new () => SyncModel) & typeof SyncModel, database, serverObject);
    return records as Ingredient[];
  }
} 