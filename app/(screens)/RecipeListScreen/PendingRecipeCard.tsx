import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Alert, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { withObservables } from '@nozbe/watermelondb/react';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import database from '../../../database';
import { formatTime } from '../../../app/utils/timeFormat';

// Komponent karty przepisu oczekującego na zatwierdzenie
interface PendingRecipeCardProps {
  recipe: Recipe;
  tags: Tag[];
}

const PendingRecipeCard = ({ recipe, tags }: PendingRecipeCardProps) => {
  const handleApprove = async () => {
    try {
      await recipe.toggleApproval();
      Alert.alert('Sukces', 'Przepis został zaakceptowany.');
    } catch (error) {
      console.error('Błąd podczas akceptowania przepisu:', error);
      Alert.alert('Błąd', 'Nie udało się zaakceptować przepisu.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Potwierdź usunięcie',
      `Czy na pewno chcesz usunąć przepis "${recipe.name}"?`,
      [
        {
          text: 'Anuluj',
          style: 'cancel'
        },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            try {
              await recipe.markAsDeleted();
              Alert.alert('Sukces', 'Przepis został usunięty.');
            } catch (error) {
              console.error('Błąd podczas usuwania przepisu:', error);
              Alert.alert('Błąd', 'Nie udało się usunąć przepisu.');
            }
          }
        }
      ]
    );
  };

  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push({
        pathname: '/(screens)/RecipeDetailScreen/RecipeDetailScreen',
        params: { recipeId: recipe.id }
      })}
    >
      <View style={[styles.imageContainer, styles.imagePlaceholder]}>
        {recipe.image && (
          <Image
            source={{ uri: recipe.image }}
            style={styles.image}
            onError={(e) => console.log('Błąd ładowania zdjęcia:', recipe.name)}
          />
        )}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.title}>{recipe.name}</Text>
        {tags.length > 0 && (
          <View style={styles.recipeTags}>
            {tags.map(tag => (
              <View key={tag.id} style={styles.recipeTag}>
                <Text style={styles.recipeTagText}>{tag.name}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.recipeInfo}>
          {recipe.prepTime !== null && recipe.prepTime > 0 && (
            <Text style={styles.timeInfo}>
              <MaterialIcons name="timer" size={14} color="#666" /> {formatTime(recipe.prepTime)}
            </Text>
          )}
          {recipe.totalTime !== null && recipe.totalTime > 0 && (
            <Text style={styles.timeInfo}>
              <MaterialIcons name="schedule" size={14} color="#666" /> {formatTime(recipe.totalTime)}
            </Text>
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

// Enhance PendingRecipeCard do obserwacji tagów przepisu
const enhancePendingCard = withObservables(['recipe'], ({ recipe }: { recipe: Recipe }) => ({
  recipe,
  tags: Tag.observeForRecipe(database, recipe.id),
}));

export const EnhancedPendingRecipeCard = enhancePendingCard(PendingRecipeCard);

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
    color: '#2196F3',
    fontSize: 12,
  },
  recipeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  timeInfo: {
    fontSize: 12,
    color: '#666',
    alignItems: 'center',
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