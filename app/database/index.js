import { Platform } from 'react-native'
import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import schema from './schema'
import migrations from './migrations'
import Tag from './models/Tag'
import Recipe from './models/Recipe'
import RecipeTag from './models/RecipeTag'

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: Platform.OS === 'ios', // Enable JSI for iOS, disable for Android if you run into issues
  onSetUpError: error => {
    // Database failed to load -- offer the user to reload the app or log out
    console.error(error)
  }
})

// Create the database
const database = new Database({
  adapter,
  modelClasses: [
    Tag,
    Recipe,
    RecipeTag
  ],
})

export default database 