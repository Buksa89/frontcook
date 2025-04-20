import { Model } from '@nozbe/watermelondb';
import {
  field,
  text,
  relation,
  immutableRelation,
  date,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Relation, Associations } from '@nozbe/watermelondb';
import type Recipe from './Recipe';

export default class Ingredient extends Model {
  static table = 'ingredients';
  static associations: Associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' },
  };

  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @field('recipe_id') recipeId!: string;
  @text('amount') amount?: string | null; // Zmieniono na text
  @text('unit') unit?: string | null;
  @text('name') name!: string;
  @text('type') type?: string | null;
  @field('order') order!: number;
  @text('original_str') originalStr?: string | null;

  @immutableRelation('recipes', 'recipe_id') recipe!: Relation<Recipe>;

  // TODO: Dodać metody statyczne i instancyjne później
}