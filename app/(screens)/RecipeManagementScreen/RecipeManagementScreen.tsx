import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import database from '../../../database';
import { withObservables } from '@nozbe/watermelondb/react';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import { Q } from '@nozbe/watermelondb';
import { Observable, of, from } from 'rxjs';
import { switchMap, map, mergeMap } from 'rxjs/operators';
import RecipeTag from '../../../database/models/RecipeTag';
import Ingredient from '../../../database/models/Ingredient';
import { Model } from '@nozbe/watermelondb';
import { RecipeForm } from './RecipeForm';
import { parseIngredient } from '../../utils/ingredientParser';
import { asyncStorageService } from '../../../app/services/storage';

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
    selectedTags: initialSelectedTags,
    nutrition: '',
    video: '',
    source: ''
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
        selectedTags: initialSelectedTags,
        nutrition: existingRecipe.nutrition || '',
        video: existingRecipe.video || '',
        source: existingRecipe.source || ''
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
            recipe.nutrition = formData.nutrition;
            recipe.video = formData.video;
            recipe.source = formData.source;
          });
          recipe = existingRecipe;

          // Get existing tags and ingredients
          const [existingTags, existingIngredients] = await Promise.all([
            recipeTagsCollection.query(Q.where('recipe_id', recipe.id)).fetch(),
            database.get<Ingredient>('ingredients').query(Q.where('recipe_id', recipe.id)).fetch()
          ]);

          // Find tags to remove (those that are no longer selected)
          const tagsToRemove = existingTags.filter(rt => 
            !formData.selectedTags.some(tag => tag.id === rt.tagId)
          );

          // Add delete operations
          operations = [
            ...tagsToRemove.map(rt => rt.prepareDestroyPermanently()),
            ...existingIngredients.map(ingredient => ingredient.prepareDestroyPermanently())
          ];

          // Prepare creation only for new tags
          const existingTagIds = existingTags.map(rt => rt.tagId);
          const newTags = formData.selectedTags.filter(tag => 
            !existingTagIds.includes(tag.id)
          );

          // Add operations for new tags
          operations.push(
            ...newTags.map(tag => 
              recipeTagsCollection.prepareCreate(rt => {
                rt.recipeId = recipe.id;
                rt.tagId = tag.id;
              })
            )
          );
        } else {
          // Create new recipe
          const activeUser = await asyncStorageService.getActiveUser();
          recipe = await recipesCollection.create(recipe => {
            recipe.name = formData.name;
            recipe.description = formData.description;
            recipe.prepTime = parseInt(formData.prepTime) || 0;
            recipe.totalTime = parseInt(formData.totalTime) || 0;
            recipe.servings = parseInt(formData.servings) || 1;
            recipe.instructions = formData.instructions;
            recipe.notes = formData.notes;
            recipe.nutrition = formData.nutrition;
            recipe.video = formData.video;
            recipe.source = formData.source;
            recipe.rating = 0;
            recipe.isApproved = true;
            recipe.owner = activeUser;
          });

          // For new recipe, create all tag relationships
          operations.push(
            ...formData.selectedTags.map(tag => 
              recipeTagsCollection.prepareCreate(rt => {
                rt.recipeId = recipe.id;
                rt.tagId = tag.id;
              })
            )
          );
        }

        // Prepare ingredients creation
        const ingredientLines = formData.ingredients
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);

        // Create new ingredients and tags
        const newOperations = [
          ...ingredientLines.map((line, index) => {
            const parsed = parseIngredient(line);
            const amount = parsed.amount === null ? 1 : parsed.amount;
            return ingredientsCollection.prepareCreate(ingredient => {
              ingredient.recipeId = recipe.id;
              ingredient.order = index + 1;
              ingredient.originalStr = parsed.originalStr;
              ingredient.amount = amount;
              ingredient.unit = parsed.unit;
              ingredient.name = parsed.name;
            });
          })
        ];

        // Execute all operations in a single batch
        await database.batch(...operations, ...newOperations);
      });

      // Bezpośrednie przekierowanie bez alertu
      router.back();
    } catch (error) {
      console.error('Error saving recipe:', error);
      Alert.alert('Błąd', existingRecipe ? 'Nie udało się zaktualizować przepisu' : 'Nie udało się dodać przepisu');
    }
  };

  const handleDelete = async () => {
    if (!existingRecipe) return;

    try {
      await database.write(async () => {
        await existingRecipe.markAsDeleted(); // WatermelonDB handles cascading deletes
      });

      // Bezpośrednie przekierowanie bez alertu
      router.push({
        pathname: '/(screens)/RecipeListScreen/RecipeListScreen'
      });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      Alert.alert('Błąd', 'Nie udało się usunąć przepisu');
    }
  };

  return (
    <RecipeForm
      data={formData}
      onDataChange={handleFieldChange}
      availableTags={availableTags}
      onSubmit={handleSubmit}
      onDelete={existingRecipe ? handleDelete : undefined}
      isEditing={!!existingRecipe}
    />
  );
};

const enhance = withObservables(['recipeId'], ({ recipeId }: EnhanceProps) => ({
  existingRecipe: recipeId 
    ? database.get<Recipe>('recipes').findAndObserve(recipeId)
    : of(null),
  availableTags: Tag.observeAll(database),
  selectedTags: recipeId
    ? Tag.observeForRecipe(database, recipeId)
    : of([]),
  ingredients: recipeId
    ? database.get<Recipe>('recipes')
        .findAndObserve(recipeId)
        .pipe(
          switchMap(recipe => {
            if (!recipe) return of('');
            return database
              .get<Ingredient>('ingredients')
              .query(Q.where('recipe_id', recipe.id))
              .observe()
              .pipe(
                map(ingredients => 
                  ingredients
                    .sort((a, b) => a.order - b.order)
                    .map(i => i.originalStr)
                    .join('\n')
                )
              );
          })
        )
    : of('')
}));

const EnhancedEditRecipeScreen = enhance(EditRecipeScreen);

export default function AddRecipe() {
  const params = useLocalSearchParams();
  const recipeId = params.recipeId as string | undefined;
  return <EnhancedEditRecipeScreen recipeId={recipeId} />;
} 