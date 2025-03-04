import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'
import { SyncStatus } from '@nozbe/watermelondb/Model'
import { Q } from '@nozbe/watermelondb'

export default class BaseModel extends Model {
  @field('sync_status') syncStatus!: SyncStatus
  @field('last_sync') lastSync!: string
  @field('is_local') isLocal!: boolean
  @text('owner') owner!: string | null
  @field('is_deleted') isDeleted!: boolean

  // Helper methods for sync status
  get isPending(): boolean {
    return this.syncStatus === 'pending'
  }

  get isSynced(): boolean {
    return this.syncStatus === 'synced'
  }

  get hasConflict(): boolean {
    return this.syncStatus === 'conflict'
  }

  // Helper method to format last sync date
  get lastSyncDate(): Date | null {
    return this.lastSync ? new Date(this.lastSync) : null
  }

  // Helper method to mark record and its related records as deleted
  async markAsDeleted(cascade: boolean = true): Promise<void> {
    try {
      console.log(`[DB ${this.table}] Marking record ${this.id} as deleted (cascade: ${cascade})`);
      await this.database.write(async () => {
        // Mark this record as deleted
        await this.update(() => {
          this.isDeleted = true;
          this.syncStatus = 'pending';
          this.lastSync = new Date().toISOString();
          this.isLocal = true;
        });

        if (cascade) {
          // Handle cascade deletion based on model type
          switch (this.table) {
            case 'recipes':
              // Mark all related ingredients and recipe_tags as deleted
              const [ingredients, recipeTags] = await Promise.all([
                this.database.get('ingredients')
                  .query(Q.where('recipe_id', this.id))
                  .fetch(),
                this.database.get('recipe_tags')
                  .query(Q.where('recipe_id', this.id))
                  .fetch()
              ]);
              
              // Mark ingredients as deleted
              for (const ingredient of ingredients) {
                await ingredient.update(() => {
                  ingredient.isDeleted = true;
                  ingredient.syncStatus = 'pending';
                  ingredient.lastSync = new Date().toISOString();
                  ingredient.isLocal = true;
                });
              }

              // Mark recipe_tags as deleted
              for (const recipeTag of recipeTags) {
                await recipeTag.update(() => {
                  recipeTag.isDeleted = true;
                  recipeTag.syncStatus = 'pending';
                  recipeTag.lastSync = new Date().toISOString();
                  recipeTag.isLocal = true;
                });
              }
              break;

            case 'tags':
              // Mark all related recipe_tags as deleted
              const relatedRecipeTags = await this.database.get('recipe_tags')
                .query(Q.where('tag_id', this.id))
                .fetch();
              
              // Mark recipe_tags as deleted
              for (const recipeTag of relatedRecipeTags) {
                await recipeTag.update(() => {
                  recipeTag.isDeleted = true;
                  recipeTag.syncStatus = 'pending';
                  recipeTag.lastSync = new Date().toISOString();
                  recipeTag.isLocal = true;
                });
              }
              break;
          }
        }
      });
    } catch (error) {
      console.error(`[DB ${this.table}] Error marking record as deleted: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 