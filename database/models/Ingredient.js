import { Model } from '@nozbe/watermelondb'
import { field, text, relation } from '@nozbe/watermelondb/decorators'

export default class Ingredient extends Model {
  static table = 'ingredients'
  static associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' }
  }

  @field('remote_id') remoteId
  @field('amount') amount
  @text('unit') unit
  @text('name') name
  @text('type') type
  @field('recipe_id') recipeId
  @field('order') order
  @text('original_str') originalStr

  // Relation to access the related Recipe
  @relation('recipes', 'recipe_id') recipe
} 