import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { switchMap } from 'rxjs/operators';
import database from '../../../database';
import Tag from '../../../database/models/Tag';
import Recipe from '../../../database/models/Recipe';
import RecipeTag from '../../../database/models/RecipeTag';
import Ingredient from '../../../database/models/Ingredient';
import { Q } from '@nozbe/watermelondb';
import { Observable } from 'rxjs';
import { AddShopingItemMenu } from '../../../app/components/AddShopingItemMenu';
import { ServingsProvider, useServings } from '../../(screens)/RecipeDetailScreen/ServingsContext';

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
  
  const openAddShopingItemMenu = () => {
    setMenuVisible(true);
  };
  
  const closeAddShopingItemMenu = () => {
    setMenuVisible(false);
  };

  return (
    <>
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
            <View style={styles.rating}>
              {[1, 2, 3, 4, 5].map(star => (
                <AntDesign 
                  key={star}
                  name={star <= (recipe.rating || 0) ? "star" : "staro"}
                  size={16} 
                  color="#FFD700"
                />
              ))}
            </View>
            {recipe.prepTime > 0 && (
              <Text style={styles.timeInfo}>
                <MaterialIcons name="timer" size={14} color="#666" /> {recipe.prepTime} min
              </Text>
            )}
            {recipe.totalTime > 0 && (
              <Text style={styles.timeInfo}>
                <MaterialIcons name="schedule" size={14} color="#666" /> {recipe.totalTime} min
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity 
          style={styles.cardShopCart}
          onPress={openAddShopingItemMenu}
        >
          <AntDesign name="shoppingcart" size={24} color="#2196F3" />
        </TouchableOpacity>
      </TouchableOpacity>
      
      <ServingsProviderWithInitialValue servings={recipe.servings}>
        <AddShopingItemMenu 
          visible={menuVisible}
          onClose={closeAddShopingItemMenu}
          ingredients={ingredients}
          recipeName={recipe.name}
        />
      </ServingsProviderWithInitialValue>
    </>
  );
};

// Enhance RecipeCard to observe recipe tags and ingredients
const enhance = withObservables(['recipe'], ({ recipe }: { recipe: Recipe }) => ({
  recipe,
  tags: database
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
    ),
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
    )
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
    color: '#2196F3',
    fontSize: 12,
  },
  rating: {
    flexDirection: 'row',
    gap: 2,
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
    fontSize: 12,
    color: '#666',
    alignItems: 'center',
  },
}); 