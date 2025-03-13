import { field, text, children, lazy, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { associations } from '@nozbe/watermelondb'
import { Observable, from } from 'rxjs'
import { Database } from '@nozbe/watermelondb'
import BaseModel from './BaseModel'
import RecipeTag from './RecipeTag'
import Ingredient from './Ingredient'
import { switchMap } from 'rxjs/operators'
import { Model } from '@nozbe/watermelondb'
import { SyncItemType, RecipeSync } from '../../app/api/sync'
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

export default class Recipe extends BaseModel {
  static table = 'recipes'
  static associations = {
    recipe_tags: { type: 'has_many' as const, foreignKey: 'recipe_id' },
    ingredients: { type: 'has_many' as const, foreignKey: 'recipe_id' }
  }

  // Query methods
  static observeAll(database: Database): Observable<Recipe[]> {
    return from(AuthService.getActiveUser()).pipe(
      switchMap(activeUser => 
        database
          .get<Recipe>('recipes')
          .query(
            Q.and(
              Q.where('owner', activeUser),
              Q.where('is_deleted', false)
            )
          )
          .observe()
      )
    );
  }

  static async saveRecipe(database: Database, data: RecipeData, existingRecipe?: Recipe): Promise<Recipe> {
    return await database.write(async () => {
      let recipe: Recipe;
      const recipesCollection = database.get<Recipe>('recipes');
      const recipeTagsCollection = database.get<RecipeTag>('recipe_tags');
      let operations: Model[] = [];

      if (existingRecipe) {
        // Update existing recipe
        recipe = await existingRecipe.update(record => {
          record.name = data.name;
          record.description = data.description || null;
          record.prepTime = parseInt(data.prepTime || '0') || 0;
          record.totalTime = parseInt(data.totalTime || '0') || 0;
          record.servings = parseInt(data.servings || '1') || 1;
          record.instructions = data.instructions;
          record.notes = data.notes || null;
          record.nutrition = data.nutrition || null;
          record.video = data.video || null;
          record.source = data.source || null;
        });

        // Handle tags update
        if (data.selectedTags) {
          const existingTags = await recipeTagsCollection
            .query(Q.where('recipe_id', recipe.id))
            .fetch();

          // Find tags to remove
          const tagsToRemove = existingTags.filter(rt => 
            !data.selectedTags?.some(tag => tag.id === rt.tagId)
          );

          operations.push(...tagsToRemove.map(rt => rt.prepareDestroyPermanently()));

          // Add new tags
          const existingTagIds = existingTags.map(rt => rt.tagId);
          const newTags = data.selectedTags.filter(tag => 
            !existingTagIds.includes(tag.id)
          );

          operations.push(
            ...newTags.map(tag => 
              recipeTagsCollection.prepareCreate(rt => {
                rt.recipeId = recipe.id;
                rt.tagId = tag.id;
              })
            )
          );
        }
      } else {
        // Create new recipe
        recipe = await Recipe.createRecipe(database, record => {
          record.name = data.name;
          record.description = data.description || null;
          record.prepTime = parseInt(data.prepTime || '0') || 0;
          record.totalTime = parseInt(data.totalTime || '0') || 0;
          record.servings = parseInt(data.servings || '1') || 1;
          record.instructions = data.instructions;
          record.notes = data.notes || null;
          record.nutrition = data.nutrition || null;
          record.video = data.video || null;
          record.source = data.source || null;
          record.rating = 0;
          record.isApproved = true;
        });

        // Create tag relationships for new recipe
        if (data.selectedTags) {
          operations.push(
            ...data.selectedTags.map(tag => 
              RecipeTag.prepareCreateRecipeTag(database, rt => {
                rt.recipeId = recipe.id;
                rt.tagId = tag.id;
              })
            )
          );
        }
      }

      // Handle ingredients
      const ingredientsOperations = await Ingredient.prepareIngredientsFromText(
        database,
        recipe.id,
        data.ingredients
      );
      operations.push(...ingredientsOperations);

      // Execute all operations in a batch
      if (operations.length > 0) {
        await database.batch(...operations);
      }

      return recipe;
    });
  }

  static async createRecipe(
    database: Database,
    recordUpdater: (record: Recipe) => void
  ): Promise<Recipe> {
    try {
      const collection = database.get<Recipe>('recipes');
      const activeUser = await AuthService.getActiveUser();
      
      const record = await collection.create((record: any) => {
        console.log(`[DB ${this.table}] Creating new recipe`);
        
        // Initialize base fields first
        record.synchStatus = 'pending';
        record.lastUpdate = new Date().toISOString();
        record.isLocal = true;
        record.isDeleted = false;
        record.syncId = uuidv4();
        record.owner = activeUser;
        
        // Then apply user's updates
        recordUpdater(record as Recipe);
        console.log(`[DB ${this.table}] New recipe created with:`, record._raw);
      });

      return record;
    } catch (error) {
      console.error(`[DB ${this.table}] Error creating recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

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

  serialize(): RecipeSync {
    const base = super.serialize();
    return {
      ...base,
      object_type: 'recipe',
      name: this.name,
      description: this.description,
      image: this.image,
      rating: this.rating,
      is_approved: this.isApproved,
      prep_time: this.prepTime,
      total_time: this.totalTime,
      servings: this.servings,
      instructions: this.instructions,
      notes: this.notes,
      nutrition: this.nutrition,
      video: this.video,
      source: this.source
    };
  }

  // Override markAsDeleted to also delete related recipe_tags and ingredients
  async markAsDeleted(cascade: boolean = true): Promise<void> {
    try {
      await this.database.write(async () => {
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

        // Prepare all operations
        const operations = [
          // Mark recipe as deleted
          this.prepareUpdate(() => {
            this.isDeleted = true;
          }),
          // Mark all related records as deleted
          ...relatedRecipeTags.map(recipeTag => 
            recipeTag.prepareUpdate(() => {
              recipeTag.isDeleted = true;
            })
          ),
          ...relatedIngredients.map(ingredient => 
            ingredient.prepareUpdate(() => {
              ingredient.isDeleted = true;
            })
          )
        ];

        // Execute all operations in a batch
        await this.database.batch(...operations);
        
        console.log(`[DB ${this.table}] Successfully marked recipe ${this.id} and related records as deleted (${relatedRecipeTags.length} recipe_tags, ${relatedIngredients.length} ingredients)`);
      });
    } catch (error) {
      console.error(`[DB ${this.table}] Error marking recipe and related records as deleted: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Writer methods
  @writer async updateRating(newRating: number): Promise<void> {
    await this.update(recipe => {
      recipe.rating = newRating
    })
  }

  static async deserialize(item: SyncItemType, database: Database) {
    const baseFields = await BaseModel.deserialize(item);
    const recipeItem = item as RecipeSync;
    
    return {
      ...baseFields,
      name: recipeItem.name,
      description: recipeItem.description,
      image: recipeItem.image,
      rating: recipeItem.rating,
      is_approved: recipeItem.is_approved,
      prep_time: recipeItem.prep_time,
      total_time: recipeItem.total_time,
      servings: recipeItem.servings,
      instructions: recipeItem.instructions,
      notes: recipeItem.notes,
      nutrition: recipeItem.nutrition,
      video: recipeItem.video,
      source: recipeItem.source
    };
  }
} 