import { Model } from '@nozbe/watermelondb';
import { field, text, immutableRelation } from '@nozbe/watermelondb/decorators';
import type { Relation, associations } from '@nozbe/watermelondb';
import type Recipe from './Recipe';

export default class RecipeImageLocal extends Model {
  static table = 'recipe_images_local';

  static associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' },
  } as const;

  @field('recipe_id') recipeId!: string;
  @text('local_path') localPath?: string | null;
  @text('local_thumbnail_path') localThumbnailPath?: string | null;
  @text('original_remote_url') originalRemoteUrl?: string | null;
  @field('last_processed_timestamp') lastProcessedTimestamp?: number | null;

  @immutableRelation('recipes', 'recipe_id') recipe!: Relation<Recipe>;

  // Brak metod @writer i pól sync
}