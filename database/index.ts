import { Platform } from 'react-native'
import { Database } from '@nozbe/watermelondb'
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'

import schema from './schema'
import migrations from './migrations'
import Tag from './models/Tag'
import Recipe from './models/Recipe'
import RecipeTag from './models/RecipeTag'
import Ingredient from './models/Ingredient'

interface DefaultTag {
  name: string
  order: number
}

const adapter = new LokiJSAdapter({
  schema,
  migrations,
  useWebWorker: false, // We can enable this if we want better performance
  useIncrementalIndexedDB: true, // This makes it faster
  onQuotaExceededError: (error: Error) => {
    // Handle storage quota exceeded
    console.error('Storage quota exceeded', error)
  },
  onSetUpError: (error: Error) => {
    // Handle setup error
    console.error('Database failed to load', error)
  },
})

// Create the database
const database = new Database({
  adapter,
  modelClasses: [
    Tag,
    Recipe,
    RecipeTag,
    Ingredient
  ],
})

// Default tags to populate
const defaultTags: DefaultTag[] = [
  { name: 'Śniadanie', order: 1 },
  { name: 'Obiad', order: 2 },
  { name: 'Kolacja', order: 3 },
  { name: 'Deser', order: 4 },
  { name: 'Napoje', order: 5 },
  { name: 'Wege', order: 6 },
  { name: 'Wegan', order: 7 },
  { name: 'LowCarb', order: 8 },
  { name: 'Keto', order: 9 },
  { name: 'Bez glutenu', order: 10 },
  { name: 'Bez laktozy', order: 11 }
]

// Function to populate default tags
async function populateDefaultTags(): Promise<void> {
  const tagsCollection = database.get<Tag>('tags')
  const existingTags = await tagsCollection.query().fetch()
  
  if (existingTags.length === 0) {
    await database.write(async () => {
      const promises = defaultTags.map(tag => 
        tagsCollection.create((record: Tag) => {
          record.name = tag.name
          record.order = tag.order
        })
      )
      await Promise.all(promises)
    })
    console.log('Default tags created successfully')
  }
}

// Initialize database with default data
populateDefaultTags().catch(error => {
  console.error('Error populating default tags:', error)
})

export default database 