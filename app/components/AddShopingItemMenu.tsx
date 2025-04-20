// src/components/AddShopingItemMenu.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, FlatList,
  Alert, Dimensions
} from 'react-native';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import type Ingredient from '../../database/models/Ingredient'; // Typ z nowego modelu
import ShoppingItem from '../../database/models/ShoppingItem'; // Nowy model ShoppingItem
import database from '../../database'; // Główna instancja bazy WDB
import { useServings } from '../(screens)/RecipeDetailScreen/ServingsContext'; // Zakładając, że ścieżka jest poprawna
import { isIngredientScalable, scaleValue, formatScaledValue, calculateScaleFactor } from '../utils/scaling'; // Zakładając, że ścieżka jest poprawna
import Toast, { showToast } from '../components/Toast'; // Zakładając, że ścieżka jest poprawna
import AuthService from '../../app/services/auth/authService'; // Zakładając, że ścieżka jest poprawna

interface AddShopingItemMenuProps {
  visible: boolean;
  onClose: () => void;
  ingredients: Ingredient[]; // Przyjmujemy nowe modele Ingredient
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
  const [activeUserId, setActiveUserId] = useState<string | null>(null); // Potrzebujemy ID użytkownika

  // Pobierz ID aktywnego użytkownika przy montowaniu komponentu
  useEffect(() => {
    AuthService.getActiveUser() // Zmieniono z getActiveUserId
      .then((userId: string | null) => setActiveUserId(userId))
      .catch((err: Error) => console.error("Nie udało się pobrać ID użytkownika:", err));
  }, []);

  // Zaznacz wszystkie składniki domyślnie, gdy składniki się załadują i mamy ID użytkownika
  useEffect(() => {
    if (ingredients.length > 0 && activeUserId) {
      selectAll();
    }
    // Jeśli nie ma składników, wyczyść zaznaczenie
    if (ingredients.length === 0) {
        setSelectedIngredients(new Set());
    }
  }, [ingredients, activeUserId]); // Reaguj też na zmianę activeUserId

  // --- Logika zaznaczania (bez zmian) ---
  const toggleIngredient = useCallback((ingredientId: string) => {
    setSelectedIngredients(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(ingredientId)) {
        newSelected.delete(ingredientId);
      } else {
        newSelected.add(ingredientId);
      }
      return newSelected;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = new Set(ingredients.map(ingredient => ingredient.id));
    setSelectedIngredients(allIds);
  }, [ingredients]);

  const deselectAll = useCallback(() => {
    setSelectedIngredients(new Set());
  }, []);

  const isAllSelected = ingredients.length > 0 && selectedIngredients.size === ingredients.length;

