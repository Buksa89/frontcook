// src/features/recipes/components/FilterMenu.tsx
import React from 'react';
import { Modal, Pressable, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../../database';
import Tag from '../../../database/models/Tag'; // Upewnij się, że importujesz Tag
import { FilterState } from '../types'; // Importuj typy z tego samego katalogu

interface FilterMenuProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState; // Aktualny stan filtrów
  onFiltersChange: (newFilters: FilterState) => void; // Funkcja do aktualizacji filtrów
  availableTags: Tag[]; // Dostępne tagi z HOC
  // Usunięto userId z propsów komponentu UI, bo jest tylko dla HOC
}

// Propsy oczekiwane przez HOC (zawierają userId)
interface EnhancedFilterMenuProps extends Omit<FilterMenuProps, 'availableTags'> {
    userId: string | null;
    availableTags: Tag[]; // Z HOC
}

// Komponent wewnętrzny UI (bez zmian)
const FilterMenuComponent: React.FC<FilterMenuProps> = ({
  visible,
  onClose,
  filters,
  onFiltersChange,
  availableTags
}) => {

  // Sprawdzenie, czy jakikolwiek filtr jest aktywny
  const hasActiveFilters =
    filters.selectedTags.length > 0 ||
    filters.minRating !== null ||
    filters.maxPrepTime !== null ||
    filters.maxTotalTime !== null;

  // Funkcja do czyszczenia wszystkich filtrów
  const handleClearFilters = () => {
    onFiltersChange({
      selectedTags: [],
      minRating: null,
      maxPrepTime: null,
      maxTotalTime: null,
      searchPhrase: filters.searchPhrase // Zachowaj frazę wyszukiwania
    });
    // Nie zamykaj modala automatycznie, użytkownik może chcieć zastosować zmiany
  };

  // Funkcja do przełączania tagu
  const toggleTag = (tag: Tag) => {
    const isSelected = filters.selectedTags.some(t => t.id === tag.id);
    const newSelectedTags = isSelected
      ? filters.selectedTags.filter(t => t.id !== tag.id)
      : [...filters.selectedTags, tag];
    onFiltersChange({ ...filters, selectedTags: newSelectedTags });
  };

  // Funkcja do zmiany minimalnej oceny
  const changeMinRating = (rating: number) => {
    onFiltersChange({
      ...filters,
      minRating: filters.minRating === rating ? null : rating // Odznacz, jeśli kliknięto to samo
    });
  };

   // Funkcja do zmiany maksymalnego czasu przygotowania
   const changeMaxPrepTime = (time: number | null) => {
    onFiltersChange({
      ...filters,
      maxPrepTime: filters.maxPrepTime === time ? null : time
    });
  };

  // Funkcja do zmiany maksymalnego czasu całkowitego
  const changeMaxTotalTime = (time: number | null) => {
    onFiltersChange({
      ...filters,
      maxTotalTime: filters.maxTotalTime === time ? null : time
    });
  };

  // Predefiniowane opcje czasowe
  const prepTimeOptions = [15, 30, 45, 60];
  const totalTimeOptions = [30, 60, 90, 120];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.menuContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Filtruj przepisy</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filterContent}>
            {/* Sekcja Tagi */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Tagi</Text>
              <View style={styles.tagsWrapper}>
                {(availableTags || []).map((tag) => { // Dodano fallback dla availableTags
                  const isSelected = filters.selectedTags.some(t => t.id === tag.id);
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      style={[styles.tagChip, isSelected && styles.tagChipSelected]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text style={[styles.tagChipText, isSelected && styles.tagChipTextSelected]}>
                        {tag.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Sekcja Ocena */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Minimalna ocena</Text>
              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map(rating => (
                  <TouchableOpacity key={rating} onPress={() => changeMinRating(rating)} style={styles.starButton}>
                    <Ionicons
                      name={rating <= (filters.minRating || 0) ? "star" : "star-outline"}
                      size={32}
                      color={rating <= (filters.minRating || 0) ? "#FFA41C" : "#D4D4D4"}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sekcja Czas przygotowania */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Maks. czas przygotowania</Text>
              <View style={styles.timeOptionsContainer}>
                {prepTimeOptions.map(time => (
                   <TouchableOpacity
                     key={`prep-${time}`}
                     style={[styles.timeButton, filters.maxPrepTime === time && styles.timeButtonSelected]}
                     onPress={() => changeMaxPrepTime(time)}
                   >
                     <Text style={[styles.timeButtonText, filters.maxPrepTime === time && styles.timeButtonTextSelected]}>
                       {time} min
                     </Text>
                   </TouchableOpacity>
                ))}
                 <TouchableOpacity // Przycisk do odznaczenia
                     style={[styles.timeButton, filters.maxPrepTime === null && styles.timeButtonSelected]}
                     onPress={() => changeMaxPrepTime(null)}
                   >
                     <Text style={[styles.timeButtonText, filters.maxPrepTime === null && styles.timeButtonTextSelected]}>
                       ∞
                     </Text>
                   </TouchableOpacity>
              </View>
            </View>

            {/* Sekcja Czas całkowity */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Maks. czas całkowity</Text>
              <View style={styles.timeOptionsContainer}>
                {totalTimeOptions.map(time => (
                  <TouchableOpacity
                    key={`total-${time}`}
                    style={[styles.timeButton, filters.maxTotalTime === time && styles.timeButtonSelected]}
                    onPress={() => changeMaxTotalTime(time)}
                  >
                    <Text style={[styles.timeButtonText, filters.maxTotalTime === time && styles.timeButtonTextSelected]}>
                      {time} min
                    </Text>
                  </TouchableOpacity>
                ))}
                 <TouchableOpacity // Przycisk do odznaczenia
                     style={[styles.timeButton, filters.maxTotalTime === null && styles.timeButtonSelected]}
                     onPress={() => changeMaxTotalTime(null)}
                   >
                     <Text style={[styles.timeButtonText, filters.maxTotalTime === null && styles.timeButtonTextSelected]}>
                       ∞
                     </Text>
                   </TouchableOpacity>
              </View>
            </View>

            <View style={{ height: 80 }} /> {/* Dodatkowy margines na dole ScrollView */}
          </ScrollView>

          {/* Stopka z przyciskami */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.footerButton, styles.clearButton, !hasActiveFilters && styles.disabledButton]}
              onPress={handleClearFilters}
              disabled={!hasActiveFilters}
            >
              <Text style={[styles.footerButtonText, styles.clearButtonText]}>Wyczyść filtry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerButton, styles.applyButton]}
              onPress={onClose} // Tylko zamknij modal, zmiany są stosowane na bieżąco
            >
              <Text style={[styles.footerButtonText, styles.applyButtonText]}>Zastosuj</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

// HOC do obserwowania dostępnych tagów - TERAZ ZALEŻY OD userId
const enhance = withObservables(
    ['userId'], // <<< DODAJ userId DO TRIGGERÓW
    ({ userId }: { userId: string | null }) => ({ // <<< POBIERZ userId Z PROPSÓW
        availableTags: Tag.observeAll(database, userId) // <<< PRZEKAŻ userId
    })
);

// Komponent eksportowany - opakowuje komponent UI i zarządza propsami z HOC
export const EnhancedFilterMenu = enhance(
    // Oczekujemy propsów EnhancedFilterMenuProps (w tym userId i availableTags z HOC)
    // ale przekazujemy tylko te, które oczekuje FilterMenuComponent
    ({ userId, availableTags, ...rest }: EnhancedFilterMenuProps) => {
        // Przefiltrowujemy propsy, aby nie przekazać userId do FilterMenuComponent
        // Przekazujemy availableTags z HOC
        return <FilterMenuComponent availableTags={availableTags} {...rest} />;
    }
);

// --- Style (bez zmian) ---
const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'flex-end',
    },
    menuContainer: {
      backgroundColor: 'white',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 8,
      height: '85%', // Zajmij większość ekranu
      overflow: 'hidden', // Ukryj zawartość wychodzącą poza modal
    },
    menuHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    menuTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#333',
    },
    filterContent: {
      flex: 1, // Pozwól ScrollView zająć dostępną przestrzeń
      padding: 20,
    },
    filterSection: {
      marginBottom: 24,
    },
    filterSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#495057',
      marginBottom: 12,
    },
    tagsWrapper: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8, // Odstępy między tagami
    },
    tagChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 18,
      backgroundColor: '#e9ecef',
      borderWidth: 1,
      borderColor: '#dee2e6',
    },
    tagChipSelected: {
      backgroundColor: '#5c7ba9',
      borderColor: '#4a628a',
    },
    tagChipText: {
      fontSize: 14,
      color: '#495057',
      fontWeight: '500',
    },
    tagChipTextSelected: {
      color: '#fff',
    },
    ratingContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around', // Równomierne rozłożenie gwiazdek
      alignItems: 'center',
      paddingVertical: 8,
    },
    starButton: {
      padding: 4, // Zwiększ obszar klikalny
    },
    timeOptionsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10, // Odstępy między przyciskami czasu
    },
    timeButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: '#e9ecef',
      borderWidth: 1,
      borderColor: '#dee2e6',
    },
    timeButtonSelected: {
      backgroundColor: '#5c7ba9',
      borderColor: '#4a628a',
    },
    timeButtonText: {
      fontSize: 14,
      color: '#495057',
      fontWeight: '500',
    },
    timeButtonTextSelected: {
      color: '#fff',
    },
    footer: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: '#e9ecef',
      padding: 16,
      backgroundColor: '#fff', // Tło dla stopki
    },
    footerButton: {
      flex: 1, // Rozciągnij przyciski
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginHorizontal: 8, // Odstęp między przyciskami
    },
    clearButton: {
      backgroundColor: '#f1f3f5', // Jasnoszary przycisk
      borderWidth: 1,
      borderColor: '#dee2e6',
    },
    applyButton: {
      backgroundColor: '#5c7ba9',
    },
    footerButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    clearButtonText: {
      color: '#495057',
    },
    applyButtonText: {
      color: '#fff',
    },
    disabledButton: {
        opacity: 0.5, // Zmniejsz przezroczystość dla nieaktywnego
        backgroundColor: '#e9ecef', // Szare tło
     },
});