import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Pressable,
  FlatList
} from 'react-native';
import { AntDesign, MaterialIcons, Feather } from '@expo/vector-icons';
import Ingredient from '../../database/models/Ingredient';
import { useServings } from '../(screens)/RecipeDetailScreen/ServingsContext';
import { isIngredientScalable, scaleValue, formatScaledValue, calculateScaleFactor } from '../utils/scaling';

interface IngredientsMenuProps {
  visible: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  recipeName: string;
}

export const IngredientsMenu: React.FC<IngredientsMenuProps> = ({
  visible,
  onClose,
  ingredients,
  recipeName
}) => {
  const { 
    scaleFactor, 
    setScaleFactor, 
    originalServings, 
    currentServings, 
    setCurrentServings 
  } = useServings();
  
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());
  
  const toggleIngredient = (ingredientId: string) => {
    const newSelected = new Set(selectedIngredients);
    if (newSelected.has(ingredientId)) {
      newSelected.delete(ingredientId);
    } else {
      newSelected.add(ingredientId);
    }
    setSelectedIngredients(newSelected);
  };
  
  const selectAll = () => {
    const allIds = new Set(ingredients.map(ingredient => ingredient.id));
    setSelectedIngredients(allIds);
  };
  
  const deselectAll = () => {
    setSelectedIngredients(new Set());
  };
  
  const isAllSelected = ingredients.length > 0 && selectedIngredients.size === ingredients.length;
  
  // Funkcje do skalowania porcji
  const handleDecrease = () => {
    if (currentServings > 1) {
      const newServings = currentServings - 1;
      setCurrentServings(newServings);
      
      const newScaleFactor = calculateScaleFactor(originalServings, newServings);
      setScaleFactor(newScaleFactor);
    }
  };

  const handleIncrease = () => {
    const newServings = currentServings + 1;
    setCurrentServings(newServings);
    
    const newScaleFactor = calculateScaleFactor(originalServings, newServings);
    setScaleFactor(newScaleFactor);
  };
  
  const renderIngredientItem = ({ item }: { item: Ingredient }) => {
    const isSelected = selectedIngredients.has(item.id);
    
    // Sprawdzamy, czy składnik powinien być skalowany
    const scalable = isIngredientScalable(item.amount);
    
    // Obliczamy przeskalowaną ilość
    const scaledAmount = scalable 
      ? scaleValue(item.amount, scaleFactor)
      : item.amount;
    
    // Formatujemy wartość do wyświetlenia
    const displayAmount = formatScaledValue(scaledAmount);
    
    return (
      <TouchableOpacity
        style={[styles.ingredientItem, isSelected && styles.ingredientItemSelected]}
        onPress={() => toggleIngredient(item.id)}
      >
        <View style={styles.checkboxContainer}>
          {isSelected ? (
            <MaterialIcons name="check-box" size={24} color="#2196F3" />
          ) : (
            <MaterialIcons name="check-box-outline-blank" size={24} color="#999" />
          )}
        </View>
        
        <View style={styles.ingredientContent}>
          <Text style={styles.ingredientText}>
            {scaledAmount !== null && displayAmount !== '' && (
              <Text style={styles.amount}>{displayAmount} </Text>
            )}
            {item.unit && (
              <Text style={styles.unit}>{item.unit} </Text>
            )}
            <Text>{item.name || item.originalStr}</Text>
          </Text>
        </View>
      </TouchableOpacity>
    );
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Dodaj do listy zakupów</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <AntDesign name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          {/* Kontrolki skalowania porcji */}
          <View style={styles.servingsContainer}>
            <View style={styles.servingsLabel}>
              <MaterialIcons name="people" size={20} color="#666" />
              <Text style={styles.servingsLabelText}>Porcje:</Text>
            </View>
            
            <View style={styles.servingsControls}>
              <TouchableOpacity
                style={[styles.servingsButton, currentServings <= 1 && styles.servingsButtonDisabled]}
                onPress={handleDecrease}
                disabled={currentServings <= 1}
              >
                <AntDesign 
                  name="minus" 
                  size={16} 
                  color={currentServings <= 1 ? '#ccc' : '#2196F3'} 
                />
              </TouchableOpacity>
              
              <Text style={styles.servingsValue}>{currentServings}</Text>
              
              <TouchableOpacity
                style={styles.servingsButton}
                onPress={handleIncrease}
              >
                <AntDesign name="plus" size={16} color="#2196F3" />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.selectionControls}>
            <TouchableOpacity 
              style={styles.selectionButton}
              onPress={isAllSelected ? deselectAll : selectAll}
            >
              <Text style={styles.selectionButtonText}>
                {isAllSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.selectionButton, styles.clearButton]}
              disabled={true}
            >
              <Text style={[styles.selectionButtonText, styles.disabledText]}>
                Wyczyść listę
              </Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={ingredients}
            renderItem={renderIngredientItem}
            keyExtractor={(item) => item.id}
            style={styles.ingredientsList}
            contentContainerStyle={styles.ingredientsListContent}
          />
          
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.addButton, styles.disabledButton]}
              disabled={true}
            >
              <AntDesign name="shoppingcart" size={20} color="#fff" />
              <Text style={styles.addButtonText}>
                Dodaj do listy zakupów
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
    maxHeight: '80%',
    minHeight: '50%',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  // Style dla kontrolek skalowania porcji
  servingsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  servingsLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  servingsLabelText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  servingsControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  servingsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  servingsButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  servingsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 12,
    minWidth: 24,
    textAlign: 'center',
  },
  selectionControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  selectionButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  clearButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#999',
  },
  ingredientsList: {
    flex: 1,
  },
  ingredientsListContent: {
    padding: 8,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  ingredientItemSelected: {
    backgroundColor: '#f5f5f5',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  ingredientContent: {
    flex: 1,
  },
  ingredientText: {
    fontSize: 16,
    color: '#333',
  },
  amount: {
    fontWeight: '500',
  },
  unit: {
    color: '#666',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  addButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 