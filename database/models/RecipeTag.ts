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

  // Instance method to set relations from server object
  async setRelations(serverObject: Record<string, any>): Promise<Record<string, any>> {
    console.log(`[DB ${this.table}] Setting relations for recipe tag with id: ${this.id}`);
    
    // Call the static implementation directly
    return await RecipeTag.setRelations(serverObject, this.database);
  }

  // Helper method to create a recipe tag
  static async create(
    database: Database,
    recipeId: string,
    tagId: string,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: string,
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
    lastUpdate?: string,
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

  // Override markAsDeleted for consistent implementation
  async markAsDeleted(): Promise<void> {
    try {
      console.log(`[DB ${this.table}] Marking recipe tag ${this.id} as deleted`);
      
      // Use the static update method to mark as deleted
      await RecipeTag.update(
        this.database,
        this.id,
        undefined, // recipeId - keep existing
        undefined, // tagId - keep existing
        undefined, // syncId - keep existing
        undefined, // syncStatusField - will be set automatically
        undefined, // lastUpdate - will be set automatically
        true      // isDeleted - mark as deleted
      );
      
      console.log(`[DB ${this.table}] Successfully marked recipe tag ${this.id} as deleted`);
    } catch (error) {
      console.error(`[DB ${this.table}] Error marking recipe tag as deleted: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Override setRelations to handle recipe and tag relations
  static async setRelations<T extends SyncModel>(
    serverObject: Record<string, any>,
    database: Database
  ): Promise<Record<string, any>> {
    // Call the parent method
    const result = await SyncModel.setRelations(serverObject, database);
    
    // We expect serverObject to have recipe and tag properties with sync_ids
    const recipeSyncId = serverObject.recipe;
    const tagSyncId = serverObject.tag;
    
    // Store the found IDs to use when creating/updating the record
    let recipeLocalId = null;
    let tagLocalId = null;
    
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
    
    // Process tag relation if sync_id is provided
    if (tagSyncId) {
      // Find the tag with the given sync_id
      const tag = await this.findTagBySyncId(database, tagSyncId);
      if (tag) {
        // Store the local ID for use in createAsSynced or update
        tagLocalId = tag.id;
        // Add to processed data directly in snake_case (for createAsSynced)
        result.tag_id = tag.id;
      } else {
        console.log(`[DB ${this.table}] Warning: Tag with syncId ${tagSyncId} not found`);
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
    // Extract values from server data
    const recipeId = serverData.recipe_id;
    const tagId = serverData.tag_id;
    const syncId = serverData.sync_id;
    const lastUpdate = serverData.last_update;
    const isDeleted = serverData.is_deleted || false;
    
    // Use SyncModel.create directly (instead of SyncModel.createAsSynced)
    // This gives us more control over all fields in a single operation
    return await SyncModel.create.call(
      this,
      database,
      (record: SyncModel) => {
        const recipeTag = record as RecipeTag;
        
        // Set all fields from server data
        recipeTag.syncId = syncId;
        recipeTag.syncStatusField = 'synced';
        recipeTag.lastUpdate = lastUpdate; // Preserve server timestamp
        recipeTag.isDeleted = isDeleted;
        recipeTag.recipeId = recipeId;
        recipeTag.tagId = tagId;
      }
    ) as T;
  }

  // Override prepareForPush to properly handle relations
  prepareForPush(): Record<string, any> {
    // Get base data from parent class
    const baseData = super.prepareForPush();
        
    baseData.recipe = this.recipe.syncId;
    baseData.tag = this.tag.syncId;
    
    return baseData;
  }
}
