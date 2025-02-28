import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'tags',
      columns: [
        // Note: local_id is automatically handled by WatermelonDB as 'id'
        { name: 'remote_id', type: 'string', isOptional: true }, // Using string for bigint to avoid JS number limitations
        { name: 'user_email', type: 'string', isOptional: true },
        { name: 'order', type: 'number' }, // For integers we use number type
        { name: 'name', type: 'string' }, // WatermelonDB doesn't have max length constraints at schema level
      ]
    }),
    tableSchema({
      name: 'recipes',
      columns: [
        // Note: local_id is automatically handled by WatermelonDB as 'id'
        { name: 'remote_id', type: 'string', isOptional: true }, // Using string for bigint
        { name: 'user_email', type: 'string', isOptional: true },
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'image', type: 'string', isOptional: true }, // We'll store the image path/url
        { name: 'rating', type: 'number', isOptional: true },
        { name: 'is_approved', type: 'boolean' },
        { name: 'prep_time', type: 'number', isOptional: true },
        { name: 'total_time', type: 'number', isOptional: true },
        { name: 'servings', type: 'number', isOptional: true },
        { name: 'instructions', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'nutrition', type: 'string', isOptional: true },
        { name: 'video', type: 'string', isOptional: true }, // For URLField
        { name: 'source', type: 'string', isOptional: true }
      ]
    }),
    tableSchema({
      name: 'recipe_tags',
      columns: [
        { name: 'recipe_id', type: 'string' }, // References the recipe.id
        { name: 'tag_id', type: 'string' }, // References the tag.id
      ]
    }),
    tableSchema({
      name: 'ingredients',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'amount', type: 'number', isOptional: true },
        { name: 'unit', type: 'string', isOptional: true },
        { name: 'name', type: 'string', isOptional: true },
        { name: 'type', type: 'string', isOptional: true },
        { name: 'recipe_id', type: 'string' },
        { name: 'order', type: 'number' },
        { name: 'original_str', type: 'string' }
      ],
      columnIndexes: [
        { columns: ['recipe_id', 'order'], unique: true }
      ]
    })
  ]
}) 