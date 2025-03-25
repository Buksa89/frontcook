import React, { useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Share, Alert, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Recipe from '../../../database/models/Recipe';
import Ingredient from '../../../database/models/Ingredient';
import { formatTime } from '../../../app/utils/timeFormat';

interface RecipeHeaderProps {
  recipe: Recipe;
  ingredients?: Ingredient[];
}

export const RecipeHeader = ({ recipe, ingredients = [] }: RecipeHeaderProps) => {
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
      console.error('Error sharing recipe:', error);
      Alert.alert('Błąd', 'Nie udało się udostępnić przepisu.');
    }
  };

  return (
    <View style={styles.header}>
      {recipe.image ? (
        <Image
          source={{ uri: recipe.image }}
          style={styles.image}
          resizeMode="cover"
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

const styles = StyleSheet.create({
  header: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 250,
  },
  imagePlaceholder: {
    width: '100%',
    height: 250,
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