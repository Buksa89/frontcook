import { field, text, relation } from '@nozbe/watermelondb/decorators'
import { Database, Model } from '@nozbe/watermelondb'
import { Q } from '@nozbe/watermelondb'
import SyncModel from './SyncModel'
import Recipe from './Recipe'
import { parseIngredient } from '../../app/utils/ingredientParser'
import { Observable, from } from 'rxjs'
import { switchMap } from 'rxjs/operators'

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

  static async createIngredientsFromText(
    database: Database,
    recipeId: string,
    ingredientsText: string
  ): Promise<Ingredient[]> {
    try {
      console.log(`[DB Ingredient] Processing ingredients for recipe ${recipeId}`);
      
      // Split text into lines and remove empty lines
      const ingredientLines = ingredientsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      console.log(`[DB Ingredient] Creating ${ingredientLines.length} new ingredients for recipe ${recipeId}`);
      
      // Create new ingredients
      const newIngredients: Ingredient[] = [];
      for (let i = 0; i < ingredientLines.length; i++) {
        const line = ingredientLines[i];
        const parsed = parseIngredient(line);
        
        const ingredient = await Ingredient.createIngredient(
          database,
          recipeId,
          parsed.name,
          parsed.amount,
          parsed.unit,
          i + 1, // order
          line,  // originalStr
          null   // type
        );
        
        newIngredients.push(ingredient);
      }
      
      console.log(`[DB Ingredient] Successfully processed ${newIngredients.length} ingredients for recipe ${recipeId}`);
      return newIngredients;
    } catch (error) {
      console.error(`[DB Ingredient] Error processing ingredients: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Static method to find a recipe by sync_id
  static async findRecipeBySyncId(database: Database, recipeSyncId: string): Promise<Recipe | null> {
    const recipes = await database.get<Recipe>('recipes')
      .query(Q.where('sync_id', recipeSyncId))
      .fetch();
    
    return recipes.length > 0 ? recipes[0] : null;
  }


  // Create method following the ShoppingItem pattern
  static async createIngredient(
    database: Database,
    recipeId: string,
    name: string,
    amount: number | null,
    unit: string | null,
    order: number,
    originalStr: string,
    type: string | null = null,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: string,
    isDeleted?: boolean
  ): Promise<Ingredient> {
    try {
      console.log(`[DB Ingredient] Creating new ingredient ${name} for recipe ${recipeId}`);
      
      // Use the parent SyncModel.create method
      return await SyncModel.create.call(
        this as unknown as (new () => SyncModel) & typeof SyncModel,
        database,
        (record: SyncModel) => {
          const ingredient = record as Ingredient;
          
          // Set ingredient-specific fields
          ingredient.recipeId = recipeId;
          ingredient.name = name;
          ingredient.amount = amount;
          ingredient.unit = unit;
          ingredient.order = order;
          ingredient.originalStr = originalStr;
          ingredient.type = type;
          
          // Set optional SyncModel fields if provided
          if (syncId !== undefined) ingredient.syncId = syncId;
          if (syncStatusField !== undefined) ingredient.syncStatusField = syncStatusField;
          if (lastUpdate !== undefined) ingredient.lastUpdate = lastUpdate;
          if (isDeleted !== undefined) ingredient.isDeleted = isDeleted;
        }
      ) as Ingredient;
    } catch (error) {
      console.error(`[DB Ingredient] Error creating ingredient: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  // Update method following the ShoppingItem pattern
  static async update(
    database: Database,
    ingredientId: string,
    name?: string,
    amount?: number | null,
    unit?: string | null,
    recipeId?: string,
    order?: number,
    originalStr?: string,
    type?: string | null,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: string,
    isDeleted?: boolean
  ): Promise<Ingredient | null> {
    try {
      const ingredient = await database
        .get<Ingredient>('ingredients')
        .find(ingredientId);
      
      if (!ingredient) {
        console.log(`[DB Ingredient] Ingredient with id ${ingredientId} not found`);
        return null;
      }
      
      console.log(`[DB Ingredient] Updating ingredient ${ingredientId} with provided fields`);
      
      // Use the update method directly from the model instance
      await ingredient.update(record => {
        // Update only provided fields
        if (name !== undefined) record.name = name;
        if (amount !== undefined) record.amount = amount;
        if (unit !== undefined) record.unit = unit;
        if (recipeId !== undefined) record.recipeId = recipeId;
        if (order !== undefined) record.order = order;
        if (originalStr !== undefined) record.originalStr = originalStr;
        if (type !== undefined) record.type = type;
        
        // Update SyncModel fields if provided
        if (syncId !== undefined) record.syncId = syncId;
        if (syncStatusField !== undefined) record.syncStatusField = syncStatusField;
        if (lastUpdate !== undefined) record.lastUpdate = lastUpdate;
        if (isDeleted !== undefined) record.isDeleted = isDeleted;
      });
      
      console.log(`[DB Ingredient] Successfully updated ingredient ${ingredientId}`);
      return ingredient;
    } catch (error) {
      console.error(`[DB Ingredient] Error updating ingredient: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Override markAsDeleted for consistent implementation
  async markAsDeleted(): Promise<void> {
    try {
      console.log(`[DB ${this.table}] Marking ingredient ${this.id} as deleted`);
      
      // Use the static update method to mark as deleted
      await Ingredient.update(
        this.database,
        this.id,
        undefined, // name - keep existing
        undefined, // amount - keep existing
        undefined, // unit - keep existing
        undefined, // recipeId - keep existing
        undefined, // order - keep existing
        undefined, // originalStr - keep existing
        undefined, // type - keep existing
        undefined, // syncId - keep existing
        undefined, // syncStatusField - will be set automatically
        undefined, // lastUpdate - will be set automatically
        true      // isDeleted - mark as deleted
      );
      
      console.log(`[DB ${this.table}] Successfully marked ingredient ${this.id} as deleted`);
    } catch (error) {
      console.error(`[DB ${this.table}] Error marking ingredient as deleted: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Instance method to set relations from server object
  async setRelations(serverObject: Record<string, any>): Promise<Record<string, any>> {
    console.log(`[DB ${this.table}] Setting relations for ingredient with id: ${this.id}`);
    
    // Call the static implementation directly
    return await Ingredient.setRelations(serverObject, this.database);
  }

  // Override setRelations to handle recipe relation
  static async setRelations<T extends SyncModel>(
    serverObject: Record<string, any>,
    database: Database
  ): Promise<Record<string, any>> {
    // Call the parent method
    const result = await SyncModel.setRelations(serverObject, database);
    
    // We expect serverObject to have recipe property with sync_id
    const recipeSyncId = serverObject.recipe;
    
    // Store the found ID to use when creating/updating the record
    let recipeLocalId = null;
    
    // Process recipe relation if sync_id is provided
    if (recipeSyncId) {
      // Find the recipe with the given sync_id
      const recipe = await this.findRecipeBySyncId(database, recipeSyncId);
      if (recipe) {
        // Store the local ID for use in createAsSynced or update
        recipeLocalId = recipe.id;
        // Add to processed data directly in snake_case (for createAsSynced)
        result.recipe_id = recipe.id;
      } else {
        console.log(`[DB ${this.table}] Warning: Recipe with syncId ${recipeSyncId} not found`);
      }
    }
    
    return result;
  }

  // Override createAsSynced to properly handle relations
  static async createAsSynced<T extends SyncModel>(
    this: { new(): T } & typeof SyncModel,
    database: Database,
    serverData: Record<string, any>
  ): Promise<T> {
    // Extract relation ID before passing to parent method
    const recipeId = serverData.recipe_id;
    
    // Remove relation fields from server data
    const sanitizedData = { ...serverData };
    delete sanitizedData.recipe_id;
    delete sanitizedData.recipe;
    
    // Call the parent createAsSynced with sanitized data
    const record = await SyncModel.createAsSynced.call(
      this,
      database,
      sanitizedData
    ) as Ingredient;
    
    // Now set the relation correctly after the record is created
    if (recipeId) {
      await record.update(r => {
        r.recipeId = recipeId;
      });
    }
    
    return record as unknown as T;
  }

  // Override prepareForPush to properly handle relations
  prepareForPush(): Record<string, any> {
    // Get base data from parent class
    const baseData = super.prepareForPush();
    baseData.recipe = this.recipe.syncId;
    
    return baseData;
  }
} 