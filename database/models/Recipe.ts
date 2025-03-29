import { field, text, children, lazy, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { associations } from '@nozbe/watermelondb'
import { Observable, from } from 'rxjs'
import { Database } from '@nozbe/watermelondb'
import SyncModel from './SyncModel'
import RecipeTag from './RecipeTag'
import Ingredient from './Ingredient'
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
  @field('rating') rating!: number | null
  @field('is_approved') isApproved!: boolean
  @field('prep_time') prepTime!: number | null
  @field('total_time') totalTime!: number | null
  @field('servings') servings!: number | null
  @text('instructions') instructions!: string
  @text('notes') notes!: string | null
  @text('nutrition') nutrition!: string | null
  @text('video') video!: string | null
  @text('source') source!: string | null

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
    rating: number | null = 0,
    isApproved: boolean = true,
    prepTime: number | null = 0,
    totalTime: number | null = 0,
    servings: number | null = 1,
    notes: string | null = null,
    nutrition: string | null = null,
    video: string | null = null,
    source: string | null = null,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: string,
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
  
  // Update method following the ShoppingItem and Ingredient pattern
  static async update(
    database: Database,
    recipeId: string,
    name?: string,
    instructions?: string,
    description?: string | null,
    image?: string | null,
    rating?: number | null,
    isApproved?: boolean,
    prepTime?: number | null,
    totalTime?: number | null,
    servings?: number | null,
    notes?: string | null,
    nutrition?: string | null,
    video?: string | null,
    source?: string | null,
    // Optional SyncModel fields
    syncId?: string,
    syncStatusField?: 'pending' | 'synced' | 'conflict',
    lastUpdate?: string,
    isDeleted?: boolean
  ): Promise<Recipe | null> {
    try {
      const recipe = await database
        .get<Recipe>('recipes')
        .find(recipeId);
      
      if (!recipe) {
        console.log(`[DB ${this.table}] Recipe with id ${recipeId} not found`);
        return null;
      }
      
      console.log(`[DB ${this.table}] Updating recipe ${recipeId} with provided fields`);
      
      // Use the update method directly from the model instance
      await recipe.update(record => {
        // Update only provided fields
        if (name !== undefined) record.name = name;
        if (instructions !== undefined) record.instructions = instructions;
        if (description !== undefined) record.description = description;
        if (image !== undefined) record.image = image;
        if (rating !== undefined) record.rating = rating;
        if (isApproved !== undefined) record.isApproved = isApproved;
        if (prepTime !== undefined) record.prepTime = prepTime;
        if (totalTime !== undefined) record.totalTime = totalTime;
        if (servings !== undefined) record.servings = servings;
        if (notes !== undefined) record.notes = notes;
        if (nutrition !== undefined) record.nutrition = nutrition;
        if (video !== undefined) record.video = video;
        if (source !== undefined) record.source = source;
        
        // Update SyncModel fields if provided
        if (syncId !== undefined) record.syncId = syncId;
        if (syncStatusField !== undefined) record.syncStatusField = syncStatusField;
        if (lastUpdate !== undefined) record.lastUpdate = lastUpdate;
        if (isDeleted !== undefined) record.isDeleted = isDeleted;
      });
      
      console.log(`[DB ${this.table}] Successfully updated recipe ${recipeId}`);
      return recipe;
    } catch (error) {
      console.error(`[DB ${this.table}] Error updating recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Helper method to save a recipe (create or update)
  static async saveRecipe(database: Database, data: RecipeData, existingRecipe?: Recipe): Promise<Recipe> {
    try {
      console.log(`[DB ${this.table}] Saving recipe ${data.name} (${existingRecipe ? 'update' : 'create'})`);
      let recipe: Recipe;

      if (existingRecipe) {
        // Update existing recipe using our static update method
        const updatedRecipe = await Recipe.update(
          database,
          existingRecipe.id,
          data.name,
          data.instructions,
          data.description || null,
          existingRecipe.image, // Keep existing image
          existingRecipe.rating, // Keep existing rating
          existingRecipe.isApproved, // Keep approval state
          parseInt(data.prepTime || '0') || 0,
          parseInt(data.totalTime || '0') || 0,
          parseInt(data.servings || '1') || 1,
          data.notes || null,
          data.nutrition || null,
          data.video || null,
          data.source || null
        );

        if (!updatedRecipe) {
          throw new Error(`Failed to update recipe with id ${existingRecipe.id}`);
        }

        recipe = updatedRecipe;

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
        // Create new recipe using our static createRecipe method
        recipe = await Recipe.create(
          database,
          data.name,
          data.instructions,
          data.description || null,
          null, // image
          0, // rating
          true, // isApproved
          parseInt(data.prepTime || '0') || 0,
          parseInt(data.totalTime || '0') || 0,
          parseInt(data.servings || '1') || 1,
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

      // First mark recipe as deleted using the static update method
      await Recipe.update(
        this.database,
        this.id,
        undefined, // name - keep existing
        undefined, // instructions - keep existing
        undefined, // description - keep existing
        undefined, // image - keep existing
        undefined, // rating - keep existing
        undefined, // isApproved - keep existing
        undefined, // prepTime - keep existing
        undefined, // totalTime - keep existing
        undefined, // servings - keep existing
        undefined, // notes - keep existing
        undefined, // nutrition - keep existing
        undefined, // video - keep existing
        undefined, // source - keep existing
        undefined, // syncId - keep existing
        undefined, // syncStatusField - will be set automatically
        undefined, // lastUpdate - will be set automatically
        true       // isDeleted - mark as deleted
      );
      
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
      await Recipe.update(
        this.database,
        this.id,
        undefined, // name - keep existing
        undefined, // instructions - keep existing
        undefined, // description - keep existing
        undefined, // image - keep existing
        newRating, // rating - update to new value
        undefined, // isApproved - keep existing
        undefined, // prepTime - keep existing
        undefined, // totalTime - keep existing
        undefined, // servings - keep existing
        undefined, // notes - keep existing
        undefined, // nutrition - keep existing
        undefined, // video - keep existing
        undefined  // source - keep existing
      );
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
      await Recipe.update(
        this.database,
        this.id,
        undefined, // name - keep existing
        undefined, // instructions - keep existing
        undefined, // description - keep existing
        undefined, // image - keep existing
        undefined, // rating - keep existing
        newApprovalState, // isApproved - toggle value
        undefined, // prepTime - keep existing
        undefined, // totalTime - keep existing
        undefined, // servings - keep existing
        undefined, // notes - keep existing
        undefined, // nutrition - keep existing
        undefined, // video - keep existing
        undefined  // source - keep existing
      );
      console.log(`[DB ${this.table}] Successfully toggled recipe ${this.id} approval`);
    } catch (error) {
      console.error(`[DB ${this.table}] Error toggling recipe approval: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 