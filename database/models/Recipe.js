import { Model } from '@nozbe/watermelondb'
import { field, text, children, lazy, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'

export default class Recipe extends Model {
  static table = 'recipes'
  static associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'recipe_id' },
    ingredients: { type: 'has_many', foreignKey: 'recipe_id' }
  }

  @field('remote_id') remoteId
  @text('user_email') userEmail
  @text('name') name
  @text('description') description
  @text('image') image
  @field('rating') rating
  @field('is_approved') isApproved
  @field('prep_time') prepTime
  @field('total_time') totalTime
  @field('servings') servings
  @text('instructions') instructions
  @text('notes') notes
  @text('nutrition') nutrition
  @text('video') video
  @text('source') source

  // Children relations
  @children('recipe_tags') recipeTags
  @children('ingredients') ingredients

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
  @writer async updateRating(newRating) {
    await this.update(recipe => {
      recipe.rating = newRating
    })
  }

  @writer async toggleApproval() {
    await this.update(recipe => {
      recipe.isApproved = !recipe.isApproved
    })
  }

  @writer async updateTimes({ prepTime, totalTime }) {
    await this.update(recipe => {
      if (prepTime !== undefined) recipe.prepTime = prepTime
      if (totalTime !== undefined) recipe.totalTime = totalTime
    })
  }

  @writer async updateServings(servings) {
    await this.update(recipe => {
      recipe.servings = servings
    })
  }

  @writer async updateIngredients(ingredientsText) {
    const database = this.database
    const ingredientsCollection = database.get('ingredients')
    
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
          ingredient.original_str = line
        })
      )
    ]

    // Execute all operations in a batch
    await database.batch(...operations)
  }

  // Derived fields
  get hasImage() {
    return Boolean(this.image)
  }

  get hasVideo() {
    return Boolean(this.video)
  }

  get isComplete() {
    return Boolean(
      this.name &&
      this.instructions
    )
  }

  get cookingTime() {
    if (!this.totalTime) return null
    return this.totalTime - (this.prepTime || 0)
  }

  // Helper method to get ingredients as text
  async getIngredientsAsText() {
    const ingredients = await this.ingredients.fetch()
    return ingredients
      .sort((a, b) => a.order - b.order)
      .map(ingredient => ingredient.original_str)
      .join('\n')
  }
} 