import { Model } from '@nozbe/watermelondb';
import {
  associations,
  children,
  date,
  field,
  immutableRelation,
  lazy,
  relation,
  text,
  writer,
} from '@nozbe/watermelondb/decorators';
import type { Query, Relation, Database, Collection, Associations } from '@nozbe/watermelondb';
import type RecipeTag from './RecipeTag'; // Zmieniono na RecipeTag
import type Ingredient from './Ingredient';
// Importuj RecipeImageLocal, bo będzie używany w logice pobierania ścieżek
import type RecipeImageLocal from './RecipeImageLocal';

export default class Recipe extends Model {
  static table = 'recipes';

  static associations: Associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'recipe_id' }, // Zgodnie ze schematem tabeli pośredniczącej
    ingredients: { type: 'has_many', foreignKey: 'recipe_id' },
    // Nie ma bezpośredniej relacji do RecipeImageLocal w modelu Recipe
  };

  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('name') name!: string;
  @text('description') description?: string | null;
  @field('rating') rating!: number;
  @field('is_approved') isApproved!: boolean;
  @field('prep_time') prepTime?: number | null;
  @field('total_time') totalTime?: number | null;
  @field('servings') servings?: number | null;
  @text('instructions') instructions!: string;
  @text('notes') notes?: string | null;
  @text('nutrition') nutrition?: string | null;
  @text('video') video?: string | null; // Zmieniono z videoUrl
  @text('source') source?: string | null; // Zmieniono z sourceUrl
  @text('image_url') imageUrl?: string | null; // Dodano pole image_url

  @lazy @children('recipe_tags') recipeTags!: Query<RecipeTag>; // Zmieniono na RecipeTag
  @lazy @children('ingredients') ingredients!: Query<Ingredient>;

  // TODO: Dodać metody statyczne i instancyjne później
  // TODO: Dodać metodę instancji do pobierania RecipeImageLocal
}