import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../../database';
import { AntDesign, MaterialIcons, Feather } from '@expo/vector-icons';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import RecipeTag from '../../../database/models/RecipeTag';
import Ingredient from '../../../database/models/Ingredient';
import { Q } from '@nozbe/watermelondb';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { RecipeHeader } from './RecipeHeader';
import { RecipeRating } from './RecipeRating';
import { ServingsProvider } from './ServingsContext';
import { ServingsAdjuster } from './ServingsAdjuster';
import { ScaledIngredient } from './ScaledIngredient';
import { asyncStorageService } from '../../../app/services/storage';

interface RecipeDetailsScreenProps {
  recipe: Recipe | null;
  tags: Tag[];
  ingredients: Ingredient[];
}

const RecipeDetailsScreen = ({ recipe, tags, ingredients }: RecipeDetailsScreenProps) => {
  if (!recipe) {
    return (
      <View style={styles.container}>
        <Text>Ładowanie...</Text>
      </View>
    );
  }

  const handleRatingChange = async (newRating: number) => {
    try {
      await recipe?.updateRating(newRating);
    } catch (error) {
      console.error('Błąd podczas aktualizacji oceny:', error);
    }
  };

  const handleOpenVideo = () => {
    if (recipe.video && recipe.video.trim() !== '') {
      Linking.openURL(recipe.video);
    }
  };

  const handleOpenSource = () => {
    if (recipe.source && recipe.source.trim() !== '' && recipe.source.startsWith('http')) {
      Linking.openURL(recipe.source);
    }
  };

  return (
    <ServingsProvider>
      <ScrollView style={styles.container}>
        <RecipeHeader recipe={recipe} />

        <View style={styles.content}>
          <Text style={styles.title}>{recipe.name}</Text>
          
          {tags.length > 0 && (
            <View style={styles.tags}>
              {tags.map(tag => (
                <View key={tag.id} style={styles.tag}>
                  <Text style={styles.tagText}>{tag.name}</Text>
                </View>
              ))}
            </View>
          )}

          {recipe.description && (
            <Text style={styles.description}>{recipe.description}</Text>
          )}

          <View style={styles.infoRow}>
            {recipe.prepTime !== null && recipe.prepTime > 0 && (
              <View style={styles.infoItem}>
                <MaterialIcons name="timer" size={24} color="#666" />
                <Text style={styles.infoText}>Przygotowanie: {recipe.prepTime} min</Text>
              </View>
            )}
            {recipe.totalTime !== null && recipe.totalTime > 0 && (
              <View style={styles.infoItem}>
                <MaterialIcons name="schedule" size={24} color="#666" />
                <Text style={styles.infoText}>Całkowity czas: {recipe.totalTime} min</Text>
              </View>
            )}
          </View>

          <RecipeRating rating={recipe.rating} onRatingChange={handleRatingChange} />

          {recipe.servings !== null && recipe.servings > 0 && (
            <ServingsAdjuster 
              originalServings={recipe.servings} 
              ingredients={ingredients}
              recipeName={recipe.name}
            />
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Składniki</Text>
            {ingredients.map((ingredient, index) => (
              <ScaledIngredient key={index} ingredient={ingredient} />
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instrukcje</Text>
            <Text style={styles.sectionContent}>{recipe.instructions}</Text>
          </View>

          {recipe.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notatki</Text>
              <Text style={styles.sectionContent}>{recipe.notes}</Text>
            </View>
          )}

          {recipe.nutrition && recipe.nutrition.trim() !== '' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Wartości odżywcze</Text>
              <Text style={styles.sectionContent}>{recipe.nutrition}</Text>
            </View>
          )}

          {recipe.video && recipe.video.trim() !== '' && (
            <TouchableOpacity 
              style={[styles.section, styles.linkSection]} 
              onPress={handleOpenVideo}
            >
              <View style={styles.linkContent}>
                <Feather name="video" size={20} color="#2196F3" />
                <Text style={styles.linkText}>Obejrzyj wideo</Text>
              </View>
              <Feather name="external-link" size={18} color="#2196F3" />
            </TouchableOpacity>
          )}

          {recipe.source && recipe.source.trim() !== '' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Źródło</Text>
              {recipe.source.startsWith('http') ? (
                <TouchableOpacity 
                  style={styles.linkContent} 
                  onPress={handleOpenSource}
                >
                  <Text style={styles.linkText}>{recipe.source}</Text>
                  <Feather name="external-link" size={16} color="#2196F3" />
                </TouchableOpacity>
              ) : (
                <Text style={styles.sectionContent}>{recipe.source}</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </ServingsProvider>
  );
};

const enhance = withObservables(['recipeId'], ({ recipeId }: { recipeId: string }) => ({
  recipe: database.get<Recipe>('recipes').findAndObserve(recipeId),
  tags: Tag.observeForRecipe(database, recipeId),
  ingredients: Ingredient.observeForRecipe(database, recipeId)
}));

const EnhancedRecipeDetailsScreen = enhance(RecipeDetailsScreen);

export default function RecipeDetails() {
  const params = useLocalSearchParams();
  const recipeId = typeof params.recipeId === 'string' ? params.recipeId : undefined;
                   
  if (!recipeId) {
    return (
      <View style={styles.container}>
        <Text>Nie znaleziono przepisu</Text>
      </View>
    );
  }

  return <EnhancedRecipeDetailsScreen recipeId={recipeId} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    lineHeight: 24,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: '#666',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  sectionContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
  },
  linkSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkText: {
    color: '#2196F3',
    fontSize: 16,
    marginLeft: 8,
  },
}); 