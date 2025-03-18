import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../../database';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import Ingredient from '../../../database/models/Ingredient';
import { RecipeHeader } from './RecipeHeader';
import { RecipeRating } from './RecipeRating';
import { ServingsProvider } from './ServingsContext';
import { ServingsAdjuster } from './ServingsAdjuster';
import { ScaledIngredient } from './ScaledIngredient';
import { InstructionStep } from './InstructionStep';
import { formatTime } from '../../../app/utils/timeFormat';

interface RecipeDetailsScreenProps {
  recipe: Recipe | null;
  tags: Tag[];
  ingredients: Ingredient[];
}

const RecipeDetailsScreen = ({ recipe, tags, ingredients }: RecipeDetailsScreenProps) => {
  const [isStepChecked, setIsStepChecked] = useState<boolean[]>([]);
  
  useEffect(() => {
    if (recipe) {
      const stepsCount = recipe.instructions.split('\n')
        .map(instruction => instruction.trim())
        .filter(instruction => instruction.length > 0)
        .length;
      setIsStepChecked(new Array(stepsCount).fill(false));
    }
  }, [recipe]);

  const toggleStep = (index: number) => {
    setIsStepChecked(prev => {
      const newState = [...prev];
      newState[index] = !newState[index];
      return newState;
    });
  };

  const handleRatingChange = async (newRating: number) => {
    try {
      await recipe?.updateRating(newRating);
    } catch (error) {
      console.error('Błąd podczas aktualizacji oceny:', error);
    }
  };

  const handleOpenVideo = () => {
    if (recipe && recipe.video) {
      Linking.openURL(recipe.video);
    }
  };

  const handleOpenSource = () => {
    if (recipe && recipe.source && recipe.source.startsWith('http')) {
      Linking.openURL(recipe.source);
    }
  };

  const handleApproveRecipe = async () => {
    try {
      await recipe?.toggleApproval();
      router.back();
    } catch (error) {
      console.error('Błąd podczas akceptowania przepisu:', error);
    }
  };

  if (!recipe) {
    return <Text>Ładowanie przepisu...</Text>;
  }

  return (
    <ServingsProvider>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: recipe.isApproved ? 16 : 80 }}>
        <RecipeHeader recipe={recipe} />
        
        <View style={styles.content}>
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
                <Text style={styles.infoText}>Przygotowanie: {formatTime(recipe.prepTime)}</Text>
              </View>
            )}
            {recipe.totalTime !== null && recipe.totalTime > 0 && (
              <View style={styles.infoItem}>
                <MaterialIcons name="schedule" size={24} color="#666" />
                <Text style={styles.infoText}>Całkowity czas: {formatTime(recipe.totalTime)}</Text>
              </View>
            )}
          </View>

          {recipe.isApproved && (
            <RecipeRating rating={recipe.rating} onRatingChange={handleRatingChange} />
          )}

          {recipe.isApproved && recipe.servings !== null && recipe.servings > 0 && (
            <ServingsAdjuster 
              originalServings={recipe.servings} 
              ingredients={ingredients}
              recipeName={recipe.name}
            />
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Składniki</Text>
            {ingredients.map((ingredient, index) => (
              <View key={index} style={styles.ingredientRow}>
                {recipe.isApproved ? (
                  <ScaledIngredient key={index} ingredient={ingredient} />
                ) : (
                  <Text style={styles.sectionContent}>
                    {ingredient.amount !== null && ingredient.amount !== 0 && `${ingredient.amount} `}
                    {ingredient.unit && `${ingredient.unit} `}
                    {ingredient.name || ingredient.originalStr}
                  </Text>
                )}
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instrukcje</Text>
            {recipe.instructions.split('\n')
              .map(instruction => instruction.trim())
              .filter(instruction => instruction.length > 0)
              .map((instruction, index) => (
                <InstructionStep
                  key={index}
                  step={instruction}
                  stepNumber={index + 1}
                />
              ))}
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
      
      {!recipe.isApproved && (
        <View style={styles.approveButtonContainer}>
          <TouchableOpacity 
            style={styles.approveButton}
            onPress={handleApproveRecipe}
          >
            <MaterialIcons name="check-circle" size={20} color="#fff" style={styles.approveIcon} />
            <Text style={styles.approveButtonText}>Zaakceptuj przepis</Text>
          </TouchableOpacity>
        </View>
      )}
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
    paddingTop: 36,
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
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  instructionRow: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 1,
  },
  instructionRowChecked: {
    backgroundColor: '#CCCCCC',
  },
  instructionContent: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
  },
  stepNumber: {
    fontWeight: '500',
    color: '#2196F3',
  },
  textChecked: {
    color: '#fff',
  },
  approveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  approveButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveIcon: {
    marginRight: 8,
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 