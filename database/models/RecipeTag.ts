import { field, relation } from '@nozbe/watermelondb/decorators'
import { associations } from '@nozbe/watermelondb'
import Recipe from './Recipe'
import Tag from './Tag'
import BaseModel from './BaseModel'
import { SyncItemType, RecipeTagSync } from '../../app/api/sync'

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

  serializeFromApi(item: SyncItemType): void {
    if (item.object_type !== 'recipe_tag') {
      throw new Error(`Invalid object type for RecipeTag: ${item.object_type}`);
    }
    super.serializeFromApi(item);
    const recipeTagItem = item as RecipeTagSync;
    
    this.recipeId = recipeTagItem.recipe_id;
    this.tagId = recipeTagItem.tag_id;
  }
} 