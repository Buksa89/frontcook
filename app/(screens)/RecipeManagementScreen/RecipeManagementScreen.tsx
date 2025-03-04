import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import database from '../../../database';
import { withObservables } from '@nozbe/watermelondb/react';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import { Q } from '@nozbe/watermelondb';
import { Observable, of, from } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
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
      await Recipe.saveRecipe(database, formData, existingRecipe || undefined);
      router.back();
    } catch (error) {
      console.error('Error saving recipe:', error);
      Alert.alert('Błąd', existingRecipe ? 'Nie udało się zaktualizować przepisu' : 'Nie udało się dodać przepisu');
    }
  };

  const handleDelete = async () => {
    if (!existingRecipe) return;

    try {
      await existingRecipe.markAsDeleted();
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
    ? Ingredient.observeForRecipe(database, recipeId).pipe(
        map(ingredients => ingredients.map(i => i.originalStr).join('\n'))
      )
    : of('')
}));

const EnhancedEditRecipeScreen = enhance(EditRecipeScreen);

export default function AddRecipe() {
  const params = useLocalSearchParams();
  const recipeId = params.recipeId as string | undefined;
  return <EnhancedEditRecipeScreen recipeId={recipeId} />;
} 