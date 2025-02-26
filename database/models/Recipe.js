import { Model } from '@nozbe/watermelondb'
import { field, text, children, lazy, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'

export default class Recipe extends Model {
  static table = 'recipes'
  static associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'recipe_id' }
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
  @text('ingredients') ingredients
  @text('instructions') instructions
  @text('notes') notes
  @text('nutrition') nutrition
  @text('video') video
  @text('source') source

  // Children relation to access recipe_tags
  @children('recipe_tags') recipeTags

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
      this.ingredients &&
      this.instructions
    )
  }

  get cookingTime() {
    if (!this.totalTime) return null
    return this.totalTime - (this.prepTime || 0)
  }
} 