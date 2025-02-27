import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../database';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';

const RecipeDetailsScreen = ({ recipe }) => {
  if (!recipe) {
    return (
      <View style={styles.container}>
        <Text>Ładowanie...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
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

      <View style={styles.content}>
        <Text style={styles.title}>{recipe.name}</Text>
        
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

        <View style={styles.rating}>
          {[1, 2, 3, 4, 5].map(star => (
            <AntDesign 
              key={star}
              name={star <= (recipe.rating || 0) ? "star" : "staro"}
              size={24} 
              color="#FFD700"
            />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Składniki</Text>
          <Text style={styles.sectionContent}>{recipe.ingredients}</Text>
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

const enhance = withObservables(['recipeId'], ({ recipeId }) => ({
  recipe: database.get('recipes').findAndObserve(recipeId)
}));

const EnhancedRecipeDetailsScreen = enhance(RecipeDetailsScreen);

export default function RecipeDetails() {
  const { id } = useLocalSearchParams();
  return <EnhancedRecipeDetailsScreen recipeId={id} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  content: {
    padding: 16,
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
  rating: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 24,
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
}); 