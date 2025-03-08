import { field, text, children, lazy, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { Observable, from } from 'rxjs'
import { Database } from '@nozbe/watermelondb'
import { map, switchMap } from 'rxjs/operators'
import BaseModel from './BaseModel'
import RecipeTag from './RecipeTag'
import { asyncStorageService } from '../../app/services/storage'
import { Model } from '@nozbe/watermelondb'
import { SyncItemType, TagSync } from '../../app/api/sync'

export default class Tag extends BaseModel {
  static table = 'tags'
  static associations = {
    recipe_tags: { type: 'has_many' as const, foreignKey: 'tag_id' }
  }

  @field('order') order!: number
  @text('name') name!: string

  // Children relation to access recipe_tags
  @children('recipe_tags') recipeTags!: Observable<RecipeTag[]>

  serialize(): TagSync {
    const base = super.serialize();
    return {
      ...base,
      object_type: 'tag',
      name: this.name,
      order: this.order
    };
  }

  // Query methods
  static observeAll(database: Database): Observable<Tag[]> {
    return new Observable<Tag[]>(subscriber => {
      let subscription: any;
      
      asyncStorageService.getActiveUser().then(activeUser => {
        subscription = database
          .get<Tag>('tags')
          .query(
            Q.and(
              Q.where('owner', activeUser),
              Q.where('is_deleted', false)
            )
          )
          .observe()
          .pipe(map(tags => tags.sort((a, b) => a.order - b.order)))
          .subscribe(subscriber);
      });

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    });
  }

  // Static method to observe tags for a recipe
  static observeForRecipe(database: Database, recipeId: string): Observable<Tag[]> {
    return from(asyncStorageService.getActiveUser()).pipe(
      switchMap(activeUser => 
        database.get<Tag>('tags')
          .query(
            Q.experimentalJoinTables(['recipe_tags']),
            Q.and(
              Q.where('owner', activeUser),
              Q.where('is_deleted', false),
              Q.on('recipe_tags', 'recipe_id', recipeId)
            )
          )
          .observe()
      )
    );
  }

  // Helper method for creating tags
  static async createTag(database: Database, name: string) {
    return await database.write(async () => {
      const collection = database.get<Tag>('tags');
      const lastTag = await collection
        .query(Q.sortBy('order', Q.desc), Q.take(1))
        .fetch();
      
      const maxOrder = lastTag.length > 0 ? lastTag[0].order : -1;
      
      return await Tag.create(database, record => {
        record.name = name.trim();
        record.order = maxOrder + 1;
      });
    });
  }

  // Override markAsDeleted to also delete related recipe_tags
  async markAsDeleted(cascade: boolean = true): Promise<void> {
    try {
      // Get all related recipe_tags before marking tag as deleted
      const relatedRecipeTags = await this.collections
        .get<RecipeTag>('recipe_tags')
        .query(Q.where('tag_id', this.id))
        .fetch();

      // Mark all related recipe_tags as deleted
      await Promise.all(
        relatedRecipeTags.map(recipeTag => recipeTag.markAsDeleted())
      );

      // Mark the tag itself as deleted
      await super.markAsDeleted();
      
      console.log(`[DB ${this.table}] Successfully marked tag ${this.id} and ${relatedRecipeTags.length} related recipe_tags as deleted`);
    } catch (error) {
      console.error(`[DB ${this.table}] Error marking tag and related recipe_tags as deleted: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Derived fields
  get displayName() {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1).toLowerCase()
  }

  static async deserialize(item: SyncItemType) {
    const baseFields = await BaseModel.deserialize(item);
    const tagItem = item as TagSync;
    
    return {
      ...baseFields,
      name: tagItem.name,
      order: tagItem.order
    };
  }
}