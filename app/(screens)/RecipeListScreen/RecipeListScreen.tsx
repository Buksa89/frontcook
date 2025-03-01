import React, { useState, useCallback, useContext, useEffect } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../../database';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import Tag from '../../../database/models/Tag';
import Recipe from '../../../database/models/Recipe';
import RecipeTag from '../../../database/models/RecipeTag';
import { Q } from '@nozbe/watermelondb';
import { Observable } from 'rxjs';
import { router } from 'expo-router';
import { map, switchMap } from 'rxjs/operators';
import { ResetFiltersContext } from '../../_layout';
import { of } from 'rxjs';
import { EnhancedTagList } from './TagList';
import { FilterState, SortOption, MaterialIconName } from './types';
import { AddRecipeMenu } from './AddRecipeMenu';
import { SortMenu } from './SortMenu';
import { EnhancedFilterMenu } from './FilterMenu';
import { EnhancedRecipeCard } from './RecipeCard';

const sortOptions: SortOption[] = [
  { key: 'name', label: 'Nazwa (A-Z)', icon: 'sort-by-alpha' },
  { key: 'rating', label: 'Ocena (najwyższa)', icon: 'grade' },
  { key: 'totalTime', label: 'Czas przygotowania', icon: 'schedule' },
];

// Enhance RecipeCard to observe recipes with sorting
const enhanceRecipeList = withObservables<
  { 
    sortBy: SortOption['key'] | null;
    filters: FilterState;
  },
  { recipes: Observable<Recipe[]> }
>(
  ['sortBy', 'filters'],
  ({ sortBy, filters }) => ({
    recipes: database.get<Recipe>('recipes')
      .query()
      .observeWithColumns(['rating', 'name', 'prep_time', 'total_time', 'description', 'ingredients', 'instructions', 'notes'])
      .pipe(
        switchMap(recipes => {
          // First apply text search and basic filters
          let filteredRecipes = recipes.filter(recipe => {
            // Apply text search filter
            if (filters.searchPhrase) {
              const searchLower = filters.searchPhrase.toLowerCase();
              if (!(
                recipe.name.toLowerCase().includes(searchLower) ||
                recipe.description?.toLowerCase().includes(searchLower) ||
                recipe.instructions.toLowerCase().includes(searchLower) ||
                recipe.notes?.toLowerCase().includes(searchLower)
              )) {
                return false;
              }
            }

            // Apply rating filter
            if (filters.minRating !== null && (recipe.rating || 0) < filters.minRating) {
              return false;
            }

            // Apply time filters
            if (filters.maxPrepTime !== null && 
                (recipe.prepTime === 0 || recipe.prepTime > filters.maxPrepTime)) {
              return false;
            }

            if (filters.maxTotalTime !== null && 
                (recipe.totalTime === 0 || recipe.totalTime > filters.maxTotalTime)) {
              return false;
            }

            return true;
          });

          // If no tag filters, return current results
          if (filters.selectedTags.length === 0) {
            return of(filteredRecipes);
          }

          // Apply tag filters
          const tagIds = filters.selectedTags.map(tag => tag.id);
          return database
            .get<RecipeTag>('recipe_tags')
            .query(Q.where('tag_id', Q.oneOf(tagIds)))
            .observe()
            .pipe(
              map(recipeTags => {
                // Group recipe IDs by recipe to count tags
                const recipeTagCounts = new Map<string, number>();
                recipeTags.forEach(rt => {
                  recipeTagCounts.set(rt.recipeId, (recipeTagCounts.get(rt.recipeId) || 0) + 1);
                });

                // Filter recipes that have ALL selected tags
                return filteredRecipes.filter(recipe => 
                  recipeTagCounts.get(recipe.id) === tagIds.length
                );
              })
            );
        }),
        map(filteredRecipes => {
          // Apply sorting
          const recipesToSort = [...filteredRecipes];
          if (sortBy) {
            recipesToSort.sort((a, b) => {
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
            // Default sorting by name
            recipesToSort.sort((a, b) => a.name.localeCompare(b.name));
          }
          return recipesToSort;

          return filteredRecipes;
        })
      )
  })
);

const EnhancedRecipeList = enhanceRecipeList(
  ({ recipes }) => (
    <>
      <FlatList
        data={recipes}
        renderItem={({ item }) => <EnhancedRecipeCard recipe={item} />}
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
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [currentSort, setCurrentSort] = useState<SortOption['key'] | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    selectedTags: [],
    minRating: null,
    maxPrepTime: null,
    maxTotalTime: null,
    searchPhrase: ''
  });

  const handleSearchChange = useCallback((text: string) => {
    setFilters(prev => ({
      ...prev,
      searchPhrase: text
    }));
  }, []);

  // Reset function for filters and sorting
  const resetFiltersAndSort = useCallback(() => {
    console.log('Resetting filters and sorting');
    setCurrentSort(null);
    setFilters({
      selectedTags: [],
      minRating: null,
      maxPrepTime: null,
      maxTotalTime: null,
      searchPhrase: ''
    });
    console.log('Filters and sorting reset');
  }, []);

  // Update reset function in context
  const { setResetFunction, setSearchFunction } = useContext(ResetFiltersContext);
  
  useEffect(() => {
    console.log('Setting up reset function in context');
    setResetFunction(resetFiltersAndSort);
    setSearchFunction(handleSearchChange);
    console.log('Reset and search functions registered in context');
  }, [resetFiltersAndSort, handleSearchChange, setResetFunction, setSearchFunction]);

  const handleTagSelect = (tag: Tag) => {
    setFilters(prev => {
      const isSelected = prev.selectedTags.some(t => t.id === tag.id);
      return {
        ...prev,
        selectedTags: isSelected
          ? prev.selectedTags.filter(t => t.id !== tag.id)
          : [...prev.selectedTags, tag]
      };
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <EnhancedTagList 
          selectedTags={filters.selectedTags}
          onSelectTag={handleTagSelect}
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
            style={[
              styles.filterButton,
              (filters.selectedTags.length > 0 || 
               filters.minRating !== null || 
               filters.maxPrepTime !== null || 
               filters.maxTotalTime !== null) && styles.filterButtonActive
            ]}
            onPress={() => setShowFilterMenu(true)}
          >
            <MaterialIcons 
              name="tune" 
              size={20} 
              color={
                (filters.selectedTags.length > 0 || 
                 filters.minRating !== null || 
                 filters.maxPrepTime !== null || 
                 filters.maxTotalTime !== null) 
                  ? "#2196F3" 
                  : "#666"
              } 
            />
          </TouchableOpacity>
        </View>
      </View>

      <EnhancedRecipeList 
        sortBy={currentSort}
        filters={filters}
      />
      
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
      <SortMenu 
        visible={showSortMenu}
        onClose={() => setShowSortMenu(false)}
        currentSort={currentSort}
        onSortChange={setCurrentSort}
        sortOptions={sortOptions}
      />
      <EnhancedFilterMenu 
        visible={showFilterMenu}
        onClose={() => setShowFilterMenu(false)}
        filters={filters}
        onFiltersChange={setFilters}
      />
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
  filterBar: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
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
  filterButtonActive: {
    backgroundColor: '#e3f2fd',
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
});
