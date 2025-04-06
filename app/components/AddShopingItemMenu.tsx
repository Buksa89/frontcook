import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList,
  Alert,
  StatusBar,
  SafeAreaView,
  Dimensions
} from 'react-native';
import { AntDesign, MaterialIcons, Feather } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import Ingredient from '../../database/models/Ingredient';
import ShoppingItem from '../../database/models/ShoppingItem';
import database from '../../database';
import { useServings } from '../(screens)/RecipeDetailScreen/ServingsContext';
import { isIngredientScalable, scaleValue, formatScaledValue, calculateScaleFactor } from '../utils/scaling';
import Toast, { showToast } from '../components/Toast';

interface AddShopingItemMenuProps {
  visible: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  recipeName: string;
}

const { height: screenHeight } = Dimensions.get('window');

export const AddShopingItemMenu: React.FC<AddShopingItemMenuProps> = ({
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
  const [isAddingToList, setIsAddingToList] = useState(false);
  const [isClearingList, setIsClearingList] = useState(false);

  // Zaznacz wszystkie składniki domyślnie
  useEffect(() => {
    if (ingredients.length > 0) {
      selectAll();
    }
  }, [ingredients]);
  
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
  
  // Funkcja czyszcząca całą listę zakupów
  const clearShoppingList = async () => {
    Alert.alert(
      "Wyczyść listę zakupów",
      "Czy na pewno chcesz usunąć wszystkie produkty z listy zakupów?",
      [
        {
          text: "Anuluj",
          style: "cancel"
        },
        {
          text: "Wyczyść",
          style: "destructive",
          onPress: async () => {
            setIsClearingList(true);
            try {
              const allItems = await database
                .get('shopping_items')
                .query(
                  Q.where('is_deleted', false)
                )
                .fetch();
              
              // Usuwamy wszystkie elementy jeden po drugim
              for (const item of allItems) {
                await item.markAsDeleted();
              }
              
              // Pokaż toast informujący o wyczyszczeniu listy
              showToast({
                type: 'success',
                text1: 'Gotowe!',
                text2: 'Lista zakupów została wyczyszczona',
                visibilityTime: 2000,
                position: 'bottom'
              });
            } catch (error) {
              console.error('Błąd podczas czyszczenia listy zakupów:', error);
              Alert.alert("Błąd", "Nie udało się wyczyścić listy zakupów.");
            } finally {
              setIsClearingList(false);
            }
          }
        }
      ]
    );
  };

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

  // Funkcja dodająca wybrane składniki do listy zakupów
  const addToShoppingList = async () => {
    if (selectedIngredients.size === 0) {
      Alert.alert('Wybierz składniki', 'Wybierz co najmniej jeden składnik, aby dodać do listy zakupów.');
      return;
    }

    setIsAddingToList(true);

    try {
      // Filtrujemy wybrane składniki
      const selectedItems = ingredients.filter(item => selectedIngredients.has(item.id));

      // Dodajemy każdy wybrany składnik do listy zakupów
      for (let ingredient of selectedItems) {
        // Sprawdzamy, czy składnik powinien być skalowany
        const scalable = isIngredientScalable(ingredient.amount);
        
        // Obliczamy przeskalowaną ilość
        const scaledAmount = scalable 
          ? scaleValue(ingredient.amount, scaleFactor)
          : ingredient.amount;

        // Formatujemy tekst w formacie "ilość jednostka nazwa"
        const itemText = `${formatScaledValue(scaledAmount)} ${ingredient.unit || ''} ${ingredient.name}`.trim();
        
        await ShoppingItem.upsertByShoppingList(database, itemText);
      }

      // Zamykamy modal bez wyświetlania powiadomienia
      onClose();
    } catch (error) {
      console.error('Błąd podczas dodawania do listy zakupów:', error);
      Alert.alert('Błąd', 'Nie udało się dodać produktów do listy zakupów.');
    } finally {
      setIsAddingToList(false);
    }
  };
  
  const renderIngredientItem = ({ item }: { item: Ingredient }) => {
    // Skip rendering if item is invalid
    if (!item || typeof item !== 'object') {
      return null;
    }
    
    const safeItem = {
      id: item?.id || '',
      name: item?.name || '',
      amount: item?.amount || null,
      unit: item?.unit || null
    };
    
    const isSelected = selectedIngredients.has(safeItem.id);
    
    // Sprawdzamy, czy składnik powinien być skalowany
    const scalable = isIngredientScalable(safeItem.amount);
    
    // Obliczamy przeskalowaną ilość
    const scaledAmount = scalable 
      ? scaleValue(safeItem.amount, scaleFactor)
      : safeItem.amount;
    
    // Formatujemy wartość do wyświetlenia
    const displayAmount = formatScaledValue(scaledAmount || null);
    
    return (
      <TouchableOpacity
        style={[styles.ingredientItem, isSelected && styles.ingredientItemSelected]}
        onPress={() => toggleIngredient(safeItem.id)}
      >
        <View style={styles.checkboxContainer}>
          {isSelected ? (
            <MaterialIcons name="check-box" size={24} color="#5c7ba9" />
          ) : (
            <MaterialIcons name="check-box-outline-blank" size={24} color="#999" />
          )}
        </View>
        
        <View style={styles.ingredientContent}>
          <Text style={styles.ingredientText}>
            {scaledAmount !== null && displayAmount !== '' && (
              <Text style={styles.amount}>{displayAmount}{' '}</Text>
            )}
            {safeItem.unit && (
              <Text style={styles.unit}>{safeItem.unit}{' '}</Text>
            )}
            <Text>{safeItem.name}</Text>
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
      <View style={styles.modalContainer}>
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
                  color={currentServings <= 1 ? '#ccc' : '#5c7ba9'} 
                />
              </TouchableOpacity>
              
              <Text style={styles.servingsValue}>{currentServings}</Text>
              
              <TouchableOpacity
                style={styles.servingsButton}
                onPress={handleIncrease}
              >
                <AntDesign name="plus" size={16} color="#5c7ba9" />
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
              style={styles.selectionButton}
              onPress={clearShoppingList}
              disabled={isClearingList}
            >
              <Text style={[styles.selectionButtonText, styles.clearButtonText]}>
                {isClearingList ? "Czyszczenie..." : "Wyczyść listę zakupów"}
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
              style={[
                styles.addButton, 
                selectedIngredients.size === 0 && styles.disabledButton, 
                isAddingToList && styles.loadingButton
              ]}
              disabled={selectedIngredients.size === 0 || isAddingToList}
              onPress={addToShoppingList}
            >
              <AntDesign name="shoppingcart" size={20} color="#fff" />
              <Text style={styles.addButtonText}>
                {isAddingToList ? 'Dodawanie...' : 'Dodaj do listy zakupów'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <Toast />
    </Modal>
  );
};

export default AddShopingItemMenu;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    height: screenHeight,
    backgroundColor: 'white',
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
    color: '#5c7ba9',
    fontSize: 14,
    fontWeight: '500',
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
    backgroundColor: '#5c7ba9',
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
  loadingButton: {
    backgroundColor: '#65a3db',
  },
  clearButtonText: {
    color: '#ff4444',
  },
}); 