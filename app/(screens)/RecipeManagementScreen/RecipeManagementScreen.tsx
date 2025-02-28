import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import database from '../../../database';
import { withObservables } from '@nozbe/watermelondb/react';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import { Q } from '@nozbe/watermelondb';
import { Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import RecipeTag from '../../../database/models/RecipeTag';
import Ingredient from '../../../database/models/Ingredient';
import { Model } from '@nozbe/watermelondb';
import { RecipeForm } from './RecipeForm';

interface EditRecipeScreenProps {
  existingRecipe: Recipe | null;
  availableTags: Tag[];
  selectedTags: Tag[];
  ingredients: string;
}

interface EnhanceProps {
  recipeId?: string;
}

const EditRecipeScreen = ({ 
  existingRecipe, 
  availableTags, 
  selectedTags: initialSelectedTags,
  ingredients: initialIngredients 
}: EditRecipeScreenProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prepTime: '',
    totalTime: '',
    servings: '',
    ingredients: '',
    instructions: '',
    notes: '',
    selectedTags: initialSelectedTags
  });

  useEffect(() => {
    if (existingRecipe) {
      setFormData({
        name: existingRecipe.name,
        description: existingRecipe.description || '',
        prepTime: existingRecipe.prepTime?.toString() || '',
        totalTime: existingRecipe.totalTime?.toString() || '',
        servings: existingRecipe.servings?.toString() || '',
        ingredients: initialIngredients,
        instructions: existingRecipe.instructions,
        notes: existingRecipe.notes || '',
        selectedTags: initialSelectedTags
      });
    }
  }, [existingRecipe, initialSelectedTags, initialIngredients]);

  const handleFieldChange = (field: keyof typeof formData, value: string | Tag[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.ingredients || !formData.instructions) {
      Alert.alert('Błąd', 'Wypełnij wymagane pola (nazwa, składniki, instrukcje)');
      return;
    }

    try {
      await database.write(async () => {
        const recipesCollection = database.get<Recipe>('recipes');
        const recipeTagsCollection = database.get<RecipeTag>('recipe_tags');
        const ingredientsCollection = database.get<Ingredient>('ingredients');

        let recipe: Recipe;
        let operations: Model[] = [];

        if (existingRecipe) {
          // Update existing recipe
          await existingRecipe.update(recipe => {
            recipe.name = formData.name;
            recipe.description = formData.description;
            recipe.prepTime = parseInt(formData.prepTime) || 0;
            recipe.totalTime = parseInt(formData.totalTime) || 0;
            recipe.servings = parseInt(formData.servings) || 1;
            recipe.instructions = formData.instructions;
            recipe.notes = formData.notes;
          });
          recipe = existingRecipe;

          // Get existing tags and ingredients to delete
          const [existingTags, existingIngredients] = await Promise.all([
            recipeTagsCollection.query(Q.where('recipe_id', recipe.id)).fetch(),
            recipe.ingredients.fetch()
          ]);

          // Add delete operations
          operations = [
            ...existingTags.map((tag: RecipeTag) => tag.prepareDestroyPermanently()),
            ...existingIngredients.map((ingredient: Ingredient) => ingredient.prepareDestroyPermanently())
          ];
        } else {
          // Create new recipe
          recipe = await recipesCollection.create(recipe => {
            recipe.name = formData.name;
            recipe.description = formData.description;
            recipe.prepTime = parseInt(formData.prepTime) || 0;
            recipe.totalTime = parseInt(formData.totalTime) || 0;
            recipe.servings = parseInt(formData.servings) || 1;
            recipe.instructions = formData.instructions;
            recipe.notes = formData.notes;
            recipe.rating = 0;
            recipe.isApproved = true;
          });
        }

        // Prepare ingredients creation
        const ingredientLines = formData.ingredients
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);

        // Create new ingredients and tags
        const newOperations = [
          ...ingredientLines.map((line, index) => 
            ingredientsCollection.prepareCreate((ingredient: Ingredient) => {
              ingredient.recipeId = recipe.id;
              ingredient.order = index + 1;
              ingredient.originalStr = line;
            })
          ),
          ...formData.selectedTags.map(tag => 
            recipeTagsCollection.prepareCreate((rt: RecipeTag) => {
              rt.recipeId = recipe.id;
              rt.tagId = tag.id;
            })
          )
        ];

        // Execute all operations in a single batch
        await database.batch(...operations, ...newOperations);
      });

      Alert.alert(
        'Sukces', 
        existingRecipe ? 'Przepis został zaktualizowany' : 'Przepis został dodany', 
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving recipe:', error);
      Alert.alert('Błąd', existingRecipe ? 'Nie udało się zaktualizować przepisu' : 'Nie udało się dodać przepisu');
    }
  };

  return (
    <RecipeForm
      data={formData}
      onDataChange={handleFieldChange}
      availableTags={availableTags}
      onSubmit={handleSubmit}
      isEditing={!!existingRecipe}
    />
  );
};

const enhance = withObservables(['recipeId'], ({ recipeId }: EnhanceProps) => ({
  existingRecipe: recipeId 
    ? database.get<Recipe>('recipes').findAndObserve(recipeId)
    : of(null),
  availableTags: database.get<Tag>('tags')
    .query()
    .observe() as Observable<Tag[]>,
  selectedTags: recipeId
    ? database.get<Recipe>('recipes')
        .findAndObserve(recipeId)
        .pipe(
          switchMap(recipe => {
            if (!recipe) return of([]);
            return database
              .get<RecipeTag>('recipe_tags')
              .query(Q.where('recipe_id', recipe.id))
              .observe()
              .pipe(
                switchMap(async recipeTags => {
                  const tags = await Promise.all(
                    recipeTags.map(rt => 
                      database.get<Tag>('tags').find(rt.tagId)
                    )
                  );
                  return tags.filter((tag): tag is Tag => tag !== null);
                })
              );
          })
        )
    : of([]),
  ingredients: (recipeId
    ? database.get<Recipe>('recipes')
        .findAndObserve(recipeId)
        .pipe(
          switchMap(recipe => {
            if (!recipe) return of('');
            return recipe.ingredients
              .observe()
              .pipe(
                map((ingredients: Ingredient[]) => 
                  ingredients
                    .sort((a: Ingredient, b: Ingredient) => a.order - b.order)
                    .map((i: Ingredient) => i.originalStr)
                    .join('\n')
                )
              );
          })
        )
    : of('')) as Observable<string>,
}));

const EnhancedEditRecipeScreen = enhance(EditRecipeScreen);

export default function AddRecipe() {
  const params = useLocalSearchParams();
  const recipeId = params.recipeId as string | undefined;
  return <EnhancedEditRecipeScreen recipeId={recipeId} />;
} 