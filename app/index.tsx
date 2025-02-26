import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { recipes } from '../data/recipes';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../database';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { Model } from '@nozbe/watermelondb';
import Tag from '../database/models/Tag';
import { Observable } from 'rxjs';

interface TagListProps {
  tags: Tag[];
  selectedTag: string | null;
  onSelectTag: (id: string | null) => void;
}

// Base component that receives tags as a prop
const TagList = ({ tags, selectedTag, onSelectTag }: TagListProps) => (
  <ScrollView 
    horizontal 
    showsHorizontalScrollIndicator={false}
    style={styles.tagsScroll}
    contentContainerStyle={styles.tagsContainer}
  >
    {tags.map(tag => (
      <TouchableOpacity
        key={tag.id}
        style={[
          styles.tagButton,
          selectedTag === tag.id && styles.tagButtonSelected
        ]}
        onPress={() => onSelectTag(selectedTag === tag.id ? null : tag.id)}
      >
        <Text style={[
          styles.tagText,
          selectedTag === tag.id && styles.tagTextSelected
        ]}>
          {tag.displayName}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

// Enhance the TagList component to observe tags from the database
const enhance = withObservables<{ selectedTag: string | null; onSelectTag: (id: string | null) => void }, { tags: Observable<Tag[]> }>([], () => ({
  tags: database.get('tags').query().observe() as Observable<Tag[]>
}));

const EnhancedTagList = enhance(TagList);

interface Recipe {
  id: string;
  name: string;
  image: string;
  rating?: number;
  tags?: string[];
}

const RecipeCard = ({ recipe }: { recipe: Recipe }) => (
  <TouchableOpacity 
    style={styles.card}
    onPress={() => console.log('Otwarto przepis:', recipe.name)}
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
      <View style={styles.tagsList}>
        {recipe.tags?.slice(0, 2).map(tag => (
          <Text 
            key={tag} 
            style={styles.recipeTag}
            onPress={() => console.log('Wybrano tag:', tag)}
          >
            {tag}
          </Text>
        ))}
      </View>
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
    </View>
    <TouchableOpacity 
      style={styles.cardShopCart}
      onPress={() => console.log('Dodano do koszyka:', recipe.name)}
    >
      <AntDesign name="shoppingcart" size={24} color="#2196F3" />
    </TouchableOpacity>
  </TouchableOpacity>
);

export default function RecipeListScreen() {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Convert recipe IDs to strings for TypeScript compatibility
  const formattedRecipes: Recipe[] = recipes.map(recipe => ({
    ...recipe,
    id: String(recipe.id)
  }));

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <EnhancedTagList 
          selectedTag={selectedTag} 
          onSelectTag={setSelectedTag}
        />
        <View style={styles.filterButtons}>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => console.log('Sortowanie przepisów')}
          >
            <MaterialIcons name="sort" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => console.log('Filtrowanie przepisów')}
          >
            <MaterialIcons name="tune" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={formattedRecipes}
        renderItem={({ item }) => <RecipeCard recipe={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
      />
      
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={[styles.fab, { marginRight: 16 }]}
          onPress={() => console.log('Dodaj nowy przepis')}
        >
          <AntDesign name="plus" size={24} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => console.log('Otwórz koszyk')}
        >
          <AntDesign name="shoppingcart" size={24} color="white" />
        </TouchableOpacity>
      </View>
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
  tagsList: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  recipeTag: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  rating: {
    flexDirection: 'row',
    gap: 2,
  },
  cardShopCart: {
    padding: 8,
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
  filterBar: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagsScroll: {
    flex: 1,
    marginRight: 4,
  },
  tagsContainer: {
    paddingLeft: 16,
    paddingRight: 8,
    gap: 8,
    flexDirection: 'row',
  },
  tagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  tagButtonSelected: {
    backgroundColor: '#2196F3',
  },
  tagText: {
    fontSize: 14,
    color: '#666',
  },
  tagTextSelected: {
    color: '#fff',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
    paddingLeft: 8,
  },
  filterButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 8,
    width: 36,
    height: 36,
  },
});
