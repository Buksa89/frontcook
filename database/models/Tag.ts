import { Model } from '@nozbe/watermelondb'
import { field, text, children, lazy, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { Associations } from '@nozbe/watermelondb'
import { Observable } from 'rxjs'
import RecipeTag from './RecipeTag'

export default class Tag extends Model {
  static table = 'tags'
  static associations: Associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'tag_id' }
  }

  @field('remote_id') remoteId!: string | null
  @text('user_email') userEmail!: string | null
  @field('order') order!: number
  @text('name') name!: string

  // Children relation to access recipe_tags
  @children('recipe_tags') recipeTags!: Observable<RecipeTag[]>

  // Custom queries for filtering related recipes
  @lazy approvedRecipes = this.recipeTags.extend(
    Q.on('recipes', 'is_approved', true)
  )

  @lazy userRecipes = (email: string) => this.recipeTags.extend(
    Q.on('recipes', 'user_email', email)
  )

  @lazy ratedRecipes = (minRating = 4) => this.recipeTags.extend(
    Q.on('recipes', 'rating', Q.gte(minRating))
  )

  // Writer methods
  @writer async updateOrder(newOrder: number) {
    await this.update(tag => {
      tag.order = newOrder
    })
  }

  @writer async updateName(newName: string) {
    await this.update(tag => {
      tag.name = newName.trim()
    })
  }

  @writer async assignToUser(email: string) {
    await this.update(tag => {
      tag.userEmail = email
    })
  }

  // Derived fields
  get displayName() {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1).toLowerCase()
  }
} 