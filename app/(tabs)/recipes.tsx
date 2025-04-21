// app/(tabs)/recipes.tsx
import React, { useState, useCallback, useContext, useEffect } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity, SectionList, ActivityIndicator } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../src/database';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import Tag from '../../src/database/models/Tag';
import Recipe from '../../src/database/models/Recipe';
import { Q, Model as WDBModel } from '@nozbe/watermelondb';
import { Observable, combineLatest, of, from } from 'rxjs';
import { router } from 'expo-router';
import { switchMap, map, distinctUntilChanged, startWith } from 'rxjs/operators';
import { EnhancedTagList } from '../../src/features/recipes/components/TagList';
import { FilterState, SortOption } from '../../src/features/recipes/types';
import { AddRecipeMenu } from '../../src/features/recipes/components/AddRecipeMenu';
import { SortMenu } from '../../src/features/recipes/components/SortMenu';
import { EnhancedFilterMenu } from '../../src/features/recipes/components/FilterMenu'; // Poprawiono import ścieżki
import { EnhancedRecipeCard } from '../../src/features/recipes/components/RecipeCard';
import { EnhancedPendingRecipeCard } from '../../src/features/recipes/components/PendingRecipeCard';
import { useAuth } from '../../src/contexts/AuthContext';
import RecipeTag from '../../src/database/models/RecipeTag';

// Definicja opcji sortowania (bez zmian)
const sortOptions: SortOption[] = [
  { key: 'name', label: 'Nazwa (A-Z)', icon: 'sort-by-alpha' },
  { key: 'rating', label: 'Ocena (najwyższa)', icon: 'star-rate' },
  { key: 'prepTime', label: 'Czas przygotowania', icon: 'timer' },
  { key: 'totalTime', label: 'Czas całkowity', icon: 'schedule' },
  { key: 'createdAt', label: 'Data dodania', icon: 'add-circle-outline' },
];

// Interfejs dla danych przekazywanych do HOC przepisów
interface RecipeListContainerProps {
  sortBy: SortOption['key'] | null;
  filters: FilterState;
  userId: string | null; // Nadal potrzebujemy userId dla logiki filtrowania tagów w HOC
}

// Interfejs dla danych otrzymywanych z HOC przepisów
interface ObservedProps {
  approvedRecipes: Recipe[];
  pendingRecipes: Recipe[];
  isLoading: boolean;
}

// Interfejs dla propsów zwracanych przez funkcję w withObservables dla przepisów
interface ObservableResult {
    itemsData: Observable<Omit<ObservedProps, 'isLoading'>>;
    isLoading: Observable<boolean>;
}

// --- Główny Komponent Listy UI (RecipeListComponent - bez zmian) ---
const RecipeListComponent: React.FC<Omit<ObservedProps, 'isLoading'>> = ({ approvedRecipes, pendingRecipes }) => {
  // ... (kod bez zmian) ...
    const sections = [];
    if (pendingRecipes && pendingRecipes.length > 0) {
      sections.push({ title: 'Oczekujące na zatwierdzenie', data: pendingRecipes, type: 'pending' as const });
    }
    if (approvedRecipes && approvedRecipes.length > 0) {
      sections.push({ title: 'Twoje przepisy', data: approvedRecipes, type: 'approved' as const });
    }

    const renderItem = ({ item, section }: { item: Recipe, section: { type: 'pending' | 'approved' } }) => {
      if (section.type === 'pending') {
        return <EnhancedPendingRecipeCard recipe={item} />;
      } else {
        return <EnhancedRecipeCard recipe={item} />;
      }
    };

    const renderSectionHeader = ({ section }: { section: { title: string | null } }) => {
      if (!section.title) return null;
      return <Text style={styles.sectionHeader}>{section.title}</Text>;
    };

    if (sections.length === 0) {
        return (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="menu-book" size={80} color="#ccc" />
              <Text style={styles.emptyText}>Brak przepisów</Text>
              <Text style={styles.emptySubText}>Dodaj swój pierwszy przepis przyciskiem +</Text>
            </View>
        );
    }

    return (
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
      />
    );
};

// --- Komponent opakowujący listę przepisów z logiką ładowania (bez zmian) ---
const RecipeListWrapper: React.FC<ObservedProps> = ({ approvedRecipes, pendingRecipes, isLoading }) => {
    // ... (kod bez zmian) ...
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5c7ba9" />
        </View>
      );
    }
    return <RecipeListComponent approvedRecipes={approvedRecipes} pendingRecipes={pendingRecipes} />;
};


