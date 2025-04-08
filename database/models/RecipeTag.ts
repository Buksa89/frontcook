import { field, relation } from '@nozbe/watermelondb/decorators'
import { associations } from '@nozbe/watermelondb'
import Recipe from './Recipe'
import Tag from './Tag'
import SyncModel from './SyncModel'
import { Q } from '@nozbe/watermelondb'
import { v4 as uuidv4 } from 'uuid'
import AuthService from '../../app/services/auth/authService'
import { Database } from '@nozbe/watermelondb'

export default class RecipeTag extends SyncModel {
  static table = 'recipe_tags'
  static associations = {
    recipes: { type: 'belongs_to' as const, key: 'recipe_id' },
    tags: { type: 'belongs_to' as const, key: 'tag_id' }
  }

  // Fields specific to RecipeTag
  @field('recipe_id') recipeId!: string
  @field('tag_id') tagId!: string

  // Relations to access the related Recipe and Tag
  @relation('recipes', 'recipe_id') recipe!: Recipe
  @relation('tags', 'tag_id') tag!: Tag

  // Helper method to create a recipe tag
  static async create(
    database: Database,
    recipeId: string,
    tagId: string,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: Date,
    isDeleted?: boolean
  ): Promise<RecipeTag> {
    try {
      console.log(`[DB ${this.table}] Creating new recipe tag for recipe ${recipeId} and tag ${tagId}`);
      
      // Use the parent SyncModel.create method
      return await SyncModel.create.call(
        this as unknown as (new () => SyncModel) & typeof SyncModel,
        database,
        (record: SyncModel) => {
          const recipeTag = record as RecipeTag;
          
          // Set recipe tag-specific fields
          recipeTag.recipeId = recipeId;
          recipeTag.tagId = tagId;
          
          // Set optional SyncModel fields if provided
          if (syncId !== undefined) recipeTag.syncId = syncId;
          if (syncStatusField !== undefined) recipeTag.syncStatusField = syncStatusField;
          if (lastUpdate !== undefined) recipeTag.lastUpdate = lastUpdate;
          if (isDeleted !== undefined) recipeTag.isDeleted = isDeleted;
        }
      ) as RecipeTag;
    } catch (error) {
      console.error(`[DB ${this.table}] Error creating recipe tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Update method following the ShoppingItem pattern
  static async update(
    database: Database,
    recipeTagId: string,
    recipeId?: string,
    tagId?: string,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: Date,
    isDeleted?: boolean
  ): Promise<RecipeTag | null> {
    try {
      const recipeTag = await database
        .get<RecipeTag>('recipe_tags')
        .find(recipeTagId);
      
      if (!recipeTag) {
        console.log(`[DB ${this.table}] Recipe tag with id ${recipeTagId} not found`);
        return null;
      }
      
      console.log(`[DB ${this.table}] Updating recipe tag ${recipeTagId} with provided fields`);
      
      // Use the update method directly from the model instance
      await recipeTag.update(record => {
        // Update only provided fields
        if (recipeId !== undefined) record.recipeId = recipeId;
        if (tagId !== undefined) record.tagId = tagId;
        
        // Update SyncModel fields if provided
        if (syncId !== undefined) record.syncId = syncId;
        if (syncStatusField !== undefined) record.syncStatusField = syncStatusField;
        if (lastUpdate !== undefined) record.lastUpdate = lastUpdate;
        if (isDeleted !== undefined) record.isDeleted = isDeleted;
      });
      
      console.log(`[DB ${this.table}] Successfully updated recipe tag ${recipeTagId}`);
      return recipeTag;
    } catch (error) {
      console.error(`[DB ${this.table}] Error updating recipe tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Static method to find a tag by sync_id
  static async findTagBySyncId(database: Database, tagSyncId: string): Promise<Tag | null> {
    const tags = await database.get<Tag>('tags')
      .query(Q.where('sync_id', tagSyncId))
      .fetch();
    
    return tags.length > 0 ? tags[0] : null;
  }

  // Dodajemy deserialize, aby znaleźć lokalne ID przed createFromSyncData
  static async deserialize(database: Database, serverData: Record<string, any>, existingRecord: RecipeTag | null): Promise<Record<string, any>> {
    const deserializedData = await super.deserialize(database, serverData, existingRecord);

    // Znajdź recipeId
    const recipeSyncId = serverData.recipe || serverData.recipe_id; // Sprawdź obie możliwe nazwy pola
    if (recipeSyncId) {
      const recipe = await this.findRecipeBySyncId(database, recipeSyncId);
      if (recipe) {
        deserializedData.recipeId = recipe.id;
      } else {
        // Rzuć błąd, jeśli przepis nie został znaleziony
        throw new Error(`[DB ${this.table}] Recipe with sync_id ${recipeSyncId} not found during deserialization for RecipeTag.`);
      }
      // Usuń pole, z którego wzięliśmy syncId (po konwersji mogło to być 'recipe' lub 'recipeId')
      delete deserializedData.recipe;
      delete deserializedData.recipeId; 
    }

    // Znajdź tagId
    const tagSyncId = serverData.tag || serverData.tag_id; // Sprawdź obie możliwe nazwy pola
    if (tagSyncId) {
      const tag = await this.findTagBySyncId(database, tagSyncId);
      if (tag) {
        deserializedData.tagId = tag.id;
      } else {
        // Rzuć błąd, jeśli tag nie został znaleziony
        throw new Error(`[DB ${this.table}] Tag with sync_id ${tagSyncId} not found during deserialization for RecipeTag.`);
      }
      // Usuń pole, z którego wzięliśmy syncId (po konwersji mogło to być 'tag' lub 'tagId')
      delete deserializedData.tag;
      delete deserializedData.tagId;
    }

    return deserializedData;
  }

  // Implementacja createFromSyncData dla klasy RecipeTag
  static async createFromSyncData<T extends SyncModel>(
    this: typeof RecipeTag,
    database: Database,
    deserializedData: Record<string, any>,
    syncId: string
  ): Promise<T> {

    // Pobierz recipeId i tagId bezpośrednio z deserializedData (wynik działania RecipeTag.deserialize)
    const recipeId = deserializedData.recipeId as string | undefined;
    const tagId = deserializedData.tagId as string | undefined;

    // Usuwamy tę walidację, ponieważ błąd jest rzucany już w deserialize
    // if (!recipeId || !tagId) {
    //   // Jeśli deserialize nie znalazło któregoś obiektu i nie ustawiło ID, rzuć błąd
    //   throw new Error(`Cannot create recipe tag ${syncId} without valid recipeId and tagId.`);
    // }
    

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

    // Wywołaj istniejącą metodę RecipeTag.create, przekazując wszystkie dane
    const newRecipeTag = await (RecipeTag.create as any)(
      database,
      recipeId!, // Dodajemy '!' bo wiemy, że deserialize rzuciłoby błąd, gdyby było undefined
      tagId!,    // Dodajemy '!' bo wiemy, że deserialize rzuciłoby błąd, gdyby było undefined
      // Przekaż pola synchronizacji jawnie
      syncId,
      syncStatus,
      lastUpdate,
      isDeleted
    );

    return newRecipeTag as unknown as T;
  }

  // Override prepareForPush to properly handle relations
  serialize(): Record<string, any> {
    // Get base data from parent class
    const baseData = super.serialize();
        
    baseData.recipe = this.recipe.syncId;
    baseData.tag = this.tag.syncId;
    
    return baseData;
  }
}
