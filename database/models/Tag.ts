import { field, text, children, lazy, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { Observable, from, of } from 'rxjs'
import { Database } from '@nozbe/watermelondb'
import { map, switchMap } from 'rxjs/operators'
import BaseModel from './BaseModel'
import RecipeTag from './RecipeTag'
import AuthService from '../../app/services/auth/authService'
import { Model } from '@nozbe/watermelondb'
import { v4 as uuidv4 } from 'uuid'

export default class Tag extends BaseModel {
  static table = 'tags'
  static associations = {
    recipe_tags: { type: 'has_many' as const, foreignKey: 'tag_id' }
  }

  // Fields specific to Tag
  @field('order') order!: number
  @text('name') name!: string

  // Children relation to access recipe_tags
  @children('recipe_tags') recipeTags!: Observable<RecipeTag[]>

  // Derived fields
  get displayName() {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1).toLowerCase()
  }

  // Helper method to get sync data for this tag
  getSyncData(): Record<string, any> {
    const baseData = super.getSyncData();
    return {
      ...baseData,
      object_type: 'tag',
      name: this.name,
      order: this.order
    };
  }

  // Query methods
  static observeAll(database: Database): Observable<Tag[]> {
    return new Observable<Tag[]>(subscriber => {
      let subscription: any;
      
      AuthService.getActiveUser().then(activeUser => {
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
    return from(AuthService.getActiveUser()).pipe(
      switchMap(activeUser => {
        // Obserwuj RecipeTag dla danego przepisu
        return database
          .get<RecipeTag>('recipe_tags')
          .query(
            Q.and(
              Q.where('recipe_id', recipeId),
              Q.where('is_deleted', false)
            )
          )
          .observe()
          .pipe(
            // Dla każdej zmiany w kolekcji RecipeTag, pobierz powiązane tagi
            switchMap(recipeTags => {
              if (recipeTags.length === 0) {
                return of([]);
              }
              
              const tagIds = recipeTags.map(rt => rt.tagId);
              
              return database
                .get<Tag>('tags')
                .query(
                  Q.and(
                    Q.where('owner', activeUser),
                    Q.where('is_deleted', false),
                    Q.where('id', Q.oneOf(tagIds))
                  )
                )
                .fetch();
            })
          );
      })
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
      const activeUser = await AuthService.getActiveUser();
      
      return await collection.create((record: Tag) => {
        // Initialize base fields
        record.syncStatus = 'pending';
        record.lastUpdate = new Date().toISOString();
        record.isDeleted = false;
        record.syncId = uuidv4();
        record.owner = activeUser;
        
        // Set tag-specific fields
        record.name = name.trim();
        record.order = maxOrder + 1;
      });
    });
  }

  // Override markAsDeleted to also delete related recipe_tags
  async markAsDeleted(): Promise<void> {
    try {
      await this.database.write(async () => {
        // Get all related recipe_tags before marking tag as deleted
        const relatedRecipeTags = await this.collections
          .get<RecipeTag>('recipe_tags')
          .query(Q.where('tag_id', this.id))
          .fetch();

        // Prepare all operations
        const operations = [
          // Mark tag as deleted
          this.prepareUpdate(() => {
            this.isDeleted = true;
            this.syncStatus = 'pending';
            this.lastUpdate = new Date().toISOString();
          }),
          // Mark all related recipe_tags as deleted
          ...relatedRecipeTags.map(recipeTag => 
            recipeTag.prepareUpdate(() => {
              recipeTag.isDeleted = true;
              recipeTag.syncStatus = 'pending';
              recipeTag.lastUpdate = new Date().toISOString();
            })
          )
        ];

        // Execute all operations in a batch
        await this.database.batch(...operations);
        
        console.log(`[DB ${this.table}] Successfully marked tag ${this.id} and ${relatedRecipeTags.length} related recipe_tags as deleted`);
      });
    } catch (error) {
      console.error(`[DB ${this.table}] Error marking tag and related recipe_tags as deleted: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}