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

  // Helper method to get the next order value
  static async getNextOrder(database: Database): Promise<number> {
    try {
      const activeUser = await AuthService.getActiveUser();
      const lastTag = await database
        .get<Tag>('tags')
        .query(
          Q.where('is_deleted', false),
          Q.sortBy('order', Q.desc),
          Q.where('owner', activeUser),
          Q.take(1)
        )
        .fetch();
      
      const maxOrder = lastTag.length > 0 ? lastTag[0].order : -1;
      return maxOrder + 1;
    } catch (error) {
      console.error(`[DB ${this.table}] Error getting next order value: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return Date.now(); // Use timestamp as fallback
    }
  }

  // Helper method for creating tags
  static async create(
    database: Database, 
    name: string,
    order?: number,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: Date,
    isDeleted?: boolean
  ): Promise<Tag> {
    try {
      // If no order is provided, get the next available order
      if (order === undefined) {
        order = await this.getNextOrder(database);
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
      console.error(`[DB ${this.table}] Error creating tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Implementacja createFromSyncData dla klasy Tag
  static async createFromSyncData<T extends SyncModel>(
    this: typeof Tag,
    database: Database,
    deserializedData: Record<string, any>,
  ): Promise<T> {

    // Przygotuj argumenty dla Tag.create na podstawie deserializedData
    const name = deserializedData.name || 'Unnamed Tag'; // Wymagane pole
    // Pole 'order' jest opcjonalne w Tag.create, pobierzmy je z danych, jeśli istnieje
    const order = deserializedData.order !== undefined ? Number(deserializedData.order) : undefined;

    // Przygotuj pola synchronizacji do przekazania
    const syncStatus: 'pending' | 'synced' | 'conflict' = 'synced'; // Nowy z serwera jest 'synced'
    const isDeleted = !!deserializedData.isDeleted;
    const syncId = deserializedData.syncId;
    let lastUpdate: Date | undefined = undefined;
    if ('lastUpdate' in deserializedData && deserializedData.lastUpdate) {
      try {
        lastUpdate = new Date(deserializedData.lastUpdate);
      } catch (e) {
        lastUpdate = new Date(); // Fallback
      }
    } else {
      lastUpdate = new Date(); // Fallback
    }

    // Wywołaj istniejącą metodę Tag.create, przekazując wszystkie dane
    // Używamy 'as any' aby obejść potencjalny błąd lintera (chociaż tutaj sygnatury mogą być bardziej zgodne)
    const newTag = await (Tag.create as any)(
      database,
      name,
      order, // Przekazujemy opcjonalne 'order'
      // Przekaż pola synchronizacji jawnie
      syncId,          // syncId z serwera
      syncStatus,      // 'synced'
      lastUpdate,      // data z serwera lub fallback
      isDeleted        // isDeleted z serwera
    );

    return newTag as unknown as T;
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

      // First mark tag as deleted using the parent class markAsDeleted method
      await super.markAsDeleted();
      
      // Now mark all related recipe_tags as deleted using their markAsDeleted methods
      if (relatedRecipeTags.length > 0) {
        await Promise.all(
          relatedRecipeTags.map(recipeTag => recipeTag.markAsDeleted())
        );
      }
      
      console.log(`[DB ${this.table}] Successfully marked tag ${this.id} and ${relatedRecipeTags.length} related recipe_tags as deleted`);
    } catch (error) {
      console.error(`[DB ${this.table}] Error marking tag and related recipe_tags as deleted: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}