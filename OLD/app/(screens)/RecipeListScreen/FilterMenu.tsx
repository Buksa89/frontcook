import React from 'react';
import { Modal, Pressable, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons, AntDesign, Ionicons } from '@expo/vector-icons';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../../database';
import Tag from '../../../database/models/Tag';
import { FilterState } from './types';
import { asyncStorageService } from '../../../app/services/storage';
import { Q } from '@nozbe/watermelondb';
import { from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

interface FilterMenuProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableTags: Tag[];
}

const FilterMenu = ({ visible, onClose, filters, onFiltersChange, availableTags }: FilterMenuProps) => {
  const handleClearFilters = () => {
    onFiltersChange({
      selectedTags: [],
      minRating: null,
      maxPrepTime: null,
      maxTotalTime: null,
      searchPhrase: ''
    });
    onClose();
  };

  const hasActiveFilters = 
    filters.selectedTags.length > 0 ||
    filters.minRating !== null ||
    filters.maxPrepTime !== null ||
    filters.maxTotalTime !== null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={onClose}
      >
        <View style={[styles.menuContainer, styles.filterMenuContainer]}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Filtruj przepisy</Text>
            <TouchableOpacity onPress={onClose}>
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
                      onFiltersChange({
                        ...filters,
                        selectedTags: isSelected
                          ? filters.selectedTags.filter(t => t.id !== tag.id)
                          : [...filters.selectedTags, tag]
                      });
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
                    onPress={() => onFiltersChange({
                      ...filters,
                      minRating: filters.minRating === rating ? null : rating
                    })}
                    style={styles.filterStar}
                  >
                    <Ionicons
                      name={rating <= (filters.minRating || 0) ? "star" : "star-outline"}
                      size={32}
                      color={rating <= (filters.minRating || 0) ? "#FFA41C" : "#D4D4D4"}
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
                    onPress={() => onFiltersChange({
                      ...filters,
                      maxPrepTime: filters.maxPrepTime === time ? null : time
                    })}
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
                    onPress={() => onFiltersChange({
                      ...filters,
                      maxTotalTime: filters.maxTotalTime === time ? null : time
                    })}
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
};

const enhance = withObservables([], () => ({
  availableTags: Tag.observeAll(database)
}));

export const EnhancedFilterMenu = enhance(FilterMenu);

// Add default export for Expo Router compatibility
export default EnhancedFilterMenu;

const styles = StyleSheet.create({
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
    backgroundColor: '#5c7ba9',
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
    padding: 2,
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
    backgroundColor: '#5c7ba9',
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
}); 