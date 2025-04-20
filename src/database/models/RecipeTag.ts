import { Model } from '@nozbe/watermelondb';
import {
  field,
  date,
  relation,
  immutableRelation,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Relation, Associations } from '@nozbe/watermelondb';
import type Recipe from './Recipe';
import type Tag from './Tag';

export default class RecipeTag extends Model { // Zmieniono nazwę klasy na RecipeTag
  static table = 'recipe_tags'; // Zgodnie ze schematem tabeli pośredniczącej
  static associations: Associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' },
    tags: { type: 'belongs_to', key: 'tag_id' }, // Zmieniono nazwę relacji na 'tags'
  };

  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @field('recipe_id') recipeId!: string;
  @field('tag_id') tagId!: string;

  @immutableRelation('recipes', 'recipe_id') recipe!: Relation<Recipe>;
  @immutableRelation('tags', 'tag_id') tag!: Relation<Tag>; // Zmieniono nazwę relacji

  // TODO: Dodać metody instancyjne później
}