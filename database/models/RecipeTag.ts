import { field, relation } from '@nozbe/watermelondb/decorators'
import { associations } from '@nozbe/watermelondb'
import Recipe from './Recipe'
import Tag from './Tag'
import BaseModel from './BaseModel'
import { Q } from '@nozbe/watermelondb'
import { v4 as uuidv4 } from 'uuid'
import AuthService from '../../app/services/auth/authService'
import { Database } from '@nozbe/watermelondb'

export default class RecipeTag extends BaseModel {
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

  // Helper method to get sync data for this recipe tag
  getSyncData(): Record<string, any> {
    // Pobierz sync_id przepisu i tagu, jeśli są dostępne
    let recipeSyncId = null;
    let tagSyncId = null;
    
    // Najpierw sprawdź, czy mamy dostęp do obiektów recipe i tag przez relacje
    if (this.recipe) {
      recipeSyncId = this.recipe.syncId;
    }
    
    if (this.tag) {
      tagSyncId = this.tag.syncId;
    }
    
    // Jeśli nie, sprawdź, czy mamy dostęp do obiektów recipe i tag przez pola _recipe i _tag ustawione przez SyncService
    if (!recipeSyncId && (this as any)._recipe) {
      recipeSyncId = (this as any)._recipe.syncId;
    }
    
    if (!tagSyncId && (this as any)._tag) {
      tagSyncId = (this as any)._tag.syncId;
    }
    
    // Jeśli nadal nie mamy sync_id przepisu lub tagu, logujemy informację
    if (!recipeSyncId && this.recipeId) {
      console.log(`[DB ${this.table}] No recipe object available, trying to get sync_id for recipe_id: ${this.recipeId}`);
      // Nie możemy użyć await bezpośrednio w metodzie synchronicznej, więc zwracamy dane bez recipe
      // Pole recipe zostanie dodane w metodzie push w SyncService
    }
    
    if (!tagSyncId && this.tagId) {
      console.log(`[DB ${this.table}] No tag object available, trying to get sync_id for tag_id: ${this.tagId}`);
      // Nie możemy użyć await bezpośrednio w metodzie synchronicznej, więc zwracamy dane bez tag
      // Pole tag zostanie dodane w metodzie push w SyncService
    }
    
    return {
      object_type: 'recipe_tag',
      sync_id: this.syncId,
      last_update: this.lastUpdate,
      is_deleted: this.isDeleted,
      recipe: recipeSyncId,  // Używamy sync_id przepisu
      tag: tagSyncId,        // Używamy sync_id tagu
    };
  }

  // Helper method to create a recipe tag
  static async createRecipeTag(
    database: Database,
    recordUpdater: (record: RecipeTag) => void
  ): Promise<RecipeTag> {
    try {
      console.log(`[DB ${this.table}] Creating new recipe tag`);
      const collection = database.get<RecipeTag>('recipe_tags');
      const activeUser = await AuthService.getActiveUser();
      
      return await database.write(async () => {
        const record = await collection.create((newRecord: RecipeTag) => {
          // Initialize base fields
          newRecord.syncStatus = 'pending';
          newRecord.lastUpdate = new Date().toISOString();
          newRecord.isDeleted = false;
          newRecord.syncId = uuidv4();
          newRecord.owner = activeUser;
          
          // Apply user's updates
          recordUpdater(newRecord);
          console.log(`[DB ${this.table}] New recipe tag created`);
        });

        return record;
      });
    } catch (error) {
      console.error(`[DB ${this.table}] Error creating recipe tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Static method to find recipe tags by recipe ID
  static async findByRecipeId(database: Database, recipeId: string): Promise<RecipeTag[]> {
    return await database
      .get<RecipeTag>('recipe_tags')
      .query(
        Q.and(
          Q.where('recipe_id', recipeId),
          Q.where('is_deleted', false)
        )
      )
      .fetch();
  }

  // Static method to find recipe tags by tag ID
  static async findByTagId(database: Database, tagId: string): Promise<RecipeTag[]> {
    return await database
      .get<RecipeTag>('recipe_tags')
      .query(
        Q.and(
          Q.where('tag_id', tagId),
          Q.where('is_deleted', false)
        )
      )
      .fetch();
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

  // Method to find matching records with recipe and tag sync_id mapping
  static async findMatchingRecordsWithRelations(
    database: Database,
    serverObject: Record<string, any>
  ): Promise<RecipeTag[]> {
    // If this is a recipe_tag
    if (serverObject.object_type === 'recipe_tag') {
      try {
        let canCreate = true;
        
        // Handle recipe sync_id conversion
        if (serverObject.recipe) {
          const recipe = await RecipeTag.findRecipeBySyncId(database, serverObject.recipe);
          
          if (recipe) {
            // Set recipeId to the local ID of the recipe
            serverObject.recipeId = recipe.id;
          } else {
            console.log(`[DB ${this.table}] Recipe with sync_id ${serverObject.recipe} not found yet, will retry later`);
            // Instead of failing immediately, we'll mark that we can't create this object yet
            canCreate = false;
          }
        }
        
        // Handle tag sync_id conversion
        if (serverObject.tag) {
          const tag = await RecipeTag.findTagBySyncId(database, serverObject.tag);
          
          if (tag) {
            // Set tagId to the local ID of the tag
            serverObject.tagId = tag.id;
          } else {
            console.log(`[DB ${this.table}] Tag with sync_id ${serverObject.tag} not found yet, will retry later`);
            // Instead of failing immediately, we'll mark that we can't create this object yet
            canCreate = false;
          }
        }
        
        // If we can't find either the recipe or the tag, we'll return an empty array
        // to indicate this object should be retried later
        if (!canCreate) {
          return [];
        }
      } catch (error) {
        console.log(`[DB ${this.table}] Error finding related objects, will retry later`);
        // Instead of failing, we'll return an empty array to indicate this object should be retried later
        return [];
      }
    }
    
    // Call the base implementation to find matching records
    const records = await BaseModel.findMatchingRecords.call(this as unknown as (new () => BaseModel) & typeof BaseModel, database, serverObject);
    return records as RecipeTag[];
  }
} 