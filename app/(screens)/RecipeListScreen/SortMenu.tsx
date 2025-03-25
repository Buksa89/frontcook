import React from 'react';
import { Modal, Pressable, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SortOption } from './types';

interface SortMenuProps {
  visible: boolean;
  onClose: () => void;
  currentSort: SortOption['key'] | null;
  onSortChange: (sort: SortOption['key'] | null) => void;
  sortOptions: SortOption[];
}

export const SortMenu = ({ visible, onClose, currentSort, onSortChange, sortOptions }: SortMenuProps) => (
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
      <View style={styles.menuContainer}>
        <View style={styles.menuHeader}>
          <Text style={styles.menuTitle}>Sortuj przepisy</Text>
          <TouchableOpacity onPress={onClose}>
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
              onSortChange(currentSort === option.key ? null : option.key);
              onClose();
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
                  color={currentSort === option.key ? "#fff" : "#666"} 
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
              <MaterialIcons name="check" size={24} color="#5c7ba9" />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </Pressable>
  </Modal>
);

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
  menuItemSelected: {
    backgroundColor: '#f5f5f5',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  menuItemTextSelected: {
    color: '#5c7ba9',
    fontWeight: '600',
  },
  iconContainerSelected: {
    backgroundColor: '#5c7ba9',
  },
}); 