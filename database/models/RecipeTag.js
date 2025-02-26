import { Model } from '@nozbe/watermelondb'
import { field, relation } from '@nozbe/watermelondb/decorators'

export default class RecipeTag extends Model {
  static table = 'recipe_tags'
  static associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' },
    tags: { type: 'belongs_to', key: 'tag_id' }
  }

  @field('recipe_id') recipeId
  @field('tag_id') tagId

  // Relations to access the related Recipe and Tag
  @relation('recipes', 'recipe_id') recipe
  @relation('tags', 'tag_id') tag
} 