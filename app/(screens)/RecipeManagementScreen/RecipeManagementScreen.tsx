import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import database from '../../../database';
import { withObservables } from '@nozbe/watermelondb/react';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import RecipeImage from '../../../database/models/RecipeImage';
import { of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import Ingredient from '../../../database/models/Ingredient'
import { RecipeForm } from './RecipeForm';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { needsProcessing, cropToSize } from '../../../app/utils/imageProcessor';
import { Q } from '@nozbe/watermelondb';

interface EditRecipeScreenProps {
  existingRecipe: Recipe | null;
  availableTags: Tag[];
  selectedTags: Tag[];
  ingredients: string;
  recipeImage: string | null;
}

interface EnhanceProps {
  recipeId?: string;
}

const EditRecipeScreen = ({ 
  existingRecipe, 
  availableTags, 
  selectedTags: initialSelectedTags,
  ingredients: initialIngredients,
  recipeImage: initialImage
}: EditRecipeScreenProps) => {
  const navigation = useNavigation();
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
    source: '',
    image: initialImage
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
        source: existingRecipe.source || '',
        image: initialImage
      });
      
      // Set up the navigation header with delete button
      if (navigation.setOptions) {
        navigation.setOptions({
          headerTitle: existingRecipe ? 'Edytuj przepis' : 'Dodaj przepis',
          headerRight: () => existingRecipe ? (
            <MaterialIcons 
              name="delete" 
              size={24} 
              color="#F44336" 
              style={{ marginRight: 16 }}
              onPress={handleDeleteConfirmation}
            />
          ) : null
        });
      }
    }
  }, [existingRecipe, initialSelectedTags, initialIngredients, initialImage, navigation]);

  const handleFieldChange = (field: keyof typeof formData, value: string | Tag[] | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDeleteConfirmation = () => {
    if (!existingRecipe) return;
    
    Alert.alert(
      'Usuń przepis',
      'Czy na pewno chcesz usunąć ten przepis? Tej operacji nie można cofnąć.',
      [
        {
          text: 'Anuluj',
          style: 'cancel'
        },
        {
          text: 'Usuń',
          onPress: handleDelete,
          style: 'destructive'
        }
      ]
    );
  };

  const saveRecipeWithImage = async (recipe: Recipe) => {
    if (formData.image && recipe.syncId) {
      try {
        console.log(`[RecipeManagement] Zapisuję obraz dla przepisu: ${recipe.id}, syncId: ${recipe.syncId}`);
        
        // Używamy metody createOrUpdate tylko z syncId i obrazem
        const recipeImage = await RecipeImage.createOrUpdate(
          database,
          recipe.syncId,
          formData.image
        );
        
        if (recipeImage) {
          console.log(`[RecipeManagement] Zapisano obraz dla przepisu: ${recipe.id}, syncId: ${recipe.syncId}`);
        } else {
          console.error(`[RecipeManagement] Nie udało się zapisać obrazu dla przepisu: ${recipe.id}`);
        }
      } catch (error) {
        console.error('Error saving recipe image:', error);
      }
    } else if (!formData.image && recipe.syncId) {
      // Jeśli usunięto obraz, również musimy zaktualizować rekord RecipeImage
      try {
        console.log(`[RecipeManagement] Usuwanie obrazu dla przepisu: ${recipe.id}, syncId: ${recipe.syncId}`);
        
        const existingRecipeImages = await database.get<RecipeImage>('recipe_images')
          .query(Q.where('sync_id', recipe.syncId))
          .fetch();
          
        if (existingRecipeImages.length > 0) {
          await existingRecipeImages[0].update(record => {
            record.image = undefined;
            record.thumbnail = undefined;
          });
          console.log(`[RecipeManagement] Usunięto obrazy dla przepisu: ${recipe.id}`);
        }
      } catch (error) {
        console.error('Error removing recipe image:', error);
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.ingredients || !formData.instructions) {
      Alert.alert('Błąd', 'Wypełnij wymagane pola (nazwa, składniki, instrukcje)');
      return;
    }

    try {
      const savedRecipe = await Recipe.saveRecipe(database, formData, existingRecipe || undefined);
      
      // Po zapisaniu przepisu, zapisujemy obraz
      await saveRecipeWithImage(savedRecipe);
      
      // Jeśli przepis istnieje i nie jest jeszcze zatwierdzony, zatwierdzamy go
      if (existingRecipe && !existingRecipe.isApproved) {
        await existingRecipe.toggleApproval();
        // Przekierowujemy na listę przepisów po zaakceptowaniu
        router.push({
          pathname: '/(screens)/RecipeListScreen/RecipeListScreen'
        });
      } else {
        // W innych przypadkach wracamy do poprzedniego ekranu
        router.back();
      }
    } catch (error) {
      console.error('Error saving recipe:', error);
      Alert.alert('Błąd', existingRecipe ? 'Nie udało się zaktualizować przepisu' : 'Nie udało się dodać przepisu');
    }
  };

  const handleDelete = async () => {
    if (!existingRecipe) return;

    try {
      // Usuń także powiązany obraz jeśli istnieje
      if (existingRecipe.syncId) {
        const existingRecipeImages = await database.get<RecipeImage>('recipe_images')
          .query(Q.where('sync_id', existingRecipe.syncId))
          .fetch();
          
        if (existingRecipeImages.length > 0) {
          await existingRecipeImages[0].markAsDeleted();
          console.log(`[RecipeManagement] Usunięto obraz dla przepisu: ${existingRecipe.id}, syncId: ${existingRecipe.syncId}`);
        }
      }
      
      // Usuń przepis
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
      isEditing={!!existingRecipe}
      isApproved={existingRecipe?.isApproved || false}
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
    : of(''),
  recipeImage: recipeId
    ? database.get<Recipe>('recipes')
        .findAndObserve(recipeId)
        .pipe(
          switchMap(recipe => {
            if (!recipe?.syncId) return of(null);
            
            return database
              .get<RecipeImage>('recipe_images')
              .query(Q.where('sync_id', recipe.syncId))
              .observeWithColumns(['image'])
              .pipe(
                map(images => {
                  if (images.length === 0) return null;
                  console.log(`[RecipeManagement] Znaleziono obraz dla przepisu: ${recipe.id}, syncId: ${recipe.syncId}`);
                  return images[0].image || null;
                })
              );
          })
        )
    : of(null)
}));

const EnhancedEditRecipeScreen = enhance(EditRecipeScreen);

export default function AddRecipe() {
  const params = useLocalSearchParams();
  const recipeId = params.recipeId as string | undefined;
  return <EnhancedEditRecipeScreen recipeId={recipeId} />;
} 