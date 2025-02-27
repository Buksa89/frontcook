import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Text, Image, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../database';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { Model } from '@nozbe/watermelondb';
import Tag from '../database/models/Tag';
import Recipe from '../database/models/Recipe';
import { Observable } from 'rxjs';
import { router } from 'expo-router';
import { map } from 'rxjs/operators';

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
          {tag.name}
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

interface RecipeCardProps {
  recipe: Recipe;
}

const RecipeCard = ({ recipe }: RecipeCardProps) => (
  <TouchableOpacity 
    style={styles.card}
    onPress={() => router.push({
      pathname: '/recipe-details',
      params: { id: recipe.id }
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

// Dodaj typy sortowania
type MaterialIconName = 'sort-by-alpha' | 'grade' | 'schedule';

type SortOption = {
  key: 'name' | 'rating' | 'totalTime';
  label: string;
  icon: MaterialIconName;
};

const sortOptions: SortOption[] = [
  { key: 'name', label: 'Nazwa (A-Z)', icon: 'sort-by-alpha' },
  { key: 'rating', label: 'Ocena (najwyższa)', icon: 'grade' },
  { key: 'totalTime', label: 'Czas przygotowania', icon: 'schedule' },
];

// Enhance RecipeCard to observe recipes with sorting
const enhanceRecipeList = withObservables<
  { selectedTag: string | null; sortBy: SortOption['key'] | null },
  { recipes: Observable<Recipe[]> }
>(
  ['selectedTag', 'sortBy'],
  ({ selectedTag, sortBy }) => ({
    recipes: database.get<Recipe>('recipes')
      .query()
      .observe()
      .pipe(
        map((recipes) => {
          let sortedRecipes = [...recipes] as Recipe[];
          if (sortBy) {
            sortedRecipes.sort((a, b) => {
              switch (sortBy) {
                case 'name':
                  return a.name.localeCompare(b.name);
                case 'rating':
                  return (b.rating || 0) - (a.rating || 0);
                case 'totalTime':
                  return (a.totalTime || 0) - (b.totalTime || 0);
                default:
                  return 0;
              }
            });
          } else {
            // Domyślne sortowanie po nazwie
            sortedRecipes.sort((a, b) => a.name.localeCompare(b.name));
          }
          return sortedRecipes;
        })
      )
  })
);

const EnhancedRecipeList = enhanceRecipeList(
  ({ recipes }) => (
    <>
      <FlatList
        data={recipes}
        renderItem={({ item }) => <RecipeCard recipe={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="menu-book" size={80} color="#ccc" style={styles.emptyIcon} />
            <Text style={styles.emptyText}>Nie znaleziono przepisów</Text>
            <Text style={styles.emptySubText}>Dodaj swój pierwszy przepis!</Text>
          </View>
        )}
      />
    </>
  )
);

export default function RecipeListScreen() {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [currentSort, setCurrentSort] = useState<SortOption['key'] | null>(null);

  const AddRecipeMenu = () => (
    <Modal
      visible={showAddMenu}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAddMenu(false)}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={() => setShowAddMenu(false)}
      >
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Dodaj przepis</Text>
            <TouchableOpacity onPress={() => setShowAddMenu(false)}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {
              setShowAddMenu(false);
              router.push('/add-recipe');
            }}
          >
            <View style={styles.menuItemContent}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="edit" size={24} color="#2196F3" />
              </View>
              <Text style={styles.menuItemText}>Dodaj ręcznie</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, styles.menuItemDisabled]}
            disabled={true}
          >
            <View style={styles.menuItemContent}>
              <View style={[styles.iconContainer, styles.iconContainerDisabled]}>
                <MaterialIcons name="camera-alt" size={24} color="#999" />
              </View>
              <Text style={styles.menuItemTextDisabled}>Zeskanuj</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ddd" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, styles.menuItemDisabled]}
            disabled={true}
          >
            <View style={styles.menuItemContent}>
              <View style={[styles.iconContainer, styles.iconContainerDisabled]}>
                <MaterialIcons name="language" size={24} color="#999" />
              </View>
              <Text style={styles.menuItemTextDisabled}>Z internetu</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ddd" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, styles.menuItemDisabled]}
            disabled={true}
          >
            <View style={styles.menuItemContent}>
              <View style={[styles.iconContainer, styles.iconContainerDisabled]}>
                <MaterialIcons name="picture-as-pdf" size={24} color="#999" />
              </View>
              <Text style={styles.menuItemTextDisabled}>Cały PDF</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ddd" />
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );

  const SortMenu = () => (
    <Modal
      visible={showSortMenu}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowSortMenu(false)}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={() => setShowSortMenu(false)}
      >
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Sortuj przepisy</Text>
            <TouchableOpacity onPress={() => setShowSortMenu(false)}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          {sortOptions.map((option) => (
            <TouchableOpacity 
              key={option.key}
              style={[
                styles.menuItem,
                currentSort === option.key && styles.menuItemSelected
              ]}
              onPress={() => {
                setCurrentSort(currentSort === option.key ? null : option.key);
                setShowSortMenu(false);
              }}
            >
              <View style={styles.menuItemContent}>
                <View style={[
                  styles.iconContainer,
                  currentSort === option.key && styles.iconContainerSelected
                ]}>
                  <MaterialIcons 
                    name={option.icon} 
                    size={24} 
                    color={currentSort === option.key ? "#fff" : "#2196F3"} 
                  />
                </View>
                <Text style={[
                  styles.menuItemText,
                  currentSort === option.key && styles.menuItemTextSelected
                ]}>
                  {option.label}
                </Text>
              </View>
              {currentSort === option.key && (
                <MaterialIcons name="check" size={24} color="#2196F3" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <EnhancedTagList 
          selectedTag={selectedTag} 
          onSelectTag={setSelectedTag}
        />
        <View style={styles.filterButtons}>
          <TouchableOpacity 
            style={[
              styles.filterButton,
              currentSort && styles.filterButtonActive
            ]}
            onPress={() => setShowSortMenu(true)}
          >
            <MaterialIcons 
              name="sort" 
              size={20} 
              color={currentSort ? "#2196F3" : "#666"} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => console.log('Filtrowanie przepisów')}
          >
            <MaterialIcons name="tune" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      <EnhancedRecipeList selectedTag={selectedTag} sortBy={currentSort} />
      
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={[styles.fab, { marginRight: 16 }]}
          onPress={() => setShowAddMenu(true)}
        >
          <AntDesign name="plus" size={24} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => router.push('/shopping-list')}
        >
          <AntDesign name="shoppingcart" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <AddRecipeMenu />
      <SortMenu />
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    width: '100%',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconContainerDisabled: {
    backgroundColor: '#f0f0f0',
  },
  menuItemDisabled: {
    opacity: 0.7,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  menuItemTextDisabled: {
    fontSize: 16,
    color: '#999',
  },
  menuItemSelected: {
    backgroundColor: '#f5f5f5',
  },
  menuItemTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  iconContainerSelected: {
    backgroundColor: '#2196F3',
  },
  filterButtonActive: {
    backgroundColor: '#e3f2fd',
  },
});