  // --- Logika Czyszczenia Listy (NOWA IMPLEMENTACJA) ---
  const clearShoppingList = useCallback(async () => {
    if (!activeUserId) {
      Alert.alert("Błąd", "Nie można zidentyfikować użytkownika.");
      return;
    }
    Alert.alert(
      "Wyczyść listę zakupów",
      "Czy na pewno chcesz usunąć wszystkie produkty z listy zakupów?",
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Wyczyść",
          style: "destructive",
          onPress: async () => {
            setIsClearingList(true);
            try {
              const shoppingItemsCollection = database.get<ShoppingItem>(ShoppingItem.table);
              // Pobierz wszystkie NIEUSUNIĘTE elementy dla użytkownika
              const allItems = await shoppingItemsCollection
                .query(Q.where('user_id', activeUserId)) // Nie trzeba Q.where('is_deleted', false)
                .fetch();

              if (allItems.length > 0) {
                // Użyj batch action do optymalnego oznaczenia jako usunięte
                await database.write(async () => {
                  // Przygotuj operacje 'markAsDeleted' dla wszystkich znalezionych elementów
                  const itemsToDelete = allItems.map(item => item.prepareMarkAsDeleted());
                  await database.batch(...itemsToDelete);
                });
                console.log(`[AddShopingItemMenu] Oznaczono ${allItems.length} elementów jako usunięte.`);
                 showToast({ type: 'success', text1: 'Gotowe!', text2: 'Lista zakupów została wyczyszczona' });
              } else {
                 showToast({ type: 'info', text1: 'Informacja', text2: 'Lista zakupów jest już pusta.' });
              }

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
  }, [activeUserId]); // Zależność od activeUserId

  // --- Funkcje skalowania (bez zmian) ---
  const handleDecrease = useCallback(() => {
    if (currentServings > 1) {
      const newServings = currentServings - 1;
      setCurrentServings(newServings);
      const newScaleFactor = calculateScaleFactor(originalServings, newServings);
      setScaleFactor(newScaleFactor);
    }
  }, [currentServings, setCurrentServings, originalServings, setScaleFactor]);

  const handleIncrease = useCallback(() => {
    const newServings = currentServings + 1;
    setCurrentServings(newServings);
    const newScaleFactor = calculateScaleFactor(originalServings, newServings);
    setScaleFactor(newScaleFactor);
  }, [currentServings, setCurrentServings, originalServings, setScaleFactor]);


  // --- Logika Dodawania do Listy (NOWA IMPLEMENTACJA) ---
  const addToShoppingList = useCallback(async () => {
    if (!activeUserId) {
        Alert.alert("Błąd", "Nie można zidentyfikować użytkownika.");
        return;
    }
    if (selectedIngredients.size === 0) {
      Alert.alert('Wybierz składniki', 'Wybierz co najmniej jeden składnik.');
      return;
    }

    setIsAddingToList(true);

    // Przygotuj dane wybranych i przeskalowanych składników
    const itemsToAddOrUpdate: Array<{ name: string; amount: number | null; unit: string | null; type: string | null }> = [];
    for (const ingredient of ingredients) {
        if (selectedIngredients.has(ingredient.id)) {
            const scalable = isIngredientScalable(ingredient.amount ?? null);
            const scaledAmount = scalable ? scaleValue(ingredient.amount ?? null, scaleFactor) : ingredient.amount;
            itemsToAddOrUpdate.push({
                name: ingredient.name.toLowerCase(), // Normalizuj nazwę od razu
                amount: scaledAmount ?? null,
                unit: ingredient.unit ?? null,
                type: ingredient.type ?? null,
            });
        }
    }

    if (itemsToAddOrUpdate.length === 0) {
        setIsAddingToList(false);
        return; // Nic do dodania
    }

    console.log(`[AddShopingItemMenu] Przygotowano ${itemsToAddOrUpdate.length} elementów do dodania/aktualizacji.`);

    try {
      // Użyj transakcji dla wszystkich operacji
      await database.write(async () => {
          let createdCount = 0;
          let updatedCount = 0;

          for (const itemData of itemsToAddOrUpdate) {
              // Użyj metody statycznej modelu do znalezienia istniejącego elementu
              const existingItem = await ShoppingItem.findExisting(
                  database,
                  activeUserId,
                  itemData.name, // Nazwa już jest znormalizowana
                  itemData.unit,
                  false // Szukaj nieodznaczonego
              );

              if (existingItem) {
                  // Aktualizuj ilość istniejącego elementu
                  await existingItem.update(record => {
                      // Dodaj nową ilość do istniejącej, obsługując null
                      record.amount = (record.amount ?? 0) + (itemData.amount ?? 0);
                      // Upewnij się, że ilość nie jest ujemna (choć nie powinno się zdarzyć)
                      if (record.amount < 0) record.amount = 0;
                  });
                  updatedCount++;
              } else {
                  // Utwórz nowy element listy zakupów używając metody statycznej modelu
                  await ShoppingItem.createItem(database, {
                      userId: activeUserId,
                      name: itemData.name,
                      amount: itemData.amount ?? 1.0, // Domyślnie 1, jeśli ilość to null
                      unit: itemData.unit,
                      type: itemData.type, // Przekaż typ ze składnika
                      isChecked: false,
                      // order zostanie nadany automatycznie
                  });
                  createdCount++;
              }
          }
           console.log(`[AddShopingItemMenu] Utworzono: ${createdCount}, Zaktualizowano: ${updatedCount}`);
      }); // Koniec database.write()

      showToast({ type: 'success', text1: 'Dodano!', text2: 'Wybrane składniki dodane do listy.' });
      onClose(); // Zamknij modal po sukcesie

    } catch (error) {
      console.error('Błąd podczas dodawania do listy zakupów:', error);
      Alert.alert('Błąd', 'Nie udało się dodać produktów do listy zakupów.');
    } finally {
      setIsAddingToList(false);
    }
  }, [activeUserId, ingredients, selectedIngredients, scaleFactor, onClose, database]); // Dodano database do zależności


  // --- Renderowanie Elementu Listy (bez zmian w logice) ---
  const renderIngredientItem = useCallback(({ item }: { item: Ingredient }) => {
    // Sprawdzenie poprawności obiektu item
    if (!item || typeof item.id !== 'string') {
      console.warn("Próba renderowania nieprawidłowego elementu Ingredient:", item);
      return null; // Nie renderuj niczego dla nieprawidłowych danych
    }

    const isSelected = selectedIngredients.has(item.id);
    const scalable = isIngredientScalable(item.amount ?? null);
    const scaledAmount = scalable ? scaleValue(item.amount ?? null, scaleFactor) : item.amount;
    const displayAmount = formatScaledValue(scaledAmount ?? null);

    return (
      <TouchableOpacity
        style={[styles.ingredientItem, isSelected && styles.ingredientItemSelected]}
        onPress={() => toggleIngredient(item.id)}
        key={item.id} // Dodaj klucz dla bezpieczeństwa
      >
        <View style={styles.checkboxContainer}>
          {isSelected ? (
            <MaterialIcons name="check-box" size={24} color="#5c7ba9" />
          ) : (
            <MaterialIcons name="check-box-outline-blank" size={24} color="#999" />
          )}
        </View>
        <View style={styles.ingredientContent}>
          <Text style={styles.ingredientText} numberOfLines={2}>
            {displayAmount && (
              <Text style={styles.amount}>{displayAmount}{' '}</Text>
            )}
            {item.unit && (
              <Text style={styles.unit}>{item.unit}{' '}</Text>
            )}
            {/* Używaj item.name, które powinno być stringiem */}
            <Text>{item.name || 'Brak nazwy'}</Text>
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [selectedIngredients, scaleFactor, toggleIngredient]); // Zależności dla renderItem


  // --- Struktura Komponentu (bez zmian w JSX poza wywołaniami funkcji) ---
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
         {/* Dodaj pusty widok na górze, aby modal nie zajmował całego ekranu od razu */}
         <TouchableOpacity style={styles.modalOverlayTouchable} onPress={onClose} activeOpacity={1}/>
         <View style={styles.menuContentContainer}> {/* Nowy kontener na zawartość */}
           <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Dodaj do listy zakupów</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <AntDesign name="close" size={24} color="#666" />
            </TouchableOpacity>
           </View>
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
                  <AntDesign name="minus" size={16} color={currentServings <= 1 ? '#ccc' : '#5c7ba9'} />
                </TouchableOpacity>
                <Text style={styles.servingsValue}>{currentServings}</Text>
                <TouchableOpacity style={styles.servingsButton} onPress={handleIncrease}>
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
               onPress={clearShoppingList} // Używa nowej funkcji
               disabled={isClearingList}
             >
               <Text style={[styles.selectionButtonText, styles.clearButtonText]}>
                 {isClearingList ? "Czyszczenie..." : "Wyczyść listę"}
               </Text>
             </TouchableOpacity>
           </View>

           <FlatList
             data={ingredients}
             renderItem={renderIngredientItem}
             keyExtractor={(item, index) => item?.id ?? `ingredient-${index}`} // Lepszy key extractor
             style={styles.ingredientsList}
             contentContainerStyle={styles.ingredientsListContent}
           />

           <View style={styles.footer}>
             <TouchableOpacity
               style={[styles.addButton, selectedIngredients.size === 0 && styles.disabledButton, isAddingToList && styles.loadingButton]}
               disabled={selectedIngredients.size === 0 || isAddingToList || !activeUserId} // Dodano !activeUserId
               onPress={addToShoppingList} // Używa nowej funkcji
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

// Style (Dodaj styl dla overlay i zmień wysokość menu)
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    // Usunięto justify-content: 'flex-end' aby overlay działał
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalOverlayTouchable: {
      flex: 1, // Zajmuje dostępną przestrzeń nad menu
  },
  menuContentContainer: { // Nowy styl dla zawartości menu
    // height: screenHeight * 0.8, // Ustaw wysokość np. na 80% ekranu
    maxHeight: screenHeight * 0.9, // Ogranicz maksymalną wysokość
    backgroundColor: 'white',
    borderTopLeftRadius: 16, // Zaokrąglenie rogów
    borderTopRightRadius: 16,
    overflow: 'hidden', // Ukryj zawartość wychodzącą poza zaokrąglenie
  },
  // Pozostałe style bez zmian
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuTitle: {
    fontSize: 18, // Zmniejszono trochę
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  servingsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12, // Zmniejszono padding
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  servingsLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  servingsLabelText: {
    fontSize: 15, // Zmniejszono
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  servingsControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  servingsButton: {
    width: 30, // Zmniejszono
    height: 30, // Zmniejszono
    borderRadius: 15, // Zmniejszono
    backgroundColor: '#eef2ff', // Jaśniejszy kolor
    justifyContent: 'center',
    alignItems: 'center',
  },
  servingsButtonDisabled: {
    backgroundColor: '#f0f0f0', // Bardziej szary dla nieaktywnego
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
    paddingVertical: 8, // Mniejszy padding
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectionButton: {
    paddingVertical: 8,
    paddingHorizontal: 4, // Mniejszy padding
  },
  selectionButtonText: {
    color: '#5c7ba9',
    fontSize: 13, // Zmniejszono
    fontWeight: '500',
  },
  ingredientsList: {
    flex: 1, // Pozwól liście się rozciągnąć
  },
  ingredientsListContent: {
    paddingBottom: 8, // Dodaj trochę paddingu na dole listy
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, // Zmniejszono
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9', // Jaśniejszy separator
  },
  ingredientItemSelected: {
    backgroundColor: '#eef2ff', // Jaśniejsze zaznaczenie
  },
  checkboxContainer: {
    marginRight: 12,
  },
  ingredientContent: {
    flex: 1,
  },
  ingredientText: {
    fontSize: 15, // Zmniejszono
    color: '#444', // Ciemniejszy szary
    lineHeight: 20,
  },
  amount: {
    fontWeight: '500',
  },
  unit: {
    color: '#777', // Jaśniejszy szary
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: 'white', // Tło dla pewności
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
    backgroundColor: '#cccccc',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingButton: {
    backgroundColor: '#8ca9d3', // Inny kolor podczas ładowania
  },
  clearButtonText: {
    color: '#e53e3e', // Czerwony dla czyszczenia
    fontSize: 13,
  },
});