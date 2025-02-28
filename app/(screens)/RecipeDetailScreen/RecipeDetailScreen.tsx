import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../../database';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import RecipeTag from '../../../database/models/RecipeTag';
import Ingredient from '../../../database/models/Ingredient';
import { Q } from '@nozbe/watermelondb';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { RecipeHeader } from './RecipeHeader';
import { RecipeRating } from './RecipeRating';

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
      await database.write(async () => {
        await recipe.update(recipe => {
          recipe.rating = newRating;
        });
      });
    } catch (error) {
      console.error('Błąd podczas aktualizacji oceny:', error);
    }
  };

  return (
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
          {recipe.prepTime > 0 && (
            <View style={styles.infoItem}>
              <MaterialIcons name="timer" size={24} color="#666" />
              <Text style={styles.infoText}>Przygotowanie: {recipe.prepTime} min</Text>
            </View>
          )}
          {recipe.totalTime > 0 && (
            <View style={styles.infoItem}>
              <MaterialIcons name="schedule" size={24} color="#666" />
              <Text style={styles.infoText}>Całkowity czas: {recipe.totalTime} min</Text>
            </View>
          )}
          {recipe.servings > 0 && (
            <View style={styles.infoItem}>
              <MaterialIcons name="people" size={24} color="#666" />
              <Text style={styles.infoText}>Porcje: {recipe.servings}</Text>
            </View>
          )}
        </View>

        <RecipeRating rating={recipe.rating} onRatingChange={handleRatingChange} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Składniki</Text>
          <View style={styles.ingredientsList}>
            {ingredients.map((ingredient, index) => (
              <Text key={ingredient.id} style={styles.ingredientItem}>
                {ingredient.originalStr}
              </Text>
            ))}
          </View>
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
      </View>
    </ScrollView>
  );
};

const enhance = withObservables(['recipeId'], ({ recipeId }: { recipeId: string }) => ({
  recipe: database.get<Recipe>('recipes').findAndObserve(recipeId),
  ingredients: database.get<Recipe>('recipes')
    .findAndObserve(recipeId)
    .pipe(
      switchMap(recipe => {
        if (!recipe) return new Observable<Ingredient[]>(subscriber => subscriber.next([]));
        return database
          .get<Ingredient>('ingredients')
          .query(Q.where('recipe_id', recipe.id))
          .observe();
      })
    ),
  tags: database.get<Recipe>('recipes')
    .findAndObserve(recipeId)
    .pipe(
      switchMap(recipe => {
        if (!recipe) return new Observable<Tag[]>(subscriber => subscriber.next([]));
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
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
  },
  ingredientsList: {
    marginTop: 8,
  },
  ingredientItem: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
    marginBottom: 8,
    paddingLeft: 4,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#2196F3',
    fontSize: 14,
  },
}); 