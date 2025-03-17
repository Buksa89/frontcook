import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity, Alert, Image } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../../database';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import Recipe from '../../../database/models/Recipe';
import { Q } from '@nozbe/watermelondb';
import { router } from 'expo-router';
import { map, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import Tag from '../../../database/models/Tag';
import Ingredient from '../../../database/models/Ingredient';
import { useAuth } from '../../context';
import { AddRecipeMenu } from '../RecipeListScreen/AddRecipeMenu';
import { formatTime } from '../../../app/utils/timeFormat';

interface PendingRecipesListProps {
  activeUser: string | null;
}

interface PendingRecipeCardProps {
  recipe: Recipe;
  tags: Tag[];
  onApprove: () => void;
  onDelete: () => void;
}

const PendingRecipeCard = ({ recipe, tags, onApprove, onDelete }: PendingRecipeCardProps) => {
  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push({
        pathname: '/(screens)/RecipeDetailScreen/RecipeDetailScreen',
        params: { recipeId: recipe.id }
      })}
    >
      <View style={[styles.imageContainer, styles.imagePlaceholder]}>
        <Image
          source={{ uri: recipe.image }}
          style={styles.image}
          onError={(e) => console.log('Błąd ładowania zdjęcia:', recipe.name)}
        />
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
          {recipe.prepTime > 0 && (
            <Text style={styles.timeInfo}>
              <MaterialIcons name="timer" size={14} color="#666" /> {formatTime(recipe.prepTime)}
            </Text>
          )}
          {recipe.totalTime > 0 && (
            <Text style={styles.timeInfo}>
              <MaterialIcons name="schedule" size={14} color="#666" /> {formatTime(recipe.totalTime)}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={onDelete}
        >
          <MaterialIcons name="close" size={24} color="#F44336" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.approveButton}
          onPress={onApprove}
        >
          <MaterialIcons name="check" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// Enhance PendingRecipeCard to observe recipe tags
const enhancePendingCard = withObservables(['recipe'], ({ recipe }: { recipe: Recipe }) => ({
  recipe,
  tags: Tag.observeForRecipe(database, recipe.id),
}));

const EnhancedPendingRecipeCard = enhancePendingCard(PendingRecipeCard);

const PendingRecipesList = ({ recipes }: { recipes: Recipe[] }) => {
  const handleApprove = async (recipe: Recipe) => {
    try {
      await recipe.toggleApproval();
      Alert.alert('Sukces', 'Przepis został zaakceptowany.');
    } catch (error) {
      console.error('Błąd podczas akceptowania przepisu:', error);
      Alert.alert('Błąd', 'Nie udało się zaakceptować przepisu.');
    }
  };

  const handleDelete = async (recipe: Recipe) => {
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
    <FlatList
      data={recipes}
      renderItem={({ item }) => (
        <EnhancedPendingRecipeCard 
          recipe={item} 
          onApprove={() => handleApprove(item)}
          onDelete={() => handleDelete(item)}
        />
      )}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="pending-actions" size={80} color="#ccc" style={styles.emptyIcon} />
          <Text style={styles.emptyText}>Brak przepisów do akceptacji</Text>
          <Text style={styles.emptySubText}>Wszystkie przepisy zostały już zaakceptowane</Text>
        </View>
      )}
    />
  );
};

const enhance = withObservables(['activeUser'], ({ activeUser }: PendingRecipesListProps) => ({
  recipes: database.collections
    .get<Recipe>('recipes')
    .query(
      Q.where('is_approved', false),
      Q.where('is_deleted', false),
      Q.where('owner', activeUser || '')
    )
    .observe()
    .pipe(
      map(recipes => {
        // Możemy dodać dodatkowe przetwarzanie jeśli potrzebne
        return recipes;
      })
    )
}));

const EnhancedPendingRecipesList = enhance(PendingRecipesList);

export default function PendingRecipesScreen() {
  const { active_user } = useAuth();
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <View style={styles.container}>
      <EnhancedPendingRecipesList activeUser={active_user} />
      
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={[styles.fab, { marginRight: 16 }]}
          onPress={() => setShowAddMenu(true)}
        >
          <AntDesign name="plus" size={24} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => router.push({
            pathname: '/(screens)/ShoppingListScreen/ShoppingListScreen'
          })}
        >
          <AntDesign name="shoppingcart" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <AddRecipeMenu visible={showAddMenu} onClose={() => setShowAddMenu(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  list: {
    paddingHorizontal: 8,
    paddingBottom: 100,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
  },
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