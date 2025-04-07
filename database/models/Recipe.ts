import { field, text, children, lazy, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { associations } from '@nozbe/watermelondb'
import { Observable, from } from 'rxjs'
import { Database } from '@nozbe/watermelondb'
import SyncModel from './SyncModel'
import RecipeTag from './RecipeTag'
import Ingredient from './Ingredient'
import RecipeImage from './RecipeImage'
import { switchMap } from 'rxjs/operators'
import { Model } from '@nozbe/watermelondb'
import { v4 as uuidv4 } from 'uuid'
import AuthService from '../../app/services/auth/authService'

interface RecipeData {
  name: string;
  description?: string;
  prepTime?: string;
  totalTime?: string;
  servings?: string;
  ingredients: string;
  instructions: string;
  notes?: string;
  nutrition?: string;
  video?: string;
  source?: string;
  selectedTags?: any[];
  image?: string | null;
}

export default class Recipe extends SyncModel {
  static table = 'recipes'
  static associations = {
    recipe_tags: { type: 'has_many' as const, foreignKey: 'recipe_id' },
    ingredients: { type: 'has_many' as const, foreignKey: 'recipe_id' }
  }

  // Fields specific to Recipe
  @text('name') name!: string
  @text('description') description!: string | null
  @text('image') image!: string | null
  @field('rating') rating!: number
  @field('is_approved') isApproved!: boolean
  @field('prep_time') prepTime!: number
  @field('total_time') totalTime!: number
  @field('servings') servings!: number
  @text('instructions') instructions!: string
  @text('notes') notes!: string | null
  @text('nutrition') nutrition!: string | null
  @text('video') video!: string | null
  @text('source') source!: string | null

  // Metoda do pobierania obrazu z RecipeImage na podstawie syncId
  async getImageFromRecipeImage(): Promise<string | null> {
    try {
      if (!this.syncId) {
        return null;
      }

      const recipeImages = await this.database
        .get<RecipeImage>('recipe_images')
        .query(
          Q.and(
            Q.where('sync_id', this.syncId),
            Q.where('is_deleted', false)
          )
        )
        .fetch();

      if (recipeImages.length === 0) {
        return this.image;
      }
      
      return recipeImages[0].image || null;
    } catch (error) {
      console.error(`Error in Recipe.getImageFromRecipeImage for Recipe ID ${this.id}:`, error);
      return null;
    }
  }
  
  // Metoda do pobierania miniatury z RecipeImage na podstawie syncId
  async getThumbnailFromRecipeImage(): Promise<string | null> {
    try {
      if (!this.syncId) {
        return null;
      }

      const recipeImages = await this.database
        .get<RecipeImage>('recipe_images')
        .query(
          Q.and(
            Q.where('sync_id', this.syncId),
            Q.where('is_deleted', false)
          )
        )
        .fetch();

      if (recipeImages.length === 0) {
        return null;
      }
      
      return recipeImages[0].thumbnail || null;
    } catch (error) {
      console.error(`Error in Recipe.getThumbnailFromRecipeImage for Recipe ID ${this.id}:`, error);
      return null;
    }
  }

  // Children relations
  @children('recipe_tags') recipeTags!: Observable<RecipeTag[]>
  @children('ingredients') ingredients!: Observable<Ingredient[]>

  // Query methods
  static observeAll(database: Database): Observable<Recipe[]> {
    return from(AuthService.getActiveUser()).pipe(
      switchMap(activeUser => 
        database
          .get<Recipe>('recipes')
          .query(
            Q.and(
              Q.where('owner', activeUser),
              Q.where('is_deleted', false),
              Q.where('is_approved', true)
            )
          )
          .observe()
      )
    );
  }

  // Create method following the ShoppingItem and Ingredient pattern
  static async create(
    database: Database,
    name: string,
    instructions: string,
    description: string | null = null,
    image: string | null = null,
    rating: number = 0,
    isApproved: boolean = true,
    prepTime: number = 0,
    totalTime: number = 0,
    servings: number = 1,
    notes: string | null = null,
    nutrition: string | null = null,
    video: string | null = null,
    source: string | null = null,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: Date,
    isDeleted?: boolean
  ): Promise<Recipe> {
    try {
      console.log(`[DB ${this.table}] Creating new recipe ${name}`);
      
      // Use the parent SyncModel.create method
      return await SyncModel.create.call(
        this as unknown as (new () => SyncModel) & typeof SyncModel,
        database,
        (record: SyncModel) => {
          const recipe = record as Recipe;
          
          // Set recipe-specific fields
          recipe.name = name;
          recipe.instructions = instructions;
          recipe.description = description;
          recipe.image = image;
          recipe.rating = rating;
          recipe.isApproved = isApproved;
          recipe.prepTime = prepTime;
          recipe.totalTime = totalTime;
          recipe.servings = servings;
          recipe.notes = notes;
          recipe.nutrition = nutrition;
          recipe.video = video;
          recipe.source = source;
          
          // Set optional SyncModel fields if provided
          if (syncId !== undefined) recipe.syncId = syncId;
          if (syncStatusField !== undefined) recipe.syncStatusField = syncStatusField;
          if (lastUpdate !== undefined) recipe.lastUpdate = lastUpdate;
          if (isDeleted !== undefined) recipe.isDeleted = isDeleted;
        }
      ) as Recipe;
    } catch (error) {
      console.error(`[DB ${this.table}] Error creating recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  // Helper method to save a recipe (create or update)
  static async upsertByManagement(database: Database, data: RecipeData, id?: string): Promise<Recipe> {
    try {
      console.log(`[DB ${this.table}] Saving recipe ${data.name}`);
      let recipe: Recipe;
      let existingRecipe: Recipe | null = null;
      
      // Check if we have an id, which would indicate an existing recipe
      if (id) {
        try {
          existingRecipe = await database.get<Recipe>('recipes').find(id);
          console.log(`[DB ${this.table}] Found existing recipe with id ${id}`);
        } catch (error) {
          console.log(`[DB ${this.table}] Recipe with id ${id} not found, will create new`);
          existingRecipe = null;
        }
      }

      if (existingRecipe) {
        // Update existing recipe
        await existingRecipe.update(record => {
          record.name = data.name;
          record.instructions = data.instructions;
          record.description = data.description || null;
          record.prepTime = parseInt(data.prepTime || '0');
          record.totalTime = parseInt(data.totalTime || '0');
          record.servings = parseInt(data.servings || '1') || 1;
          record.notes = data.notes || null;
          record.nutrition = data.nutrition || null;
          record.video = data.video || null;
          record.source = data.source || null;
        });

        recipe = existingRecipe;

        // Handle tags update
        if (data.selectedTags) {
          const existingTags = await database
            .get<RecipeTag>('recipe_tags')
            .query(
              Q.and(
                Q.where('recipe_id', recipe.id),
                Q.where('is_deleted', false)
              )
            )
            .fetch();

          // Find tags to remove and mark them as deleted
          const tagsToRemove = existingTags.filter(rt => 
            !data.selectedTags?.some(tag => tag.id === rt.tagId)
          );

          // Mark each tag to remove as deleted using markAsDeleted
          for (const recipeTag of tagsToRemove) {
            await recipeTag.markAsDeleted();
          }

          // Add new tags
          const existingTagIds = existingTags.map(rt => rt.tagId);
          const newTags = data.selectedTags.filter(tag => 
            !existingTagIds.includes(tag.id)
          );

          // Create each new tag using RecipeTag.create
          for (const tag of newTags) {
            await RecipeTag.create(
              database,
              recipe.id,
              tag.id
            );
          }
        }
        
        // Handle ingredients for existing recipe - first mark existing ones as deleted
        const existingIngredients = await database
          .get<Ingredient>('ingredients')
          .query(
            Q.and(
              Q.where('recipe_id', recipe.id),
              Q.where('is_deleted', false)
            )
          )
          .fetch();
        
        for (const ingredient of existingIngredients) {
          await ingredient.markAsDeleted();
        }
        
        console.log(`[DB ${this.table}] Marked ${existingIngredients.length} existing ingredients as deleted for recipe ${recipe.id}`);
        
      } else {
        // Create new recipe using our static create method
        recipe = await Recipe.create(
          database,
          data.name,
          data.instructions,
          data.description || null,
          null, // No image for new recipes
          0, // Default rating for new recipes
          true, // New recipes are approved by default
          parseInt(data.prepTime || '0'), // Default to 0 if not provided
          parseInt(data.totalTime || '0'), // Default to 0 if not provided
          parseInt(data.servings || '1') || 1, // Default to 1 if not provided or conversion fails
          data.notes || null,
          data.nutrition || null,
          data.video || null,
          data.source || null
        );

        // Create tag relationships for new recipe
        if (data.selectedTags) {
          for (const tag of data.selectedTags) {
            await RecipeTag.create(
              database,
              recipe.id,
              tag.id
            );
          }
        }
      }

      // Handle ingredients
      await Ingredient.createIngredientsFromText(
        database,
        recipe.id,
        data.ingredients
      );
      
      // Handle recipe image if it exists and recipe has syncId
      if (data.image && recipe.syncId) {
        try {
          const recipeImage = await RecipeImage.upsert(
            database,
            recipe.syncId,
            data.image
          );
          
          if (recipeImage) {
          } else {
            console.error(`Failed RecipeImage.upsert for Sync ID: ${recipe.syncId}`);
          }
        } catch (error) {
          console.error(`Error during RecipeImage.upsert call for Sync ID ${recipe.syncId}:`, error);
        }
      } else if (data.image === null && recipe.syncId) {
        // If image was removed, update the RecipeImage record
        try {
          const existingRecipeImages = await database.get<RecipeImage>('recipe_images')
            .query(Q.where('sync_id', recipe.syncId))
            .fetch();
            
          if (existingRecipeImages.length > 0) {
            const imgToDelete = existingRecipeImages[0];
            await imgToDelete.update(record => {
              record.image = undefined;
              record.thumbnail = undefined;
            });
          }
        } catch (error) {
          console.error(`Error removing recipe image for Sync ID ${recipe.syncId}:`, error);
        }
      }

      // Approve recipe if it's not approved yet and it's an update
      if (existingRecipe && !existingRecipe.isApproved) {
        await recipe.toggleApproval();
        console.log(`[DB ${this.table}] Approved recipe ${recipe.id}`);
      }

      console.log(`[DB ${this.table}] Successfully saved recipe ${recipe.id} (${recipe.name})`);
      return recipe;
    } catch (error) {
      console.error(`[DB ${this.table}] Error saving recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async markAsDeleted(): Promise<void> {
    try {
      // Get all related records before marking recipe as deleted
      const [relatedRecipeTags, relatedIngredients] = await Promise.all([
        this.collections
          .get<RecipeTag>('recipe_tags')
          .query(Q.where('recipe_id', this.id))
          .fetch(),
        this.collections
          .get<Ingredient>('ingredients')
          .query(Q.where('recipe_id', this.id))
          .fetch()
      ]);

      // First mark recipe as deleted using the parent class markAsDeleted method
      await super.markAsDeleted();
      
      // Now mark all related records as deleted using their markAsDeleted methods
      await Promise.all([
        // Mark all recipe tags as deleted
        ...relatedRecipeTags.map(recipeTag => recipeTag.markAsDeleted()),
        // Mark all ingredients as deleted
        ...relatedIngredients.map(ingredient => ingredient.markAsDeleted())
      ]);
      
      console.log(`[DB ${this.table}] Successfully marked recipe ${this.id} and related records as deleted (${relatedRecipeTags.length} recipe_tags, ${relatedIngredients.length} ingredients)`);
    } catch (error) {
      console.error(`[DB ${this.table}] Error marking recipe and related records as deleted: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Writer methods
  async updateRating(newRating: number): Promise<void> {
    try {
      console.log(`[DB ${this.table}] Updating recipe ${this.id} rating to ${newRating}`);
      await this.update(record => {
        record.rating = newRating;
      });
      console.log(`[DB ${this.table}] Successfully updated recipe ${this.id} rating`);
    } catch (error) {
      console.error(`[DB ${this.table}] Error updating recipe rating: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async toggleApproval(): Promise<void> {
    try {
      const newApprovalState = !this.isApproved;
      console.log(`[DB ${this.table}] Toggling recipe ${this.id} approval to ${newApprovalState}`);
      await this.update(record => {
        record.isApproved = newApprovalState;
      });
      console.log(`[DB ${this.table}] Successfully toggled recipe ${this.id} approval`);
    } catch (error) {
      console.error(`[DB ${this.table}] Error toggling recipe approval: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 