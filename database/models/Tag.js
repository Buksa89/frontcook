import { Model } from '@nozbe/watermelondb'
import { field, text, children, lazy, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'

export default class Tag extends Model {
  static table = 'tags'
  static associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'tag_id' }
  }

  @field('remote_id') remoteId
  @text('user_email') userEmail
  @field('order') order
  @text('name') name

  // Children relation to access recipe_tags
  @children('recipe_tags') recipeTags

  // Custom queries for filtering related recipes
  @lazy approvedRecipes = this.recipeTags.extend(
    Q.on('recipes', 'is_approved', true)
  )

  @lazy userRecipes = (email) => this.recipeTags.extend(
    Q.on('recipes', 'user_email', email)
  )

  @lazy ratedRecipes = (minRating = 4) => this.recipeTags.extend(
    Q.on('recipes', 'rating', Q.gte(minRating))
  )

  // Writer methods
  @writer async updateOrder(newOrder) {
    await this.update(tag => {
      tag.order = newOrder
    })
  }

  @writer async updateName(newName) {
    await this.update(tag => {
      tag.name = newName.trim()
    })
  }

  @writer async assignToUser(email) {
    await this.update(tag => {
      tag.userEmail = email
    })
  }

  // Derived fields
  get displayName() {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1).toLowerCase()
  }
} 