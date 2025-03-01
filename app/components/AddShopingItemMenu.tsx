import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Pressable,
  FlatList,
  Alert
} from 'react-native';
import { AntDesign, MaterialIcons, Feather } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import Ingredient from '../../database/models/Ingredient';
import ShoppingItem from '../../database/models/ShoppingItem';
import database from '../../database';
import { useServings } from '../(screens)/RecipeDetailScreen/ServingsContext';
import { isIngredientScalable, scaleValue, formatScaledValue, calculateScaleFactor } from '../utils/scaling';

interface AddShopingItemMenuProps {
  visible: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  recipeName: string;
}

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
                .query()
                .fetch();
              
              await database.write(async () => {
                await Promise.all(allItems.map(item => item.destroyPermanently()));
              });
              
              Alert.alert(
                "Lista wyczyszczona",
                "Wszystkie produkty zostały usunięte z listy zakupów.",
                [{ text: "OK" }]
              );
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
      // Pobieramy aktualną listę niezaznaczonych elementów, aby ustalić nowy order
      const uncheckedItems = await database
        .get('shopping_items')
        .query(
          Q.where('is_checked', false)
        )
        .fetch();

      // Ustalamy maksymalny order
      let maxOrder = -1;
      uncheckedItems.forEach(item => {
        const itemOrder = (item as ShoppingItem).order;
        if (itemOrder > maxOrder) {
          maxOrder = itemOrder;
        }
      });

      // Filtrujemy wybrane składniki
      const selectedItems = ingredients.filter(item => selectedIngredients.has(item.id));

      // Dodajemy każdy wybrany składnik do listy zakupów
      for (let [index, ingredient] of selectedItems.entries()) {
        // Sprawdzamy, czy składnik powinien być skalowany
        const scalable = isIngredientScalable(ingredient.amount);
        
        // Obliczamy przeskalowaną ilość
        const scaledAmount = scalable 
          ? scaleValue(ingredient.amount, scaleFactor)
          : ingredient.amount;

        await ShoppingItem.createOrUpdate(database, {
          name: ingredient.name || ingredient.originalStr,
          amount: scaledAmount,
          unit: ingredient.unit,
          type: ingredient.type,
          order: maxOrder + index + 1,
          isChecked: false
        });
      }

      // Informujemy użytkownika o sukcesie
      Alert.alert(
        'Dodano do listy',
        `Dodano ${selectedItems.length} ${selectedItems.length === 1 ? 'produkt' : 'produkty'} do listy zakupów.`,
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      console.error('Błąd podczas dodawania do listy zakupów:', error);
      Alert.alert('Błąd', 'Nie udało się dodać produktów do listy zakupów.');
    } finally {
      setIsAddingToList(false);
    }
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
    </Modal>
  );
};

export default AddShopingItemMenu;

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
  loadingButton: {
    backgroundColor: '#65a3db',
  },
  clearButtonText: {
    color: '#ff4444',
  },
}); 