// --- HOC withObservables dla listy przepisów ---
const enhanceRecipes = withObservables(
  ['sortBy', 'filters', 'userId'], // userId POZOSTAJE jako trigger, bo logika filtrowania tagów go używa
  ({ sortBy, filters, userId }: RecipeListContainerProps): ObservableResult => { // userId POZOSTAJE w propsach dla logiki filtrowania

    // --- POPRAWKA WYWOŁANIA: Usuń argument userId ---
    const approvedRecipesObsBase = Recipe.observeAllApproved(database); // Wywołaj z 1 argumentem
    const pendingRecipesObs = Recipe.observeAllPending(database);       // Wywołaj z 1 argumentem

    // --- Logika filtrowania i sortowania (używa userId dla zapytań M2M) ---
    const approvedRecipesFilteredObs = approvedRecipesObsBase.pipe(
      switchMap(recipes => {
        // Logika filtrowania tagów MUSI używać userId, które dostaliśmy jako prop HOC
        if (filters.selectedTags.length > 0 && userId) {
          const tagIds = filters.selectedTags.map(t => t.id);
          // Zapytanie M2M używa userId do filtrowania przepisów użytkownika
          return database.get<Recipe>(Recipe.table)
            .query(
              Q.where('user_id', userId), // Filtruj po userId!
              Q.where('is_approved', true),
              Q.experimentalJoinTables(['recipe_tags_through']),
              Q.on('recipe_tags_through', 'tag_id', Q.oneOf(tagIds))
            ).observe();
        }
        // Jeśli brak tagów LUB brak userId (choć observeAllApproved/Pending zwrócą pustą listę dla null userId),
        // zwróć oryginalną listę (która już jest pusta lub zawiera dane użytkownika).
        return of(recipes);
      }),
      // Dalsze filtrowanie i sortowanie po stronie klienta (bez zmian)
      map(recipes => {
          let filtered = recipes.filter(recipe => {
            const matchesSearch = !filters.searchPhrase || recipe.name.toLowerCase().includes(filters.searchPhrase.toLowerCase());
            const matchesRating = filters.minRating === null || (recipe.rating || 0) >= filters.minRating;
            const matchesPrepTime = filters.maxPrepTime === null || ((recipe.prepTime || 0) > 0 && (recipe.prepTime || Infinity) <= filters.maxPrepTime);
            const matchesTotalTime = filters.maxTotalTime === null || ((recipe.totalTime || 0) > 0 && (recipe.totalTime || Infinity) <= filters.maxTotalTime);
            return matchesSearch && matchesRating && matchesPrepTime && matchesTotalTime;
          });
          switch (sortBy) {
            case 'name': filtered.sort((a, b) => a.name.localeCompare(b.name)); break;
            case 'rating': filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
            case 'prepTime': filtered.sort((a, b) => (a.prepTime || Infinity) - (b.prepTime || Infinity)); break;
            case 'totalTime': filtered.sort((a, b) => (a.totalTime || Infinity) - (b.totalTime || Infinity)); break;
            case 'createdAt': filtered.sort((a, b) => b.createdAt - a.createdAt); break;
          }
          return filtered;
      })
    );

    const itemsDataObs: Observable<Omit<ObservedProps, 'isLoading'>> = combineLatest([
      approvedRecipesFilteredObs.pipe(startWith(undefined)),
      pendingRecipesObs.pipe(startWith(undefined))
    ]).pipe(
      map(([approved, pending]) => ({
        approvedRecipes: approved ?? [],
        pendingRecipes: pending ?? [],
      }))
    );

    const isLoadingObs: Observable<boolean> = combineLatest([
      approvedRecipesFilteredObs.pipe(startWith(undefined)),
      pendingRecipesObs.pipe(startWith(undefined))
    ]).pipe(
      map(([approved, pending]) => approved === undefined || pending === undefined),
      startWith(true),
      distinctUntilChanged()
    );

    return {
      itemsData: itemsDataObs,
      isLoading: isLoadingObs,
    };
  }
);

// Komponent opakowany przez HOC dla przepisów (bez zmian)
const EnhancedRecipeListComponent = enhanceRecipes(
  ({ itemsData, isLoading }: { itemsData: Omit<ObservedProps, 'isLoading'>, isLoading: boolean }) => {
    return (
      <RecipeListWrapper
        approvedRecipes={itemsData.approvedRecipes}
        pendingRecipes={itemsData.pendingRecipes}
        isLoading={isLoading}
      />
    );
  }
);

