import { Model } from '@nozbe/watermelondb'
import { field, relation } from '@nozbe/watermelondb/decorators'
import { Associations } from '@nozbe/watermelondb'
import Recipe from './Recipe'
import Tag from './Tag'

export default class RecipeTag extends Model {
  static table = 'recipe_tags'
  static associations: Associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' },
    tags: { type: 'belongs_to', key: 'tag_id' }
  }

  @field('recipe_id') recipeId!: string
  @field('tag_id') tagId!: string

  // Relations to access the related Recipe and Tag
  @relation('recipes', 'recipe_id') recipe!: Recipe
  @relation('tags', 'tag_id') tag!: Tag
} 