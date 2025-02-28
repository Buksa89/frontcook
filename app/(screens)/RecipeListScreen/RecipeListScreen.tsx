import React, { useState, useCallback, useContext, useEffect } from 'react';
import { View, FlatList, StyleSheet, Text, Image, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../../database';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { Model } from '@nozbe/watermelondb';
import Tag from '../../../database/models/Tag';
import Recipe from '../../../database/models/Recipe';
import RecipeTag from '../../../database/models/RecipeTag';
import { Q } from '@nozbe/watermelondb';
import { Observable } from 'rxjs';
import { router } from 'expo-router';
import { map, switchMap } from 'rxjs/operators';
import { ResetFiltersContext } from '../../_layout';
import { of } from 'rxjs';

interface TagListProps {
  tags: Tag[];
  selectedTags: Tag[];
  onSelectTag: (tag: Tag) => void;
}

// Base component that receives tags as a prop
const TagList = ({ tags, selectedTags, onSelectTag }: TagListProps) => (
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
          selectedTags.some(t => t.id === tag.id) && styles.tagButtonSelected
        ]}
        onPress={() => onSelectTag(tag)}
      >
        <Text style={[
          styles.tagText,
          selectedTags.some(t => t.id === tag.id) && styles.tagTextSelected
        ]}>
          {tag.name}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

// Enhance the TagList component to observe tags from the database
const enhance = withObservables<{ selectedTags: Tag[]; onSelectTag: (tag: Tag) => void }, { tags: Observable<Tag[]> }>([], () => ({
  tags: database.get('tags').query().observe() as Observable<Tag[]>
}));

const EnhancedTagList = enhance(TagList);

interface RecipeCardProps {
  recipe: Recipe;
  tags: Tag[];
}

const RecipeCard = ({ recipe, tags }: RecipeCardProps) => (
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
      onPress={() => router.push({
        pathname: '/(screens)/ShoppingListScreen/ShoppingListScreen'
      })}
    >
      <AntDesign name="shoppingcart" size={24} color="#2196F3" />
    </TouchableOpacity>
  </TouchableOpacity>
);

// Enhance RecipeCard to observe recipe tags
const enhanceRecipeCard = withObservables(['recipe'], ({ recipe }: { recipe: Recipe }) => ({
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
    )
}));

const EnhancedRecipeCard = enhanceRecipeCard(RecipeCard);

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

interface FilterState {
  selectedTags: Tag[];
  minRating: number | null;
  maxPrepTime: number | null;
  maxTotalTime: number | null;
  searchPhrase: string;
}

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
                recipe.ingredients.toLowerCase().includes(searchLower) ||
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
              router.push({
                pathname: '/(screens)/RecipeManagementScreen/RecipeManagementScreen'
              });
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

  // Enhance FilterMenu to observe available tags
  const EnhancedFilterMenu = withObservables([], () => ({
    availableTags: database.get<Tag>('tags').query().observe()
  }))(({ availableTags }: { availableTags: Tag[] }) => {
    const handleClearFilters = () => {
      setFilters({
        selectedTags: [],
        minRating: null,
        maxPrepTime: null,
        maxTotalTime: null,
        searchPhrase: ''
      });
      setShowFilterMenu(false);
    };

    const hasActiveFilters = 
      filters.selectedTags.length > 0 ||
      filters.minRating !== null ||
      filters.maxPrepTime !== null ||
      filters.maxTotalTime !== null;

    return (
      <Modal
        visible={showFilterMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFilterMenu(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowFilterMenu(false)}
        >
          <View style={[styles.menuContainer, styles.filterMenuContainer]}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Filtruj przepisy</Text>
              <TouchableOpacity onPress={() => setShowFilterMenu(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterContent}>
              {/* Tagi */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Tagi</Text>
                <View style={styles.filterTags}>
                  {availableTags.map((tag: Tag) => (
                    <TouchableOpacity
                      key={tag.id}
                      style={[
                        styles.filterTag,
                        filters.selectedTags.some(t => t.id === tag.id) && styles.filterTagSelected
                      ]}
                      onPress={() => {
                        const isSelected = filters.selectedTags.some(t => t.id === tag.id);
                        setFilters(prev => ({
                          ...prev,
                          selectedTags: isSelected
                            ? prev.selectedTags.filter(t => t.id !== tag.id)
                            : [...prev.selectedTags, tag]
                        }));
                      }}
                    >
                      <Text style={[
                        styles.filterTagText,
                        filters.selectedTags.some(t => t.id === tag.id) && styles.filterTagTextSelected
                      ]}>
                        {tag.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Ocena */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Minimalna ocena</Text>
                <View style={styles.ratingFilter}>
                  {[1, 2, 3, 4, 5].map(rating => (
                    <TouchableOpacity
                      key={rating}
                      onPress={() => setFilters(prev => ({
                        ...prev,
                        minRating: prev.minRating === rating ? null : rating
                      }))}
                    >
                      <AntDesign
                        name={rating <= (filters.minRating || 0) ? "star" : "staro"}
                        size={32}
                        color="#FFD700"
                        style={styles.filterStar}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Czas przygotowania */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Maksymalny czas przygotowania</Text>
                <View style={styles.timeFilter}>
                  {[15, 30, 45, 60].map(time => (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.timeButton,
                        filters.maxPrepTime === time && styles.timeButtonSelected
                      ]}
                      onPress={() => setFilters(prev => ({
                        ...prev,
                        maxPrepTime: prev.maxPrepTime === time ? null : time
                      }))}
                    >
                      <Text style={[
                        styles.timeButtonText,
                        filters.maxPrepTime === time && styles.timeButtonTextSelected
                      ]}>
                        {time} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Całkowity czas */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Maksymalny czas całkowity</Text>
                <View style={styles.timeFilter}>
                  {[30, 60, 90, 120].map(time => (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.timeButton,
                        filters.maxTotalTime === time && styles.timeButtonSelected
                      ]}
                      onPress={() => setFilters(prev => ({
                        ...prev,
                        maxTotalTime: prev.maxTotalTime === time ? null : time
                      }))}
                    >
                      <Text style={[
                        styles.timeButtonText,
                        filters.maxTotalTime === time && styles.timeButtonTextSelected
                      ]}>
                        {time} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {hasActiveFilters && (
              <View style={styles.filterActions}>
                <TouchableOpacity 
                  style={styles.clearFiltersButton}
                  onPress={handleClearFilters}
                >
                  <Text style={styles.clearFiltersText}>Wyczyść filtry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
    );
  });

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

      <AddRecipeMenu />
      <SortMenu />
      <EnhancedFilterMenu />
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
  filterMenuContainer: {
    height: '80%',
  },
  filterContent: {
    flex: 1,
    padding: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  filterTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  filterTagSelected: {
    backgroundColor: '#2196F3',
  },
  filterTagText: {
    fontSize: 14,
    color: '#666',
  },
  filterTagTextSelected: {
    color: '#fff',
  },
  ratingFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterStar: {
    marginHorizontal: 2,
  },
  timeFilter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  timeButtonSelected: {
    backgroundColor: '#2196F3',
  },
  timeButtonText: {
    fontSize: 14,
    color: '#666',
  },
  timeButtonTextSelected: {
    color: '#fff',
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  clearFiltersButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  clearFiltersText: {
    fontSize: 14,
    color: '#666',
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
