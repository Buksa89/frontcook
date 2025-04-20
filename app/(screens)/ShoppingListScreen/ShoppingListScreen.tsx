// src/screens/ShoppingListScreen.tsx (lub inna odpowiednia ścieżka)

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Modal, Alert
} from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { MaterialIcons, AntDesign, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import database from '../../../database'; // Import instancji bazy
import ShoppingItem from '../../../database/models/ShoppingItem'; // Import NOWEGO modelu
import AuthService from '../../../app/services/auth/authService'; // Poprawiona ścieżka importu

// --- Interfejs dla komponentu bazowego ---
interface ShoppingListScreenProps {
  uncheckedItems: ShoppingItem[];
  checkedItems: ShoppingItem[];
}

// --- Komponent Bazowy (bez zmian w deklaracji propsów) ---
const ShoppingListScreenComponent: React.FC<ShoppingListScreenProps> = ({
  uncheckedItems,
  checkedItems
}) => {
  const [newItemText, setNewItemText] = useState('');
  const [isCheckedListVisible, setIsCheckedListVisible] = useState(true);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [editText, setEditText] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShoppingItem | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null); // Potrzebujemy ID użytkownika
  const navigation = useNavigation();

  // Pobierz ID aktywnego użytkownika
  useEffect(() => {
    AuthService.getActiveUser()
      .then((userId: string | null) => setActiveUserId(userId))
      .catch((err: Error) => console.error("Nie można pobrać ID użytkownika:", err));
  }, []);

  // --- Logika Czyszczenia Listy (NOWA IMPLEMENTACJA) ---
  const clearAllItems = useCallback(async () => {
    if (!activeUserId) return; // Sprawdzenie ID użytkownika
    // Połącz obie listy przed sprawdzeniem długości
    const allItems = [...uncheckedItems, ...checkedItems];
    if (allItems.length === 0) {
        console.log("[ShoppingList] Lista jest już pusta, pomijam czyszczenie.");
        return; // Nic do zrobienia
    }

    try {
      console.log(`[ShoppingList] Oznaczanie ${allItems.length} elementów jako usunięte...`);
      // Użyj batch action do optymalnego oznaczenia jako usunięte
      await database.write(async () => {
        const itemsToDelete = allItems.map(item => item.prepareMarkAsDeleted());
        await database.batch(...itemsToDelete);
      });
      console.log("[ShoppingList] Pomyślnie oznaczono wszystkie elementy jako usunięte.");
    } catch (error) {
      console.error("Błąd usuwania wszystkich produktów:", error);
      Alert.alert("Błąd", "Nie udało się usunąć wszystkich produktów");
    }
  }, [activeUserId, uncheckedItems, checkedItems]); // Zależności

  // --- Potwierdzenie Czyszczenia (bez zmian w logice alertu) ---
  const confirmClearAll = useCallback(() => {
    if (uncheckedItems.length === 0 && checkedItems.length === 0) return;
    Alert.alert(
      "Wyczyść listę",
      "Czy na pewno chcesz usunąć wszystkie produkty z listy zakupów?",
      [
        { text: "Anuluj", style: "cancel" },
        { text: "Wyczyść", onPress: clearAllItems, style: "destructive" } // Wywołuje nową funkcję clearAllItems
      ]
    );
  }, [uncheckedItems.length, checkedItems.length, clearAllItems]); // Dodano clearAllItems do zależności

  // --- Przycisk w Nagłówku (bez zmian w logice wyświetlania) ---
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.headerButton} onPress={confirmClearAll}>
          <MaterialIcons name="delete-sweep" size={24} color="#e53e3e" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, confirmClearAll]); // Zależność od confirmClearAll

  // --- Przełączanie Stanu Odznaczenia (NOWA IMPLEMENTACJA) ---
  const toggleItemCheck = useCallback(async (item: ShoppingItem) => {
    try {
      // Użyj metody instancji z nowego modelu
      await item.toggleChecked();
    } catch (error) {
      console.error("Błąd zmiany stanu produktu:", error);
      Alert.alert("Błąd", "Nie udało się zmienić statusu produktu.");
    }
  }, []); // Brak zależności zewnętrznych poza 'item'

  // --- Usuwanie Elementu (NOWA IMPLEMENTACJA) ---
  const deleteItem = useCallback(async (item: ShoppingItem) => {
    try {
      // Użyj metody instancji z nowego modelu
      await item.deleteItem(); // Używa metody @writer deleteItem()
      setMenuVisible(false); // Zamknij menu po usunięciu
    } catch (error) {
      console.error("Błąd usuwania produktu:", error);
      Alert.alert("Błąd", "Nie udało się usunąć produktu.");
    }
  }, []); // Brak zależności

  // --- Rozpoczęcie Edycji (bez zmian logiki UI) ---
  const startEdit = useCallback((item: ShoppingItem) => {
    setEditingItem(item);
    // Ustaw tekst edycji na podstawie aktualnych danych, obsłuż null
    const amountStr = item.amount !== null ? String(item.amount) : '';
    const unitStr = item.unit ?? '';
    setEditText(`${amountStr} ${unitStr} ${item.name}`.trim().replace(/\s+/g, ' ')); // Usuń podwójne spacje
    setMenuVisible(false); // Zamknij menu kontekstowe
  }, []);

  // --- Zapis Edycji (NOWA IMPLEMENTACJA) ---
  const saveEdit = useCallback(async () => {
    if (!editingItem || !editText.trim()) return;

    try {
      // Użyj metody instancji z nowego modelu
      await editingItem.updateFromText(editText);
      setEditingItem(null); // Zamknij modal edycji
      setEditText(''); // Wyczyść pole edycji
    } catch (error) {
      console.error("Błąd podczas zapisywania edycji produktu:", error);
      Alert.alert("Błąd", "Nie udało się zapisać zmian.");
    }
  }, [editingItem, editText]); // Zależności

  // --- Pokazanie Menu Kontekstowego (bez zmian) ---
  const showItemMenu = useCallback((item: ShoppingItem) => {
    setSelectedItem(item);
    setMenuVisible(true);
  }, []);

  // --- Dodawanie Nowego Elementu (NOWA IMPLEMENTACJA) ---
  const addNewItem = useCallback(async () => {
    if (!activeUserId || !newItemText.trim()) return;

    try {
      // Użyj metody statycznej z nowego modelu
      await ShoppingItem.addItemFromText(database, activeUserId, newItemText);
      setNewItemText(''); // Wyczyść pole input po dodaniu
    } catch (error) {
      console.error("Błąd dodawania nowego produktu:", error);
      Alert.alert("Błąd", "Nie udało się dodać produktu.");
    }
  }, [activeUserId, newItemText]); // Zależności

  // --- Czyszczenie Odznaczonych (NOWA IMPLEMENTACJA) ---
  const clearCheckedItems = useCallback(async () => {
    if (!activeUserId || checkedItems.length === 0) return;

    try {
        console.log(`[ShoppingList] Oznaczanie ${checkedItems.length} odznaczonych elementów jako usunięte...`);
        await database.write(async () => {
          const itemsToDelete = checkedItems.map(item => item.prepareMarkAsDeleted());
          await database.batch(...itemsToDelete);
        });
        console.log("[ShoppingList] Pomyślnie oznaczono odznaczone elementy jako usunięte.");
    } catch (error) {
      console.error("Błąd usuwania zaznaczonych produktów:", error);
      Alert.alert("Błąd", "Nie udało się usunąć kupionych produktów.");
    }
  }, [activeUserId, checkedItems]); // Zależności

  // --- Renderowanie Elementu Listy (niewielkie poprawki formatowania) ---
  const renderItem = useCallback(({ item }: { item: ShoppingItem }) => {
      // Poprawka formatowania ilości - użyj funkcji, jeśli istnieje lub proste sprawdzenie
      const displayAmount = item.amount !== null && item.amount !== 1 ? `${item.amount}` : '';
      // Można by użyć formatScaledValue, jeśli chcesz bardziej złożonego formatowania

      return (
          <TouchableOpacity
            style={[
              styles.itemContainer,
              item.isChecked && styles.itemContainerChecked
            ]}
            onPress={() => toggleItemCheck(item)}
            onLongPress={() => showItemMenu(item)}
          >
            <View style={styles.checkboxContainer}>
              <MaterialIcons
                name={item.isChecked ? "check-box" : "check-box-outline-blank"}
                size={22} // Trochę większe ikony
                color={item.isChecked ? "#5c7ba9" : "#999"}
              />
            </View>
            <View style={styles.itemContent}>
              <Text style={[
                styles.itemText,
                item.isChecked && styles.itemTextChecked
              ]} numberOfLines={2}>
                {/* Wyświetlaj ilość tylko jeśli jest różna od 1 lub null */}
                {displayAmount && (
                  <Text style={styles.amount}>{displayAmount}{' '}</Text>
                )}
                {item.unit && (
                  <Text style={styles.unit}>{item.unit}{' '}</Text>
                )}
                <Text>{item.name}</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => showItemMenu(item)}
            >
              <Feather name="more-vertical" size={20} color="#666" />
            </TouchableOpacity>
          </TouchableOpacity>
      );
  }, [toggleItemCheck, showItemMenu]); // Zależności dla renderItem

  // --- Struktura JSX Komponentu (bez zmian w strukturze, tylko wywołania funkcji) ---
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // Dostosuj offset, jeśli nagłówek ma inną wysokość
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
       {/* Empty State (bez zmian) */}
      {(uncheckedItems.length === 0 && checkedItems.length === 0) && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Lista zakupów jest pusta</Text>
          <Text style={styles.emptySubText}>Dodaj produkty ręcznie lub z przepisu</Text>
        </View>
      )}

      {/* Główna lista (niezaznaczone) */}
      <FlatList
        data={uncheckedItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        // Komponent stopki z zaznaczonymi elementami
        ListFooterComponent={() => checkedItems.length > 0 ? (
          <View style={styles.checkedSection}>
            <TouchableOpacity
              style={styles.checkedHeader}
              onPress={() => setIsCheckedListVisible(!isCheckedListVisible)}
            >
              <View style={styles.checkedHeaderLeft}>
                <MaterialIcons
                  name={isCheckedListVisible ? "expand-less" : "expand-more"}
                  size={22}
                  color="#666"
                />
                <Text style={styles.checkedHeaderText}>
                  Kupione ({checkedItems.length})
                </Text>
              </View>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearCheckedItems} // Używa nowej funkcji
              >
                <MaterialIcons name="delete-outline" size={20} color="#666" />
                <Text style={styles.clearButtonText}>Wyczyść</Text>
              </TouchableOpacity>
            </TouchableOpacity>
            {/* Warunkowe wyświetlanie zaznaczonej listy */}
            {isCheckedListVisible && (
              <View style={styles.checkedList}>
                {/* Używamy map zamiast FlatList dla krótkiej listy zaznaczonych */}
                {checkedItems.map(item => (
                  // Używamy React.Fragment zamiast View, aby uniknąć dodatkowego zagnieżdżenia
                  <React.Fragment key={item.id}>
                    {renderItem({ item })}
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>
        ) : null}
      />

      {/* Input do dodawania nowych elementów (bez zmian w JSX) */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newItemText}
          onChangeText={setNewItemText}
          placeholder="Np. 2 kg mąki"
          placeholderTextColor="#999"
          returnKeyType="done"
          onSubmitEditing={addNewItem} // Używa nowej funkcji
          blurOnSubmit={false} // Zapobiega ukrywaniu klawiatury po wysłaniu
        />
        <TouchableOpacity
          style={[styles.addButton, !newItemText.trim() && styles.addButtonDisabled]}
          onPress={addNewItem} // Używa nowej funkcji
          disabled={!newItemText.trim()}
        >
          <AntDesign name="plus" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Menu kontekstowe (bez zmian w JSX) */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)} // Zamykanie po kliknięciu tła
        >
          {/* Dodaj View, aby zapobiec zamknięciu modala po kliknięciu na przyciski */}
           <View style={styles.menuModal}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => selectedItem && startEdit(selectedItem)} // Używa nowej funkcji
                >
                  <Feather name="edit" size={20} color="#333" />
                  <Text style={styles.menuItemText}>Edytuj</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemDelete]}
                  onPress={() => selectedItem && deleteItem(selectedItem)} // Używa nowej funkcji
                >
                  <Feather name="trash-2" size={20} color="#ff4444" />
                  <Text style={[styles.menuItemText, styles.menuItemTextDelete]}>Usuń</Text>
                </TouchableOpacity>
           </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal edycji (bez zmian w JSX) */}
      <Modal
        visible={!!editingItem}
        transparent={true}
        animationType="fade" // Zmieniono na fade dla spójności
        onRequestClose={() => setEditingItem(null)}
      >
         {/* Użyj TouchableOpacity dla tła, aby je też zamykało */}
        <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setEditingItem(null)}
        >
           {/* Dodaj View, aby zapobiec zamknięciu modala po kliknięciu na input/przyciski */}
           <View style={styles.editModal} onStartShouldSetResponder={() => true}>
                <Text style={styles.editModalTitle}>Edytuj produkt</Text>
                <TextInput
                  style={styles.editInput}
                  value={editText}
                  onChangeText={setEditText}
                  placeholder="Np. 2 kg mąki"
                  placeholderTextColor="#999"
                  returnKeyType="done"
                  onSubmitEditing={saveEdit} // Używa nowej funkcji
                  autoFocus
                />
                <View style={styles.editButtons}>
                  <TouchableOpacity
                    style={[styles.editButton, styles.editButtonCancel]}
                    onPress={() => setEditingItem(null)}
                  >
                    <Text style={styles.editButtonTextCancel}>Anuluj</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editButton, styles.editButtonSave, !editText.trim() && styles.editButtonDisabled]}
                    onPress={saveEdit} // Używa nowej funkcji
                    disabled={!editText.trim()}
                  >
                    <Text style={styles.editButtonTextSave}>Zapisz</Text>
                  </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// --- Style (dodano drobne poprawki dla czytelności i spójności) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdfdff', // Jaśniejsze tło
  },
  listContent: {
    padding: 12, // Trochę więcej paddingu
    paddingBottom: 90, // Więcej miejsca na dole na input
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8, // Mniejszy padding pionowy
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8, // Bardziej zaokrąglone
    marginBottom: 6, // Mniejszy margines
    borderWidth: 1,
    borderColor: '#eee', // Jaśniejsza ramka
    elevation: 1, // Lekki cień (Android)
    shadowColor: '#000', // Cień (iOS)
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  itemContainerChecked: {
    backgroundColor: '#f9f9f9', // Jaśniejsze tło dla odznaczonych
    // elevation: 0,
    // shadowOpacity: 0,
  },
  checkboxContainer: {
    marginRight: 10, // Trochę więcej miejsca
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22, // Poprawa czytelności
  },
  itemTextChecked: {
    color: '#a0a0a0', // Jaśniejszy szary dla przekreślonych
    textDecorationLine: 'line-through',
  },
  amount: {
    fontWeight: '500',
    color: '#444',
  },
  unit: {
    color: '#777',
    fontSize: 15, // Trochę mniejsza jednostka
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20, // Więcej paddingu
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff', // Tło, aby przykryć listę
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0', // Ciemniejsza górna ramka
    gap: 10, // Odstęp między inputem a przyciskiem
  },
  input: {
    flex: 1,
    height: 44, // Trochę wyższe pole
    backgroundColor: '#f5f5f5',
    borderRadius: 8, // Bardziej zaokrąglone
    paddingHorizontal: 15, // Więcej paddingu
    fontSize: 16,
    color: '#333',
  },
  addButton: {
    width: 44, // Kwadratowy przycisk
    height: 44,
    borderRadius: 8,
    backgroundColor: '#5c7ba9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#bdbdbd', // Bardziej szary dla nieaktywnego
  },
  checkedSection: {
    marginTop: 16, // Większy odstęp
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8, // Odstęp wewnątrz sekcji
  },
  checkedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4, // Mniejszy padding dla nagłówka sekcji
  },
  checkedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkedHeaderText: {
    fontSize: 15, // Trochę mniejszy
    fontWeight: '500', // Pogrubiony
    color: '#555', // Ciemniejszy szary
    marginLeft: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f5' // Lekkie tło przycisku
  },
  clearButtonText: {
    fontSize: 13,
    color: '#555',
    marginLeft: 4,
    fontWeight: '500',
  },
  checkedList: {
    marginTop: 4,
    paddingBottom: 4, // Mały odstęp na dole
  },
  menuButton: {
    paddingLeft: 8, // Dodaj padding, aby łatwiej trafić
    paddingVertical: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Trochę jaśniejsze tło
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20, // Padding, aby modal nie dotykał krawędzi
  },
  menuModal: {
    backgroundColor: 'white',
    borderRadius: 8, // Bardziej zaokrąglone
    paddingVertical: 8, // Padding wewnątrz menu
    width: 220, // Stała szerokość menu
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12, // Większy padding
    paddingHorizontal: 16,
    // Usunięto borderRadius, bo jest na całym menuModal
  },
  menuItemDelete: {
    // Bez marginTop
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12, // Większy odstęp
    color: '#333',
  },
  menuItemTextDelete: {
    color: '#e53e3e', // Bardziej intensywny czerwony
  },
  editModal: {
    backgroundColor: 'white',
    borderRadius: 12, // Bardziej zaokrąglone
    padding: 20, // Więcej paddingu
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16, // Większy margines
    textAlign: 'center',
  },
  editInput: {
    height: 44,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
    marginBottom: 16, // Większy margines
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end', // Przyciski na końcu
    gap: 10, // Odstęp między przyciskami
    marginTop: 8, // Mały odstęp od góry
  },
  editButton: {
    paddingVertical: 10, // Większy padding
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80, // Minimalna szerokość
    alignItems: 'center',
  },
  editButtonCancel: {
    backgroundColor: '#e0e0e0', // Ciemniejszy szary dla Anuluj
  },
  editButtonSave: {
    backgroundColor: '#5c7ba9',
  },
  editButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
  editButtonText: { // Wspólny styl dla tekstu przycisków edycji
      fontSize: 16,
      fontWeight: '500',
  },
  editButtonTextCancel: { // Specyficzny kolor dla Anuluj
      color: '#444',
  },
  editButtonTextSave: { // Specyficzny kolor dla Zapisz
      color: 'white',
  },
  headerButton: {
    marginRight: 15, // Odstęp od prawej krawędzi
    padding: 5,
  },
});

// --- HOC withObservables (NOWA IMPLEMENTACJA) ---
// Obserwuje odpowiednie zapytania z nowego modelu ShoppingItem
export default withObservables([], () => ({
  // Używamy metod statycznych z nowego modelu ShoppingItem
  uncheckedItems: ShoppingItem.observeUnchecked(database),
  checkedItems: ShoppingItem.observeChecked(database)
}))(ShoppingListScreenComponent);