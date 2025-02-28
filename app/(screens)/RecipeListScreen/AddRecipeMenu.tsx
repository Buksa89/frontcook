import React from 'react';
import { Modal, Pressable, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface AddRecipeMenuProps {
  visible: boolean;
  onClose: () => void;
}

export const AddRecipeMenu = ({ visible, onClose }: AddRecipeMenuProps) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="slide"
    onRequestClose={onClose}
  >
    <Pressable 
      style={styles.modalOverlay}
      onPress={onClose}
    >
      <View style={styles.menuContainer}>
        <View style={styles.menuHeader}>
          <Text style={styles.menuTitle}>Dodaj przepis</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => {
            onClose();
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
}); 