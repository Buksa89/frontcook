// src/features/recipes/components/SortMenu.tsx
import React from 'react';
import { Modal, Pressable, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SortOption } from '../types'; // Importuj typy z tego samego katalogu

interface SortMenuProps {
  visible: boolean;
  onClose: () => void;
  currentSort: SortOption['key'] | null;
  onSortChange: (sortKey: SortOption['key'] | null) => void;
  sortOptions: SortOption[]; // Przekazujemy opcje jako props
}

export const SortMenu: React.FC<SortMenuProps> = ({
  visible,
  onClose,
  currentSort,
  onSortChange,
  sortOptions
}) => {

  const handleSelectSort = (sortKey: SortOption['key']) => {
    // Jeśli kliknięto aktualnie wybrane sortowanie, wyczyść je
    if (currentSort === sortKey) {
      onSortChange(null);
    } else {
      onSortChange(sortKey);
    }
    onClose(); // Zamknij modal po wyborze
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade" // Użyj fade dla spójności
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.menuContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Sortuj przepisy</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Opcja: Domyślne (brak sortowania) */}
          <TouchableOpacity
            style={[
              styles.menuItem,
              currentSort === null && styles.menuItemSelected // Zaznacz, jeśli brak sortowania
            ]}
            onPress={() => handleSelectSort(null as any)} // Wyczyść sortowanie
          >
            <View style={styles.menuItemContent}>
              <View style={[styles.iconContainer, currentSort === null && styles.iconContainerSelected]}>
                 {/* Ikona dla braku sortowania */}
                 <MaterialIcons name="sort" size={24} color={currentSort === null ? "#fff" : "#666"} />
              </View>
              <Text style={[styles.menuItemText, currentSort === null && styles.menuItemTextSelected]}>
                Domyślnie
              </Text>
            </View>
            {currentSort === null && (
              <MaterialIcons name="check" size={24} color="#5c7ba9" />
            )}
          </TouchableOpacity>

          {/* Dynamiczne opcje sortowania */}
          {sortOptions.map((option) => {
            const isSelected = currentSort === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.menuItem, isSelected && styles.menuItemSelected]}
                onPress={() => handleSelectSort(option.key)}
              >
                <View style={styles.menuItemContent}>
                  <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                    <MaterialIcons name={option.icon} size={24} color={isSelected ? "#fff" : "#666"} />
                  </View>
                  <Text style={[styles.menuItemText, isSelected && styles.menuItemTextSelected]}>
                    {option.label}
                  </Text>
                </View>
                {isSelected && (
                  <MaterialIcons name="check" size={24} color="#5c7ba9" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
};

// --- Style ---
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Lepszy overlay
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    paddingTop: 8,
    maxHeight: '70%', // Ogranicz wysokość
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f3f5', // Jasnoszare tło
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemSelected: {
    backgroundColor: '#f8f9fa', // Bardzo lekkie tło dla zaznaczonego
  },
  iconContainerSelected: {
    backgroundColor: '#5c7ba9', // Niebieskie tło dla ikony zaznaczonej
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  menuItemTextSelected: {
    fontWeight: '600', // Pogrubienie dla zaznaczonego
    color: '#5c7ba9', // Niebieski tekst
  },
});