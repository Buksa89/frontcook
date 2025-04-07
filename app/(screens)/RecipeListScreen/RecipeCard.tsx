import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { AntDesign, MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { switchMap, map } from 'rxjs/operators';
import { Observable, from, of } from 'rxjs';
import database from '../../../database';
import Tag from '../../../database/models/Tag';
import Recipe from '../../../database/models/Recipe';
import Ingredient from '../../../database/models/Ingredient';
import { Q } from '@nozbe/watermelondb';
import { AddShopingItemMenu } from '../../../app/components/AddShopingItemMenu';
import { ServingsProvider, useServings } from '../../(screens)/RecipeDetailScreen/ServingsContext';
import { formatTime } from '../../../app/utils/timeFormat';

// Komponent opakowujący ServingsProvider, który ustawia początkowe wartości
const ServingsProviderWithInitialValue = ({ children, servings }: { children: React.ReactNode, servings: number | null }) => {
  return (
    <ServingsProvider>
      <ServingsInitializer servings={servings}>
        {children}
      </ServingsInitializer>
    </ServingsProvider>
  );
};

// Komponent inicjalizujący wartości w kontekście
const ServingsInitializer = ({ children, servings }: { children: React.ReactNode, servings: number | null }) => {
  const { setOriginalServings, setCurrentServings } = useServings();
  
  useEffect(() => {
    if (servings !== null && servings > 0) {
      setOriginalServings(servings);
      setCurrentServings(servings);
    }
  }, [servings, setOriginalServings, setCurrentServings]);
  
  return <>{children}</>;
};

interface RecipeCardProps {
  recipe: Recipe;
  tags: Tag[];
  ingredients: Ingredient[];
}

const RecipeCard = ({ recipe, tags, ingredients }: RecipeCardProps) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [isDeletingRecipe, setIsDeletingRecipe] = useState(false);
  const [thumbnailPath, setThumbnailPath] = useState<string | null>(null);
  const [isFetchingImage, setIsFetchingImage] = useState(true);

  // Use useFocusEffect to fetch thumbnail when the card potentially becomes visible
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const fetchThumbnail = async () => {
        if (!recipe) {
          if(isMounted) setThumbnailPath(null);
          return;
        }
        // Reset fetching state before fetch
        if(isMounted) {
          setIsFetchingImage(true);
          setThumbnailPath(null);
        }
        try {
          console.log(`[RecipeCard FocusEffect] Fetching thumbnail for Recipe ID: ${recipe.id}`);
          const path = await recipe.getThumbnailFromRecipeImage();
          if (isMounted) {
            console.log(`[RecipeCard FocusEffect] Fetched thumbnail path: ${path}`);
            setThumbnailPath(path);
          }
        } catch (error) {
          console.error(`[RecipeCard FocusEffect] Error fetching thumbnail for Recipe ID ${recipe.id}:`, error);
          if (isMounted) {
            setThumbnailPath(null); // Set to null on error
          }
        } finally {
          if (isMounted) {
            setIsFetchingImage(false);
          }
        }
      };
      fetchThumbnail();
      return () => {
        isMounted = false;
         console.log(`[RecipeCard FocusEffect] Cleanup for Recipe ID: ${recipe?.id}`);
      };
      // Note: The dependency array might need adjustment depending on how RecipeCard is used.
      // If the list itself re-renders with new recipe objects, [recipe] is fine.
      // If the same RecipeCard instance might receive different recipe props, this might need tuning.
    }, [recipe]) 
  );

  // Ensure recipe object has all required properties to prevent rendering issues
  const safeRecipe = {
    id: recipe?.id || '',
    name: recipe?.name || '',
    image: recipe?.image || null,
    rating: recipe?.rating || 0,
    prepTime: recipe?.prepTime || null,
    totalTime: recipe?.totalTime || null,
    servings: recipe?.servings || null,
  };

  // Use the fetched thumbnail path
  const thumbnailImage = thumbnailPath;

  const openAddShopingItemMenu = () => {
    setMenuVisible(true);
  };
  
  const closeAddShopingItemMenu = () => {
    setMenuVisible(false);
  };

  const handleEdit = () => {
    setContextMenuVisible(false);
    router.push({
      pathname: "/(screens)/RecipeManagementScreen/RecipeManagementScreen",
      params: { recipeId: safeRecipe.id }
    });
  };

  const handleDelete = () => {
    if (isDeletingRecipe) return;
    
    setContextMenuVisible(false);
    Alert.alert(
      "Usuń przepis",
      "Czy na pewno chcesz usunąć ten przepis? Tej operacji nie można cofnąć.",
      [
        {
          text: "Anuluj",
          style: "cancel",
          onPress: () => setIsDeletingRecipe(false)
        },
        {
          text: "Usuń",
          onPress: async () => {
            try {
              setIsDeletingRecipe(true);
              await recipe.markAsDeleted();
            } catch (error) {
              console.error("Błąd podczas usuwania przepisu:", error);
              setIsDeletingRecipe(false);
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const showContextMenu = () => {
    setContextMenuVisible(true);
  };

  // If recipe object is not properly initialized, render a safe fallback
  if (!recipe || typeof recipe !== 'object') {
    return null;
  }

  return (
    <>
      <TouchableOpacity 
        style={styles.card}
        onPress={() => router.push({
          pathname: '/(screens)/RecipeDetailScreen/RecipeDetailScreen',
          params: { recipeId: safeRecipe.id }
        })}
        onLongPress={showContextMenu}
        delayLongPress={500}
      >
        <View style={[styles.imageContainer, styles.imagePlaceholder]}>
          {isFetchingImage ? (
            <View style={[styles.image, styles.imagePlaceholder]} /> // Show placeholder while fetching
          ) : thumbnailImage ? (
            <Image
              key={thumbnailImage} // Add key
              source={{ 
                uri: thumbnailImage 
                }}
              style={styles.image}
              onError={(e) => console.log(`[RecipeCard] Błąd ładowania miniatury ${thumbnailImage}:`, e.nativeEvent.error)}
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
            <View style={styles.rating}>
              {[1, 2, 3, 4, 5].map(star => (
                <Ionicons 
                  key={star}
                  name={star <= (safeRecipe.rating || 0) ? "star" : "star-outline"}
                  size={14} 
                  color={star <= (safeRecipe.rating || 0) ? "#FFA41C" : "#D4D4D4"}
                  style={styles.starIcon}
                />
              ))}
              {safeRecipe.rating > 0 && (
                <Text style={styles.ratingText}>{safeRecipe.rating.toFixed(1)}</Text>
              )}
            </View>
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
        <TouchableOpacity 
          style={styles.cardShopCart}
          onPress={openAddShopingItemMenu}
        >
          <AntDesign name="shoppingcart" size={24} color="#5c7ba9" />
        </TouchableOpacity>
      </TouchableOpacity>
      
      <ServingsProviderWithInitialValue servings={safeRecipe.servings}>
        <AddShopingItemMenu 
          visible={menuVisible}
          onClose={closeAddShopingItemMenu}
          ingredients={Array.isArray(ingredients) ? ingredients : []}
          recipeName={safeRecipe.name}
        />
      </ServingsProviderWithInitialValue>

      {/* Menu kontekstowe */}
      <Modal
        visible={contextMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setContextMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setContextMenuVisible(false)}
        >
          <View style={styles.menuModal}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleEdit}
            >
              <Feather name="edit" size={20} color="#333" />
              <Text style={styles.menuItemText}>Edytuj</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDelete]}
              onPress={handleDelete}
            >
              <Feather name="trash-2" size={20} color="#ff4444" />
              <Text style={[styles.menuItemText, styles.menuItemTextDelete]}>Usuń</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// Enhance RecipeCard to observe recipe tags and ingredients
const enhance = withObservables(['recipe'], ({ recipe }: { recipe: Recipe }) => ({
  recipe,
  tags: Tag.observeForRecipe(database, recipe.id),
  ingredients: database.get<Recipe>('recipes')
    .findAndObserve(recipe.id)
    .pipe(
      switchMap(recipe => {
        if (!recipe) return new Observable<Ingredient[]>(subscriber => subscriber.next([]));
        return database
          .get<Ingredient>('ingredients')
          .query(Q.where('recipe_id', recipe.id))
          .observe();
      })
    ),
}));

export const EnhancedRecipeCard = enhance(RecipeCard);

export default EnhancedRecipeCard;

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
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    marginRight: 1,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 4,
  },
  cardShopCart: {
    padding: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuModal: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    minWidth: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 4,
  },
  menuItemDelete: {
    marginTop: 4,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#333',
  },
  menuItemTextDelete: {
    color: '#ff4444',
  },
}); 