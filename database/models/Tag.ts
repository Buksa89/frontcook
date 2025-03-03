import { field, text, children, lazy, writer } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { Associations } from '@nozbe/watermelondb'
import { Observable } from 'rxjs'
import { Database } from '@nozbe/watermelondb'
import { map } from 'rxjs/operators'
import BaseModel from './BaseModel'
import RecipeTag from './RecipeTag'
import { asyncStorageService } from '../../app/services/storage'

export default class Tag extends BaseModel {
  static table = 'tags'
  static associations: Associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'tag_id' }
  }

  @field('remote_id') remoteId!: string | null
  @field('order') order!: number
  @text('name') name!: string

  // Children relation to access recipe_tags
  @children('recipe_tags') recipeTags!: Observable<RecipeTag[]>

  // Query methods
  static async observeAll(database: Database): Promise<Observable<Tag[]>> {
    const activeUser = await asyncStorageService.getActiveUser();
    return database
      .get<Tag>('tags')
      .query(
        Q.where('owner', activeUser)
      )
      .observe()
      .pipe(map(tags => tags.sort((a, b) => a.order - b.order)));
  }

  // Helper method to find existing tag with same name
  static async findExisting(
    database: Database,
    name: string
  ): Promise<Tag | null> {
    try {
      const activeUser = await asyncStorageService.getActiveUser();
      console.log(`[DB Tag] Searching for existing tag: name=${name}, owner=${activeUser}`)
      
      const tags = await database
        .get<Tag>('tags')
        .query(
          Q.and(
            Q.where('owner', activeUser),
            Q.where('name', Q.eq(name.toLowerCase()))
          )
        )
        .fetch()

      if (tags.length > 0) {
        console.log(`[DB Tag] Found existing tag: ${tags[0].id}`)
        return tags[0]
      }

      console.log('[DB Tag] No existing tag found')
      return null
    } catch (error) {
      console.error(`[DB Tag] Error finding existing tag: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  // Create or update a tag
  static async createOrUpdate(
    database: Database,
    {
      name,
      order
    }: {
      name: string
      order: number
    },
    forceCreate: boolean = false
  ): Promise<Tag> {
    try {
      const activeUser = await asyncStorageService.getActiveUser();
      const normalizedName = name.toLowerCase().trim()

      // Try to find existing tag if not forcing create
      let existingTag: Tag | null = null
      if (!forceCreate) {
        existingTag = await this.findExisting(database, normalizedName)
      }

      return await database.write(async () => {
        if (existingTag) {
          console.log(`[DB Tag] Updating existing tag: ${existingTag.id}`)
          await existingTag.update(record => {
            record.syncStatus = 'pending'
            record.lastSync = new Date().toISOString()
            record.isLocal = true
          })
          return existingTag
        } else {
          console.log(`[DB Tag] Creating new tag: name=${normalizedName}, owner=${activeUser}`)
          return await database.get<Tag>('tags').create(record => {
            record.name = normalizedName
            record.order = order
            record.owner = activeUser
            record.syncStatus = 'pending'
            record.lastSync = new Date().toISOString()
            record.isLocal = true
          })
        }
      })
    } catch (error) {
      console.error(`[DB Tag] Error creating/updating tag: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  // Writer methods
  @writer async updateOrder(newOrder: number) {
    try {
      console.log(`[DB Tag] Updating order for tag ${this.id}: ${this.order} -> ${newOrder}`)
      await this.update(record => {
        record.order = newOrder
        record.syncStatus = 'pending'
        record.lastSync = new Date().toISOString()
        record.isLocal = true
      })
    } catch (error) {
      console.error(`[DB Tag] Error updating order: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  @writer async updateName(newName: string) {
    try {
      console.log(`[DB Tag] Updating name for tag ${this.id}: ${this.name} -> ${newName}`)
      await this.update(record => {
        record.name = newName.toLowerCase().trim()
        record.syncStatus = 'pending'
        record.lastSync = new Date().toISOString()
        record.isLocal = true
      })
    } catch (error) {
      console.error(`[DB Tag] Error updating name: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  // Custom queries for filtering related recipes
  @lazy approvedRecipes = this.recipeTags.extend(
    Q.on('recipes', 'is_approved', true)
  )

  @lazy ratedRecipes = (minRating = 4) => this.recipeTags.extend(
    Q.on('recipes', 'rating', Q.gte(minRating))
  )

  // Derived fields
  get displayName() {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1).toLowerCase()
  }
} 