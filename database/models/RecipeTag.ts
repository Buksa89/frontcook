import { field, relation } from '@nozbe/watermelondb/decorators'
import { associations } from '@nozbe/watermelondb'
import Recipe from './Recipe'
import Tag from './Tag'
import BaseModel from './BaseModel'
import { SyncItemType, RecipeTagSync } from '../../app/api/sync'
import { Q } from '@nozbe/watermelondb'
import database from '../../database'
import { v4 as uuidv4 } from 'uuid'
import AuthService from '../../app/services/auth/authService'
import { Database } from '@nozbe/watermelondb'
import { Model } from '@nozbe/watermelondb'

export default class RecipeTag extends BaseModel {
  static table = 'recipe_tags'
  static associations = {
    recipes: { type: 'belongs_to' as const, key: 'recipe_id' },
    tags: { type: 'belongs_to' as const, key: 'tag_id' }
  }

  @field('recipe_id') recipeId!: string
  @field('tag_id') tagId!: string

  // Relations to access the related Recipe and Tag
  @relation('recipes', 'recipe_id') recipe!: Recipe
  @relation('tags', 'tag_id') tag!: Tag

  static async createRecipeTag(
    database: Database,
    recordUpdater: (record: RecipeTag) => void
  ): Promise<RecipeTag> {
    try {
      const collection = database.get<RecipeTag>('recipe_tags');
      const activeUser = await AuthService.getActiveUser();
      
      const record = await collection.create((record: any) => {
        console.log(`[DB ${this.table}] Creating new recipe tag`);
        
        // Initialize base fields first
        record.synchStatus = 'pending';
        record.lastUpdate = new Date().toISOString();
        record.isLocal = true;
        record.isDeleted = false;
        record.syncId = uuidv4();
        record.owner = activeUser;
        
        // Then apply user's updates
        recordUpdater(record as RecipeTag);
        console.log(`[DB ${this.table}] New recipe tag created with:`, record._raw);
      });

      return record;
    } catch (error) {
      console.error(`[DB ${this.table}] Error creating recipe tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  static prepareCreateRecipeTag(
    database: Database,
    recordUpdater: (record: RecipeTag) => void
  ): Model {
    try {
      const collection = database.get<RecipeTag>('recipe_tags');
      
      return collection.prepareCreate(async (record: any) => {
        console.log(`[DB ${this.table}] Preparing to create recipe tag`);
        
        // Initialize base fields first
        record.synchStatus = 'pending';
        record.lastUpdate = new Date().toISOString();
        record.isLocal = true;
        record.isDeleted = false;
        record.syncId = uuidv4();
        record.owner = await AuthService.getActiveUser();
        
        // Then apply user's updates
        recordUpdater(record as RecipeTag);
        console.log(`[DB ${this.table}] Recipe tag prepared with:`, record._raw);
      });
    } catch (error) {
      console.error(`[DB ${this.table}] Error preparing recipe tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  serialize(): RecipeTagSync {
    const base = super.serialize();
    return {
      ...base,
      object_type: 'recipe_tag',
      recipe: this.recipe.syncId,  // Use sync_id of the recipe
      tag: this.tag.syncId        // Use sync_id of the tag
    };
  }

  static async deserialize(item: SyncItemType) {
    if (item.object_type !== 'recipe_tag') {
      throw new Error(`Invalid object type for RecipeTag: ${item.object_type}`);
    }

    const baseFields = await BaseModel.deserialize(item);
    const recipeTagItem = item as unknown as RecipeTagSync;
    
    if (!recipeTagItem.recipe || !recipeTagItem.tag) {
      throw new Error(`Missing recipe or tag for recipe_tag ${item.sync_id}`);
    }

    // Find recipe by sync_id
    const recipes = await database.get('recipes').query(
      Q.where('sync_id', recipeTagItem.recipe)
    ).fetch();
    
    if (recipes.length === 0) {
      throw new Error(`Recipe with sync_id ${recipeTagItem.recipe} not found`);
    }

    // Find tag by sync_id
    const tags = await database.get('tags').query(
      Q.where('sync_id', recipeTagItem.tag)
    ).fetch();

    if (tags.length === 0) {
      throw new Error(`Tag with sync_id ${recipeTagItem.tag} not found`);
    }

    return {
      ...baseFields,
      recipe_id: recipes[0].id,
      tag_id: tags[0].id
    };
  }
} 