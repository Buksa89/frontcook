import React, { useState, useCallback, useContext, useEffect } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../../database';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import Tag from '../../../database/models/Tag';
import Recipe from '../../../database/models/Recipe';
import RecipeTag from '../../../database/models/RecipeTag';
import { Q } from '@nozbe/watermelondb';
import { Observable, from } from 'rxjs';
import { router } from 'expo-router';
import { switchMap, map } from 'rxjs/operators';
import { ResetFiltersContext } from '../../_layout';
import { of } from 'rxjs';
import { EnhancedTagList } from './TagList';
import { FilterState, SortOption, MaterialIconName } from './types';
import { AddRecipeMenu } from './AddRecipeMenu';
import { SortMenu } from './SortMenu';
import { EnhancedFilterMenu } from './FilterMenu';
import { EnhancedRecipeCard } from './RecipeCard';
import { useAuth } from '../../../app/context';
import { asyncStorageService } from '../../../app/services/storage';

interface EnhanceRecipeListProps {
  sortBy: SortOption['key'] | null;
  filters: FilterState;
}

const sortOptions: SortOption[] = [
  { key: 'name', label: 'Nazwa (A-Z)', icon: 'sort-by-alpha' },
  { key: 'rating', label: 'Ocena (najwyższa)', icon: 'grade' },
  { key: 'prepTime', label: 'Czas przygotowania', icon: 'schedule' },
  { key: 'totalTime', label: 'Czas całkowity', icon: 'schedule' },
];

const RecipeList = ({ recipes }: { recipes: Recipe[] }) => (
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
);

const enhance = withObservables(['sortBy', 'filters'], ({ sortBy, filters }: EnhanceRecipeListProps) => ({
  recipes: from(asyncStorageService.getActiveUser()).pipe(
    switchMap(activeUser => 
      database.get<Recipe>('recipes')
        .query(
          Q.experimentalJoinTables(['recipe_tags']),
          Q.and(
            activeUser ? Q.where('owner', activeUser) : Q.where('owner', null),
            Q.where('is_deleted', false),
            filters.searchPhrase ? Q.where('name', Q.like(`%${filters.searchPhrase}%`)) : Q.where('id', Q.notEq(null)),
            filters.minRating ? Q.where('rating', Q.gte(filters.minRating)) : Q.where('id', Q.notEq(null)),
            filters.maxPrepTime ? Q.where('prep_time', Q.lte(filters.maxPrepTime)) : Q.where('id', Q.notEq(null)),
            filters.selectedTags.length > 0
              ? Q.on('recipe_tags', 'tag_id', Q.oneOf(filters.selectedTags.map((tag: Tag) => tag.id)))
              : Q.where('id', Q.notEq(null))
          )
        )
        .observe()
        .pipe(
          map(recipes => {
            let sortedRecipes = [...recipes];
            switch (sortBy) {
              case 'name':
                sortedRecipes.sort((a, b) => a.name.localeCompare(b.name));
                break;
              case 'rating':
                sortedRecipes.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
              case 'prepTime':
                sortedRecipes.sort((a, b) => (a.prepTime || 0) - (b.prepTime || 0));
                break;
              case 'totalTime':
                sortedRecipes.sort((a, b) => (a.totalTime || 0) - (b.totalTime || 0));
                break;
              default:
                break;
            }
            return sortedRecipes;
          })
        )
    )
  )
}));

const EnhancedRecipeList = enhance(RecipeList);

export default function RecipeListScreen() {
  const { reloadKey } = useAuth();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption['key'] | null>(null);
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
    setSortBy(null);
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
              sortBy && styles.filterButtonActive
            ]}
            onPress={() => setShowSortMenu(true)}
          >
            <MaterialIcons 
              name="sort" 
              size={20} 
              color={sortBy ? "#2196F3" : "#666"} 
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
        sortBy={sortBy}
        filters={filters}
        reloadKey={reloadKey}
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
        sortOptions={sortOptions}
        currentSort={sortBy}
        onSortChange={setSortBy}
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
