import React, { useState } from 'react';
import { Modal, Pressable, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../context';
import { WebImportModal } from './WebImportModal';
import { ScanRecipeModal } from './ScanRecipeModal';

interface AddRecipeMenuProps {
  visible: boolean;
  onClose: () => void;
}

export const AddRecipeMenu = ({ visible, onClose }: AddRecipeMenuProps) => {
  const { activeUser } = useAuth();
  const isAuthenticated = !!activeUser;
  const [showWebImportModal, setShowWebImportModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  const handleAuthRequiredPress = () => {
    Alert.alert("Wymagane logowanie", "Zaloguj się, aby uzyskać dostęp do tej funkcji");
  };

  return (
    <>
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
              style={[styles.menuItem, !isAuthenticated && styles.menuItemDisabled]}
              disabled={!isAuthenticated}
              onPress={() => {
                if (!isAuthenticated) {
                  handleAuthRequiredPress();
                  return;
                }
                onClose();
                setShowScanModal(true);
              }}
            >
              <View style={styles.menuItemContent}>
                <View style={[styles.iconContainer, !isAuthenticated && styles.iconContainerDisabled]}>
                  <MaterialIcons name="camera-alt" size={24} color={isAuthenticated ? "#2196F3" : "#999"} />
                </View>
                <Text style={isAuthenticated ? styles.menuItemText : styles.menuItemTextDisabled}>Zeskanuj</Text>
              </View>
              {!isAuthenticated && (
                <Text style={styles.requiresAuthText}>Wymaga logowania</Text>
              )}
              <MaterialIcons name="chevron-right" size={24} color={isAuthenticated ? "#666" : "#ddd"} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, !isAuthenticated && styles.menuItemDisabled]}
              disabled={!isAuthenticated}
              onPress={() => {
                if (!isAuthenticated) {
                  handleAuthRequiredPress();
                  return;
                }
                onClose();
                setShowWebImportModal(true);
              }}
            >
              <View style={styles.menuItemContent}>
                <View style={[styles.iconContainer, !isAuthenticated && styles.iconContainerDisabled]}>
                  <MaterialIcons name="language" size={24} color={isAuthenticated ? "#2196F3" : "#999"} />
                </View>
                <Text style={isAuthenticated ? styles.menuItemText : styles.menuItemTextDisabled}>Z internetu</Text>
              </View>
              {!isAuthenticated && (
                <Text style={styles.requiresAuthText}>Wymaga logowania</Text>
              )}
              <MaterialIcons name="chevron-right" size={24} color={isAuthenticated ? "#666" : "#ddd"} />
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
              <Text style={styles.comingSoonText}>Wkrótce</Text>
              <MaterialIcons name="chevron-right" size={24} color="#ddd" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <WebImportModal 
        visible={showWebImportModal} 
        onClose={() => setShowWebImportModal(false)} 
      />
      
      <ScanRecipeModal 
        visible={showScanModal} 
        onClose={() => setShowScanModal(false)} 
      />
    </>
  );
};

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
    flex: 1,
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
  requiresAuthText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginRight: 8,
  },
  comingSoonText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginRight: 8,
  },
}); 