import { field, text, relation } from '@nozbe/watermelondb/decorators'
import { Associations } from '@nozbe/watermelondb'
import BaseModel from './BaseModel'
import Recipe from './Recipe'

export default class Ingredient extends BaseModel {
  static table = 'ingredients'
  static associations: Associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' }
  }

  @field('remote_id') remoteId!: string | null
  @field('amount') amount!: number | null
  @text('unit') unit!: string | null
  @text('name') name!: string
  @text('type') type!: string | null
  @field('recipe_id') recipeId!: string
  @field('order') order!: number
  @text('original_str') originalStr!: string

  // Relation to access the related Recipe
  @relation('recipes', 'recipe_id') recipe!: Recipe
} 