import { field, text, children, lazy, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { Associations } from '@nozbe/watermelondb'
import { Observable } from 'rxjs'
import { Database } from '@nozbe/watermelondb'
import BaseModel from './BaseModel'
import RecipeTag from './RecipeTag'
import Ingredient from './Ingredient'
import { asyncStorageService } from '../../app/services/storage'

interface UpdateTimesParams {
  prepTime?: number
  totalTime?: number
}

export default class Recipe extends BaseModel {
  static table = 'recipes'
  static associations: Associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'recipe_id' },
    ingredients: { type: 'has_many', foreignKey: 'recipe_id' }
  }

  // Query methods
  static async observeAll(database: Database): Promise<Observable<Recipe[]>> {
    const activeUser = await asyncStorageService.getActiveUser();
    return database
      .get<Recipe>('recipes')
      .query(
        Q.where('owner', activeUser)
      )
      .observe();
  }

  @field('remote_id') remoteId!: string | null
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

  // Custom queries
  @lazy approvedRecipeTags = this.recipeTags.extend(
    Q.on('recipes', 'is_approved', true)
  )

  @lazy quickRecipeTags = this.recipeTags.extend(
    Q.on('recipes', 'total_time', Q.lte(30))
  )

  @lazy highRatedRecipeTags = this.recipeTags.extend(
    Q.on('recipes', 'rating', Q.gte(4))
  )

  // Writer methods
  @writer async updateRating(newRating: number): Promise<void> {
    await this.update(recipe => {
      recipe.rating = newRating
    })
  }

  @writer async toggleApproval(): Promise<void> {
    await this.update(recipe => {
      recipe.isApproved = !recipe.isApproved
    })
  }

  @writer async updateTimes({ prepTime, totalTime }: UpdateTimesParams): Promise<void> {
    await this.update(recipe => {
      if (prepTime !== undefined) recipe.prepTime = prepTime
      if (totalTime !== undefined) recipe.totalTime = totalTime
    })
  }

  @writer async updateServings(servings: number): Promise<void> {
    await this.update(recipe => {
      recipe.servings = servings
    })
  }

  @writer async updateIngredients(ingredientsText: string): Promise<void> {
    const database = this.database
    const ingredientsCollection = database.get<Ingredient>('ingredients')
    
    // Split text into lines and remove empty lines
    const ingredientLines = ingredientsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    // Get existing ingredients to delete
    const existingIngredients = await this.ingredients.fetch()

    // Prepare operations
    const operations = [
      // Delete all existing ingredients
      ...existingIngredients.map(ingredient => 
        ingredient.prepareDestroyPermanently()
      ),
      // Create new ingredients
      ...ingredientLines.map((line, index) => 
        ingredientsCollection.prepareCreate(ingredient => {
          ingredient.recipeId = this.id
          ingredient.order = index + 1
          ingredient.originalStr = line
        })
      )
    ]

    // Execute all operations in a batch
    await database.batch(...operations)
  }

  // Derived fields
  get hasImage(): boolean {
    return Boolean(this.image)
  }

  get hasVideo(): boolean {
    return Boolean(this.video)
  }

  get isComplete(): boolean {
    return Boolean(
      this.name &&
      this.instructions
    )
  }

  get cookingTime(): number | null {
    if (!this.totalTime) return null
    return this.totalTime - (this.prepTime || 0)
  }

  // Helper method to get ingredients as text
  async getIngredientsAsText(): Promise<string> {
    const ingredients = await this.ingredients.fetch()
    return ingredients
      .sort((a, b) => a.order - b.order)
      .map(ingredient => ingredient.originalStr)
      .join('\n')
  }
} 