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
    const baseData = super.getSyncData();
    return {
      ...baseData,
      object_type: 'recipe_tag',
      recipe: this.recipe?.syncId,
      tag: this.tag?.syncId
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
} 