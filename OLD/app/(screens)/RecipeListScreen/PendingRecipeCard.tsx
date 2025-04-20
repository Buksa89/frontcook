import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Alert, Image } from 'react-native';
import { MaterialIcons, AntDesign } from '@expo/vector-icons';
import { router } from 'expo-router';
import { withObservables } from '@nozbe/watermelondb/react';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import database from '../../../database';
import { formatTime } from '../../../app/utils/timeFormat';
import RecipeImage from '../../../database/models/RecipeImage';
import { of } from 'rxjs';

// Komponent karty przepisu oczekującego na zatwierdzenie
interface PendingRecipeCardProps {
  recipe: Recipe;
  tags: Tag[];
  recipeImage: RecipeImage | null;
}

const PendingRecipeCard = ({ recipe, tags, recipeImage }: PendingRecipeCardProps) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Ensure recipe object has all required properties to prevent rendering issues
  const safeRecipe = {
    id: recipe?.id || '',
    name: recipe?.name || '',
    image: recipe?.image || null,
    prepTime: recipe?.prepTime || null,
    totalTime: recipe?.totalTime || null,
  };
  
  // Get image paths from recipeImage if available
  const thumbnailImage = recipeImage?.thumbnail || safeRecipe.image;

  // Skip rendering if recipe is invalid
  if (!recipe || typeof recipe !== 'object') {
    return null;
  }

  const handleApprove = async () => {
    try {
      // Perform approval immediately without confirmation
      await recipe.toggleApproval();
    } catch (error) {
      console.error('Błąd podczas akceptowania przepisu:', error);
      // No alert, just log the error
    }
  };

  const handleDelete = async () => {
    // Check if already in deletion process to avoid duplicate processing
    if (isDeleting) return;
    
    try {
      // Set deletion flag to prevent multiple calls
      setIsDeleting(true);
      
      // Delete immediately without confirmation
      await recipe.markAsDeleted();
    } catch (error) {
      console.error('Błąd podczas usuwania przepisu:', error);
      // Reset deletion flag if there was an error
      setIsDeleting(false);
    }
  };

  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push({
        pathname: '/(screens)/RecipeDetailScreen/RecipeDetailScreen',
        params: { recipeId: safeRecipe.id }
      })}
    >
      <View style={[styles.imageContainer, styles.imagePlaceholder]}>
        {thumbnailImage ? (
          <Image
            source={{ uri: thumbnailImage }}
            style={styles.image}
            onError={() => console.log('Błąd ładowania zdjęcia:', safeRecipe.name)}
          />
        ) : (
          <AntDesign name="picture" size={24} color="#bbb" />
        )}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.title}>{safeRecipe.name}</Text>
        {Array.isArray(tags) && tags.length > 0 && (
          <View style={styles.recipeTags}>
            {tags.map(tag => (
              <View key={tag?.id || Math.random().toString()} style={styles.recipeTag}>
                <Text style={styles.recipeTagText}>{tag?.name || ''}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.recipeInfo}>
          {safeRecipe.prepTime !== null && safeRecipe.prepTime > 0 && (
            <View style={styles.timeInfo}>
              <MaterialIcons name="timer" size={14} color="#666" />
              <Text style={styles.timeText}> {formatTime(safeRecipe.prepTime || 0)}</Text>
            </View>
          )}
          {safeRecipe.totalTime !== null && safeRecipe.totalTime > 0 && (
            <View style={styles.timeInfo}>
              <MaterialIcons name="schedule" size={14} color="#666" />
              <Text style={styles.timeText}> {formatTime(safeRecipe.totalTime || 0)}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={handleDelete}
        >
          <MaterialIcons name="close" size={24} color="#F44336" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.approveButton}
          onPress={handleApprove}
        >
          <MaterialIcons name="check" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// Enhance component to observe recipe tags and recipe image
const enhance = withObservables(['recipe'], ({ recipe }: { recipe: Recipe }) => ({
  recipe,
  tags: Tag.observeForRecipe(database, recipe.id),
  recipeImage: recipe.syncId 
    ? RecipeImage.observeForRecipe(database, recipe.syncId)
    : of(null)
}));

export const EnhancedPendingRecipeCard = enhance(PendingRecipeCard);

// Add default export for Expo Router compatibility
export default EnhancedPendingRecipeCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  recipeTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  recipeTag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  recipeTagText: {
    color: '#5c7ba9',
    fontSize: 12,
  },
  recipeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    fontSize: 12,
    color: '#666',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 4,
  },
  approveButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
}); 