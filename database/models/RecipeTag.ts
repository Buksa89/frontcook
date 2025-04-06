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


  // Override prepareForPush to properly handle relations
  serialize(): Record<string, any> {
    // Get base data from parent class
    const baseData = super.serialize();
        
    baseData.recipe = this.recipe.syncId;
    baseData.tag = this.tag.syncId;
    
    return baseData;
  }
}