// --- Komponent Kontenera Zarządzający Stanem (bez zmian w logice stanu) ---
export function RecipeListScreenContainer() {
  const { userId } = useAuth(); // Pobierz userId
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption['key'] | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    selectedTags: [], minRating: null, maxPrepTime: null, maxTotalTime: null, searchPhrase: ''
  });

  // useCallback'i (bez zmian)
  const handleSearchChange = useCallback((text: string) => { /* ... */ setFilters(prev => ({ ...prev, searchPhrase: text })); }, []);
  const resetFiltersAndSort = useCallback(() => { /* ... */ console.log('Resetting filters and sorting'); setSortBy(null); setFilters({ selectedTags: [], minRating: null, maxPrepTime: null, maxTotalTime: null, searchPhrase: '' }); }, []);
  const handleTagSelect = useCallback((tag: Tag) => { /* ... */ setFilters(prev => { const isSelected = prev.selectedTags.some(t => t.id === tag.id); return { ...prev, selectedTags: isSelected ? prev.selectedTags.filter(t => t.id !== tag.id) : [...prev.selectedTags, tag] }; }); }, []);

  const hasActiveFilters = filters.selectedTags.length > 0 || filters.minRating !== null || filters.maxPrepTime !== null || filters.maxTotalTime !== null;

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        {/* Przekaż userId do EnhancedTagList, jeśli go potrzebuje */}
        <EnhancedTagList
          selectedTags={filters.selectedTags}
          onSelectTag={handleTagSelect}
          // userId={userId} // Odkomentuj, jeśli TagList tego wymaga (jeśli używa Tag.observeAll)
        />
        <View style={styles.filterButtons}>
          <TouchableOpacity style={[styles.filterButton, sortBy && styles.filterButtonActive]} onPress={() => setShowSortMenu(true)}>
            <MaterialIcons name="sort" size={20} color={sortBy ? "#5c7ba9" : "#666"} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]} onPress={() => setShowFilterMenu(true)}>
            <MaterialIcons name="tune" size={20} color={hasActiveFilters ? "#5c7ba9" : "#666"} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Przekaż userId do EnhancedRecipeListComponent */}
      <EnhancedRecipeListComponent sortBy={sortBy} filters={filters} userId={userId} />

      <View style={styles.fabContainer}>
        <TouchableOpacity style={[styles.fab, { marginRight: 16 }]} onPress={() => setShowAddMenu(true)}>
          <AntDesign name="plus" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/(tabs)/shoppingList')}>
          <AntDesign name="shoppingcart" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <AddRecipeMenu visible={showAddMenu} onClose={() => setShowAddMenu(false)} />
      <SortMenu visible={showSortMenu} onClose={() => setShowSortMenu(false)} sortOptions={sortOptions} currentSort={sortBy} onSortChange={setSortBy} />
      {/* Przekaż userId do EnhancedFilterMenu */}
      <EnhancedFilterMenu
        visible={showFilterMenu}
        onClose={() => setShowFilterMenu(false)}
        filters={filters}
        onFiltersChange={setFilters}
        userId={userId} // Przekaż userId jako prop
      />
    </View>
  );
}

export default RecipeListScreenContainer;

// --- Style (bez zmian) ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa', },
    filterBar: { paddingVertical: 8, paddingLeft: 0, borderBottomWidth: 1, borderBottomColor: '#e9ecef', flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', },
    filterButtons: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, },
    filterButton: { padding: 8, borderRadius: 20, backgroundColor: '#f1f3f5', },
    filterButtonActive: { backgroundColor: '#dbe4ff', }, // Jaśniejszy niebieski dla aktywnego
    listContent: { paddingBottom: 120, }, // Zwiększony padding na dole dla FAB
    sectionHeader: { fontSize: 14, fontWeight: '600', color: '#6c757d', backgroundColor: '#f8f9fa', paddingVertical: 8, paddingHorizontal: 16, marginTop: 8, textTransform: 'uppercase', },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa',},
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 50, },
    emptyText: { fontSize: 18, color: '#6c757d', fontWeight: '500', marginTop: 16, marginBottom: 8, textAlign: 'center', },
    emptySubText: { fontSize: 14, color: '#adb5bd', textAlign: 'center', },
    fabContainer: { position: 'absolute', bottom: 24, right: 24, flexDirection: 'row', gap: 16, },
    fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#5c7ba9', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, },
});

// Usunięto komponent FilterMenuComponent z tego pliku, zakładając, że jest w osobnym pliku
// Usunięto HOC enhance dla FilterMenu z tego pliku, zakładając, że jest w osobnym pliku