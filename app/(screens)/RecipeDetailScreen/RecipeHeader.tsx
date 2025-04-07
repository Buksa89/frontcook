import React, { useState, useEffect, useCallback } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Share, Alert, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Recipe from '../../../database/models/Recipe';
import Ingredient from '../../../database/models/Ingredient';
import { formatTime } from '../../../app/utils/timeFormat';
import { needsProcessing } from '../../utils/imageProcessor';

interface RecipeHeaderProps {
  recipe: Recipe;
  ingredients?: Ingredient[];
}

const RecipeHeader = ({ recipe, ingredients = [] }: RecipeHeaderProps) => {
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [isFetchingImage, setIsFetchingImage] = useState(true);

  // Use useFocusEffect to fetch image when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const fetchImagePath = async () => {
        if (!recipe) {
          if(isMounted) setImagePath(null);
          return;
        }
        // Reset state before fetching
        if(isMounted) {
          setIsFetchingImage(true);
          setImagePath(null);
        }
        try {
          console.log(`[RecipeHeader FocusEffect] Fetching image path for Recipe ID: ${recipe.id}`);
          const path = await recipe.getImageFromRecipeImage();
          if (isMounted) {
            console.log(`[RecipeHeader FocusEffect] Fetched image path: ${path}`);
            setImagePath(path);
          }
        } catch (error) {
          console.error(`[RecipeHeader FocusEffect] Error fetching image path for Recipe ID ${recipe.id}:`, error);
          if (isMounted) {
            setImagePath(null); // Set to null on error
          }
        } finally {
          if (isMounted) {
            setIsFetchingImage(false);
          }
        }
      };

      fetchImagePath();

      return () => {
        isMounted = false;
        console.log(`[RecipeHeader FocusEffect] Cleanup for Recipe ID: ${recipe?.id}`);
        // Optional: Cancel fetch if needed, although usually not necessary here
      };
    }, [recipe]) // Dependency on recipe ensures refetch if the recipe instance changes fundamentally
  );

  // Get main image from fetched path
  const displayImage = imagePath;

  const handleShareRecipe = async () => {
    try {
      // Create a nicely formatted recipe to share
      let shareText = `🍳 ${recipe.name} 🍳\n\n`;
      
      // Add description if available
      if (recipe.description) {
        shareText += `${recipe.description}\n\n`;
      }
      
      // Add prep and total time if available
      if (recipe.prepTime) {
        shareText += `⏱️ Czas przygotowania: ${formatTime(recipe.prepTime)}\n`;
      }
      if (recipe.totalTime) {
        shareText += `⏱️ Całkowity czas: ${formatTime(recipe.totalTime)}\n`;
      }
      
      // Add servings if available
      if (recipe.servings) {
        shareText += `👥 Porcje: ${recipe.servings}\n`;
      }
      
      // Add rating if available
      if (recipe.rating && recipe.rating > 0) {
        const stars = '★'.repeat(Math.floor(recipe.rating)) + '☆'.repeat(5 - Math.floor(recipe.rating));
        shareText += `${stars} (${recipe.rating.toFixed(1)})\n`;
      }
      
      shareText += '\n';
      
      // Add ingredients
      if (ingredients && ingredients.length > 0) {
        shareText += '📋 SKŁADNIKI:\n';
        ingredients.forEach(ingredient => {
          let ingredientText = '';
          if (ingredient.amount) {
            ingredientText += `${ingredient.amount} `;
          }
          if (ingredient.unit) {
            ingredientText += `${ingredient.unit} `;
          }
          ingredientText += ingredient.name;
          shareText += `• ${ingredientText}\n`;
        });
        shareText += '\n';
      }
      
      // Add instructions
      if (recipe.instructions) {
        shareText += '📝 INSTRUKCJE:\n';
        
        const instructionSteps = recipe.instructions
          .split('\n')
          .map(step => step.trim())
          .filter(step => step.length > 0);
        
        instructionSteps.forEach((step, index) => {
          shareText += `${index + 1}. ${step}\n`;
        });
        shareText += '\n';
      }
      
      // Add notes if available
      if (recipe.notes) {
        shareText += '📌 NOTATKI:\n';
        shareText += `${recipe.notes}\n\n`;
      }
      
      // Add source if available
      if (recipe.source) {
        shareText += `Źródło: ${recipe.source}\n`;
      }
      
      // Use the Share API to share the recipe
      const result = await Share.share({
        message: shareText,
        title: recipe.name
      });
      
      if (result.action === Share.sharedAction) {
        console.log('Recipe shared successfully');
      }
    } catch (error) {
      console.error('Błąd podczas udostępniania przepisu:', error);
      Alert.alert('Błąd', 'Nie udało się udostępnić przepisu.');
    }
  };

  return (
    <View style={styles.header}>
      {isFetchingImage ? (
        <View style={styles.imagePlaceholder}>
          {/* Optional: Add a loading indicator */}
        </View>
      ) : displayImage ? (
        <Image
          key={displayImage}
          source={{ 
            uri: displayImage 
          }}
          style={styles.image}
          resizeMode="cover"
          onError={(e) => console.log(`[RecipeHeader] Błąd ładowania zdjęcia ${displayImage}:`, e.nativeEvent.error)}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <MaterialIcons name="restaurant" size={48} color="#ccc" />
        </View>
      )}

      {recipe.isApproved && (
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={handleShareRecipe}
        >
          <MaterialIcons name="share" size={24} color="#5c7ba9" />
        </TouchableOpacity>
      )}

      <TouchableOpacity 
        style={styles.editButton}
        onPress={() => router.push({
          pathname: '/(screens)/RecipeManagementScreen/RecipeManagementScreen',
          params: { recipeId: recipe.id }
        })}
      >
        <MaterialIcons name="edit" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export { RecipeHeader };

// Re-add the missing styles definition
const styles = StyleSheet.create({
  header: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: undefined,
    aspectRatio: 1024 / 633,
  },
  imagePlaceholder: {
    width: '100%',
    height: undefined,
    aspectRatio: 1024 / 633,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    position: 'absolute',
    right: 84,
    bottom: -20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  editButton: {
    position: 'absolute',
    right: 16,
    bottom: -20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5c7ba9',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
}); 