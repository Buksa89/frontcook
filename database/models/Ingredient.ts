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
        
        const ingredient = await Ingredient.create(
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
  static async create(
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
    lastUpdate?: Date,
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
  
  static async deserialize(database: Database, serverData: Record<string, any>, existingRecord: Ingredient | null): Promise<Record<string, any>> {
    const deserializedData = await super.deserialize(database, serverData, existingRecord);
    
    // Pobierz sync_id przepisu z oryginalnych danych serwera
    const recipeSyncId = serverData.recipe; // Zakładamy, że pole nazywa się 'recipe' w danych z serwera
    
    if (recipeSyncId) {
      // Znajdź przepis po sync_id
      const recipe = await Ingredient.findRecipeBySyncId(database, recipeSyncId);
      if (recipe) {
        // Zamiast przypisywać cały obiekt, przypisz tylko ID do nowego pola
        deserializedData.recipeId = recipe.id;
      } else {
        // Rzuć błąd, jeśli przepis nie został znaleziony
        throw new Error(`[DB Ingredient] Recipe with sync_id ${recipeSyncId} not found during deserialization for Ingredient.`);
      }
    }
    
    // Usuń oryginalne pole 'recipe' (które zawierało syncId lub zostało nadpisane w super.deserialize)
    // z deserializedData, aby uniknąć pomyłek.
    delete deserializedData.recipe; 
    
    return deserializedData;
  }


  // Implementacja createFromSyncData dla klasy Ingredient
  static async createFromSyncData<T extends SyncModel>(
    this: typeof Ingredient,
    database: Database,
    deserializedData: Record<string, any>,
    syncId: string
  ): Promise<T> {

    // Pobierz recipeId bezpośrednio z deserializedData (wynik działania zmodyfikowanego Ingredient.deserialize)
    const recipeId = deserializedData.recipeId as string | undefined;

    // Usuwamy tę walidację, ponieważ błąd jest rzucany już w deserialize
    // if (!recipeId) {
    //   // Jeśli deserialize nie znalazło przepisu i nie ustawiło recipeId, rzuć błąd
    //   throw new Error(`[DB Ingredient] Cannot create ingredient ${syncId} without a valid recipeId.`);
    // }
    
    // Usunięto logikę sprawdzania recipeObject i znajdowania Recipe

    // Przygotuj argumenty dla Ingredient.create na podstawie deserializedData
    const name = deserializedData.name || 'Unnamed Ingredient'; // Wymagane pole
    const amount = deserializedData.amount !== undefined ? Number(deserializedData.amount) : null;
    const unit = deserializedData.unit || null;
    const order = Number(deserializedData.order) || 0; // Wymagane pole, domyślnie 0?
    const originalStr = deserializedData.originalStr || ''; // Wymagane pole
    const type = deserializedData.type || null;

    // Przygotuj pola synchronizacji do przekazania
    const syncStatus: 'pending' | 'synced' | 'conflict' = 'synced';
    const isDeleted = !!deserializedData.isDeleted;
    let lastUpdate: Date | undefined = undefined;
    if ('lastUpdate' in deserializedData && deserializedData.lastUpdate) {
      try { lastUpdate = new Date(deserializedData.lastUpdate); } catch (e) {
        lastUpdate = new Date(); // Fallback
      }
    } else {
      lastUpdate = new Date(); // Fallback
    }

    // Wywołaj istniejącą metodę Ingredient.create, przekazując wszystkie dane
    const newIngredient = await (Ingredient.create as any)(
      database,
      recipeId!, // Dodajemy '!' bo wiemy, że deserialize rzuciłoby błąd, gdyby było undefined
      name,
      amount,
      unit,
      order,
      originalStr,
      type,
      // Przekaż pola synchronizacji jawnie
      syncId,
      syncStatus,
      lastUpdate,
      isDeleted
    );

    return newIngredient as unknown as T;
  }

  // Override prepareForPush to properly handle relations
  serialize(): Record<string, any> {
    // Get base data from parent class
    const baseData = super.serialize();
    baseData.recipe = this.recipe.syncId;
    
    return baseData;
  }
} 