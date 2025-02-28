import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import database from '../../../database';
import { withObservables } from '@nozbe/watermelondb/react';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import { Q } from '@nozbe/watermelondb';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import RecipeTag from '../../../database/models/RecipeTag';
import { RecipeForm } from './RecipeForm';

interface EditRecipeScreenProps {
  existingRecipe: Recipe | null;
  availableTags: Tag[];
  selectedTags: Tag[];
}

const EditRecipeScreen = ({ existingRecipe, availableTags, selectedTags: initialSelectedTags }: EditRecipeScreenProps) => {
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
        ingredients: existingRecipe.ingredients,
        instructions: existingRecipe.instructions,
        notes: existingRecipe.notes || '',
        selectedTags: initialSelectedTags
      });
    }
  }, [existingRecipe, initialSelectedTags]);

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
        if (existingRecipe) {
          await existingRecipe.update(recipe => {
            recipe.name = formData.name;
            recipe.description = formData.description;
            recipe.prepTime = parseInt(formData.prepTime) || 0;
            recipe.totalTime = parseInt(formData.totalTime) || 0;
            recipe.servings = parseInt(formData.servings) || 1;
            recipe.ingredients = formData.ingredients;
            recipe.instructions = formData.instructions;
            recipe.notes = formData.notes;
          });

          // Update recipe tags
          const recipeTagsCollection = database.get<RecipeTag>('recipe_tags');
          const existingTags = await recipeTagsCollection
            .query(Q.where('recipe_id', existingRecipe.id))
            .fetch();

          // Prepare all operations for the batch
          const operations = [
            ...existingTags.map(tag => tag.prepareDestroyPermanently()),
            ...formData.selectedTags.map(tag => 
              recipeTagsCollection.prepareCreate(rt => {
                rt.recipeId = existingRecipe.id;
                rt.tagId = tag.id;
              })
            )
          ];

          // Execute all operations in a single batch
          await database.batch(...operations);
        } else {
          const recipesCollection = database.get<Recipe>('recipes');
          const newRecipe = await recipesCollection.create(recipe => {
            recipe.name = formData.name;
            recipe.description = formData.description;
            recipe.prepTime = parseInt(formData.prepTime) || 0;
            recipe.totalTime = parseInt(formData.totalTime) || 0;
            recipe.servings = parseInt(formData.servings) || 1;
            recipe.ingredients = formData.ingredients;
            recipe.instructions = formData.instructions;
            recipe.notes = formData.notes;
            recipe.rating = 0;
            recipe.isApproved = true;
          });

          // Add tags to new recipe
          const recipeTagsCollection = database.get<RecipeTag>('recipe_tags');
          const operations = formData.selectedTags.map(tag =>
            recipeTagsCollection.prepareCreate(rt => {
              rt.recipeId = newRecipe.id;
              rt.tagId = tag.id;
            })
          );

          // Execute all operations in a single batch
          if (operations.length > 0) {
            await database.batch(...operations);
          }
        }
      });

      Alert.alert(
        'Sukces', 
        existingRecipe ? 'Przepis został zaktualizowany' : 'Przepis został dodany', 
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Błąd', existingRecipe ? 'Nie udało się zaktualizować przepisu' : 'Nie udało się dodać przepisu');
      console.error(error);
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

const enhance = withObservables(['recipeId'], ({ recipeId }: { recipeId?: string }) => ({
  existingRecipe: recipeId 
    ? database.get<Recipe>('recipes').findAndObserve(recipeId)
    : of(null),
  availableTags: database.get<Tag>('tags')
    .query()
    .observe(),
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
}));

const EnhancedEditRecipeScreen = enhance(EditRecipeScreen);

export default function AddRecipe() {
  const params = useLocalSearchParams();
  const recipeId = params.recipeId as string | undefined;
  return <EnhancedEditRecipeScreen recipeId={recipeId} />;
} 