import { field, text, children} from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { Observable, from, of } from 'rxjs'
import { Database } from '@nozbe/watermelondb'
import { map, switchMap } from 'rxjs/operators'
import SyncModel from './SyncModel'
import RecipeTag from './RecipeTag'
import AuthService from '../../app/services/auth/authService'
import { v4 as uuidv4 } from 'uuid'

export default class Tag extends SyncModel {
  static table = 'tags'
  static associations = {
    recipe_tags: { type: 'has_many' as const, foreignKey: 'tag_id' }
  }

  // Fields specific to Tag
  @field('order') order!: number
  @text('name') name!: string
  // Children relation to access recipe_tags
  @children('recipe_tags') recipeTags!: Observable<RecipeTag[]>

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
  static async create(
    database: Database, 
    name: string,
    order?: number,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: string,
    isDeleted?: boolean
  ): Promise<Tag> {
    try {
      // If no order is provided, get the next available order
      if (order === undefined) {
        const lastTag = await database
          .get<Tag>('tags')
          .query(Q.sortBy('order', Q.desc), Q.take(1))
          .fetch();
        
        order = lastTag.length > 0 ? lastTag[0].order + 1 : 0;
      }
      
      // Use the parent SyncModel.create method
      return await SyncModel.create.call(
        this as unknown as (new () => SyncModel) & typeof SyncModel,
        database,
        (record: SyncModel) => {
          const tag = record as Tag;
          
          // Set tag-specific fields
          tag.name = name.trim();
          tag.order = order as number;
          
          // Set optional SyncModel fields if provided
          if (syncId !== undefined) tag.syncId = syncId;
          if (syncStatusField !== undefined) tag.syncStatusField = syncStatusField;
          if (lastUpdate !== undefined) tag.lastUpdate = lastUpdate;
          if (isDeleted !== undefined) tag.isDeleted = isDeleted;
        }
      ) as Tag;
    } catch (error) {
      console.error(`[DB Tag] Error creating tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Static update method
  static async update(
    database: Database,
    tagId: string,
    name?: string,
    order?: number,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: string,
    isDeleted?: boolean
  ): Promise<Tag | null> {
    try {
      const tag = await database
        .get<Tag>('tags')
        .find(tagId);
      
      if (!tag) {
        console.log(`[DB Tag] Tag with id ${tagId} not found`);
        return null;
      }
      
      console.log(`[DB Tag] Updating tag ${tagId} with provided fields`);
      
      // Use the update method directly from the model instance
      await tag.update(record => {
        // Update only provided fields
        if (name !== undefined) record.name = name.trim();
        if (order !== undefined) record.order = order;
        
        // Update SyncModel fields if provided
        if (syncId !== undefined) record.syncId = syncId;
        if (syncStatusField !== undefined) record.syncStatusField = syncStatusField;
        if (lastUpdate !== undefined) record.lastUpdate = lastUpdate;
        if (isDeleted !== undefined) record.isDeleted = isDeleted;
      });
      
      console.log(`[DB Tag] Successfully updated tag ${tagId}`);
      return tag;
    } catch (error) {
      console.error(`[DB Tag] Error updating tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Override markAsDeleted to also delete related recipe_tags
  async markAsDeleted(): Promise<void> {
    try {
      // Get all related recipe_tags before marking tag as deleted
      const relatedRecipeTags = await this.collections
        .get<RecipeTag>('recipe_tags')
        .query(Q.where('tag_id', this.id))
        .fetch();

      console.log(`[DB ${this.table}] Marking tag ${this.id} and ${relatedRecipeTags.length} related recipe_tags as deleted`);

      await Tag.update(
        this.database,
        this.id,
        undefined, // name - keep existing
        undefined, // order - keep existing
        undefined, // syncId - keep existing
        undefined, // syncStatusField
        undefined, // lastUpdate
        true       // isDeleted - mark as deleted
      );

      for (const recipeTag of relatedRecipeTags) {
        await recipeTag.markAsDeleted();
      }
      
      console.log(`[DB ${this.table}] Successfully marked tag ${this.id} and ${relatedRecipeTags.length} related recipe_tags as deleted`);
    } catch (error) {
      console.error(`[DB ${this.table}] Error marking tag and related recipe_tags as deleted: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}