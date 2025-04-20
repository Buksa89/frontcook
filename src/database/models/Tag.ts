import { Model } from '@nozbe/watermelondb';
import { field, text, date, children, lazy, writer } from '@nozbe/watermelondb/decorators';
import type { Query, Relation, Associations } from '@nozbe/watermelondb';
import type RecipeTag from './RecipeTag'; // Zmieniono na RecipeTag

export default class Tag extends Model {
  static table = 'tags'; // Zgodnie ze schematem

  static associations: Associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'tag_id' }, // Zgodnie ze schematem tabeli pośredniczącej
  };

  @field('user_id') userId?: string | null;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('name') name!: string;
  @field('order') order!: number;

  @lazy @children('recipe_tags') recipeTags!: Query<RecipeTag>; // Zmieniono na RecipeTag

  // TODO: Dodać metody statyczne i instancyjne później
}