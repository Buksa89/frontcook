import React, { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import database from '../../../database';
import { withObservables } from '@nozbe/watermelondb/react';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
// import RecipeImage from '../../../database/models/RecipeImage'; // Keep for type usage if needed later - REMOVED as we fetch path directly
import { of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import Ingredient from '../../../database/models/Ingredient'
import { RecipeForm } from './RecipeForm';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { saveImageToTempFile } from '../../../app/utils/imageProcessor';
import { Q } from '@nozbe/watermelondb';

interface EditRecipeScreenProps {
  existingRecipe: Recipe | null;
  availableTags: Tag[];
  selectedTags: Tag[];
  ingredients: string;
  // Remove recipeImage prop - we'll manage image in local state
}

interface EnhanceProps {
  recipeId?: string;
}

// Remove recipeImage from destructuring
const EditRecipeScreen = ({
  existingRecipe,
  availableTags,
  selectedTags: initialSelectedTags,
  ingredients: initialIngredients,
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
    selectedTags: initialSelectedTags || [],
    nutrition: '',
    video: '',
    source: '',
    image: null as string | null // Initialize image as null
  });
  const initialLoadDone = useRef<boolean>(false);
  const currentRecipeIdRef = useRef<string | undefined>(undefined);
  const [initialImagePath, setInitialImagePath] = useState<string | null | undefined>(undefined); // State for initial image path (undefined means not yet fetched)

  // Effect to fetch initial image path ONCE when recipe loads or changes
  useEffect(() => {
    const currentRecipeId = existingRecipe?.id;
    // Fetch only if the recipe ID has changed and exists
    if (existingRecipe && currentRecipeId !== currentRecipeIdRef.current) {
      let isMounted = true; // Flag to prevent state update on unmounted component
      currentRecipeIdRef.current = currentRecipeId; // Update the ref immediately
      initialLoadDone.current = false; // Reset load flag for the new recipe
      setInitialImagePath(undefined); // Mark as fetching

      const fetchImagePath = async () => {
        try {
          // Use the existing method to get the image path from RecipeImage
          const path = await existingRecipe.getImageFromRecipeImage();
          if (isMounted) {
            setInitialImagePath(path); // Set fetched path (can be null)
          }
        } catch (error) {
          setInitialImagePath(null); // Set to null on error
        }
      };
      fetchImagePath();
      return () => { isMounted = false; }; // Cleanup function
    } else if (!existingRecipe && currentRecipeIdRef.current !== undefined) {
        // Handle case where user navigates from an existing recipe to create a new one
        currentRecipeIdRef.current = undefined;
        initialLoadDone.current = false;
        setInitialImagePath(null); // No image for new recipe
    }
  }, [existingRecipe]); // Dependency only on existingRecipe

  // Effect to populate form data AFTER initial image path is determined
  useEffect(() => {
    const currentRecipeId = existingRecipe?.id;

    // Populate form only when initial load isn't done AND we have the recipe data
    // Wait for initialImagePath to be determined (it is 'undefined' while fetching)
    if (existingRecipe && !initialLoadDone.current && initialImagePath !== undefined) {
        setFormData({
            name: existingRecipe.name,
            description: existingRecipe.description || '',
            prepTime: existingRecipe.prepTime?.toString() || '',
            totalTime: existingRecipe.totalTime?.toString() || '',
            servings: existingRecipe.servings?.toString() || '',
            ingredients: initialIngredients, // Comes from observer, OK here
            instructions: existingRecipe.instructions,
            notes: existingRecipe.notes || '',
            selectedTags: initialSelectedTags || [], // Comes from observer, OK here
            nutrition: existingRecipe.nutrition || '',
            video: existingRecipe.video || '',
            source: existingRecipe.source || '',
            image: initialImagePath // Set initial image from fetched path
        });
        initialLoadDone.current = true; // Mark load as done
    } else if (existingRecipe && initialLoadDone.current) {
        // After initial load, only update observer-driven fields if needed
        // IMPORTANT: DO NOT update formData.image here
        setFormData(prev => ({
            ...prev,
            selectedTags: initialSelectedTags || [],
            ingredients: initialIngredients,
        }));
    } else if (!existingRecipe && !initialLoadDone.current && initialImagePath === null) {
        // Handle case for adding a NEW recipe (initialImagePath is set to null by the other effect)
        setFormData({ // Reset form for new recipe
            name: '', description: '', prepTime: '', totalTime: '', servings: '',
            ingredients: '', instructions: '', notes: '', selectedTags: [],
            nutrition: '', video: '', source: '', image: null
        });
        initialLoadDone.current = true; // Mark load as done (no initial data to load)
    }


    // Setup header - depends only on whether existingRecipe exists
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
  // Dependencies: existingRecipe (to trigger changes), observer props, and the fetched initial image path
  }, [existingRecipe, initialSelectedTags, initialIngredients, navigation, initialImagePath]);


  const handleFieldChange = (field: keyof typeof formData, value: string | Tag[] | null) => {
    // When image changes, we know it's a user action after initial load
    if (field === 'image') {
    }
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

  const handleSubmit = async () => {
    if (!formData.name || !formData.ingredients || !formData.instructions) {
      Alert.alert('Błąd', 'Wypełnij wymagane pola (nazwa, składniki, instrukcje)');
      return;
    }

    try {
      // formData.image now holds either the initial path OR the new temp URI
      const tempImagePath = await saveImageToTempFile(formData.image);

      const formDataWithImagePath = {
        ...formData,
        image: tempImagePath // Pass the path (temp or processed temp) to backend logic
      };

      await Recipe.upsertByManagement(
        database,
        formDataWithImagePath,
        existingRecipe ? existingRecipe.id : undefined
      );

      if (existingRecipe && !existingRecipe.isApproved) {
        router.push({
          pathname: '/(screens)/RecipeListScreen/RecipeListScreen'
        });
      } else {
        setTimeout(() => router.back(), 0);
      }
    } catch (error) {
      console.error('[handleSubmit] Error saving recipe:', error);
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
      console.error('[handleDelete] Error deleting recipe:', error);
      Alert.alert('Błąd', 'Nie udało się usunąć przepisu');
    }
  };

  // Render RecipeForm with the current formData
  // The RecipeForm component will display formData.image
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

// Remove recipeImage observation from enhance
const enhance = withObservables(['recipeId'], ({ recipeId }: EnhanceProps) => {
  return {
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
      // recipeImage observation is removed
  };
});

const EnhancedEditRecipeScreen = enhance(EditRecipeScreen);

export default function AddRecipe() {
  const params = useLocalSearchParams();
  const recipeId = params.recipeId as string | undefined;
  return <EnhancedEditRecipeScreen recipeId={recipeId} />;
} 