import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, Alert } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { MaterialIcons, AntDesign, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import database from '../../../database';
import ShoppingItem from '../../../database/models/ShoppingItem';

// Base component that receives shopping items as props
const ShoppingListScreenComponent = ({ uncheckedItems, checkedItems }: { 
  uncheckedItems: ShoppingItem[],
  checkedItems: ShoppingItem[] 
}) => {
  const [newItemText, setNewItemText] = useState('');
  const [isCheckedListVisible, setIsCheckedListVisible] = useState(true);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [editText, setEditText] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShoppingItem | null>(null);
  const navigation = useNavigation();

  const confirmClearAll = React.useCallback(() => {
    if (uncheckedItems.length === 0 && checkedItems.length === 0) return;

    Alert.alert(
      "Wyczyść listę",
      "Czy na pewno chcesz usunąć wszystkie produkty z listy zakupów?",
      [
        {
          text: "Anuluj",
          style: "cancel"
        },
        { 
          text: "Wyczyść", 
          onPress: clearAllItems,
          style: "destructive"
        }
      ]
    );
  }, [uncheckedItems.length, checkedItems.length]);

  // Dodajemy przycisk czyszczenia listy do paska nawigacji
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            console.log("Clear all button pressed");
            confirmClearAll();
          }}
        >
          <MaterialIcons name="delete-sweep" size={24} color="#ff4444" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, confirmClearAll]);

  const clearAllItems = async () => {
    try {
      await Promise.all([
        ...uncheckedItems.map(item => item.markAsDeleted()),
        ...checkedItems.map(item => item.markAsDeleted())
      ]);
    } catch (error) {
      console.error("Błąd usuwania wszystkich produktów:", error);
      Alert.alert("Błąd", "Nie udało się usunąć wszystkich produktów");
    }
  };

  const toggleItemCheck = async (item: ShoppingItem) => {
    try {
      await item.toggleChecked();
    } catch (error) {
      console.error("Błąd zmiany stanu produktu:", error);
    }
  };

  const deleteItem = async (item: ShoppingItem) => {
    try {
      await item.markAsDeleted();
      setMenuVisible(false);
    } catch (error) {
      console.error("Błąd usuwania produktu:", error);
    }
  };

  const startEdit = (item: ShoppingItem) => {
    setEditingItem(item);
    setEditText(`${item.amount || ''} ${item.unit || ''} ${item.name}`.trim());
    setMenuVisible(false);
  };

  const saveEdit = async () => {
    if (!editingItem || !editText.trim()) return;
    
    try {
      await editingItem.updateWithParsing(editText);
      setEditingItem(null);
      setEditText('');
    } catch (error) {
      console.error("Błąd podczas edycji produktu:", error);
    }
  };

  const showItemMenu = (item: ShoppingItem) => {
    setSelectedItem(item);
    setMenuVisible(true);
  };

  const addNewItem = async () => {
    if (!newItemText.trim()) return;

    try {
      await ShoppingItem.createOrUpdate(database, newItemText);
      setNewItemText('');
    } catch (error) {
      console.error("Błąd dodawania produktu:", error);
    }
  };

  const clearCheckedItems = async () => {
    try {
      await Promise.all(checkedItems.map(item => item.markAsDeleted()));
    } catch (error) {
      console.error("Błąd usuwania zaznaczonych produktów:", error);
    }
  };

  const renderItem = ({ item }: { item: ShoppingItem }) => (
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
          size={24}
          color={item.isChecked ? "#2196F3" : "#999"}
        />
      </View>
      <View style={styles.itemContent}>
        <Text style={[
          styles.itemText,
          item.isChecked && styles.itemTextChecked
        ]}>
          {item.amount !== null && (
            <Text style={styles.amount}>{item.amount} </Text>
          )}
          {item.unit && (
            <Text style={styles.unit}>{item.unit} </Text>
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

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {(!uncheckedItems || uncheckedItems.length === 0) && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Lista zakupów jest pusta</Text>
          <Text style={styles.emptySubText}>Dodaj składniki z przepisów do listy zakupów</Text>
        </View>
      )}
      
      <FlatList
        data={uncheckedItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={() => checkedItems.length > 0 ? (
          <View style={styles.checkedSection}>
            <TouchableOpacity
              style={styles.checkedHeader}
              onPress={() => setIsCheckedListVisible(!isCheckedListVisible)}
            >
              <View style={styles.checkedHeaderLeft}>
                <MaterialIcons
                  name={isCheckedListVisible ? "expand-less" : "expand-more"}
                  size={24}
                  color="#666"
                />
                <Text style={styles.checkedHeaderText}>
                  Kupione ({checkedItems.length})
                </Text>
              </View>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearCheckedItems}
              >
                <MaterialIcons name="delete-outline" size={20} color="#666" />
                <Text style={styles.clearButtonText}>Wyczyść</Text>
              </TouchableOpacity>
            </TouchableOpacity>
            {isCheckedListVisible && (
              <View style={styles.checkedList}>
                {checkedItems.map(item => (
                  <React.Fragment key={item.id}>
                    {renderItem({ item })}
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>
        ) : null}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newItemText}
          onChangeText={setNewItemText}
          placeholder="Np. 2 kg mąki"
          placeholderTextColor="#999"
          returnKeyType="done"
          onSubmitEditing={addNewItem}
        />
        <TouchableOpacity 
          style={[
            styles.addButton,
            !newItemText.trim() && styles.addButtonDisabled
          ]}
          onPress={addNewItem}
          disabled={!newItemText.trim()}
        >
          <AntDesign name="plus" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Menu kontekstowe */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuModal}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => selectedItem && startEdit(selectedItem)}
            >
              <Feather name="edit" size={20} color="#333" />
              <Text style={styles.menuItemText}>Edytuj</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDelete]}
              onPress={() => selectedItem && deleteItem(selectedItem)}
            >
              <Feather name="trash-2" size={20} color="#ff4444" />
              <Text style={[styles.menuItemText, styles.menuItemTextDelete]}>Usuń</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal edycji */}
      <Modal
        visible={!!editingItem}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditingItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.editModalTitle}>Edytuj produkt</Text>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              placeholder="Np. 2 kg mąki"
              placeholderTextColor="#999"
              returnKeyType="done"
              onSubmitEditing={saveEdit}
              autoFocus
            />
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.editButton, styles.editButtonCancel]}
                onPress={() => setEditingItem(null)}
              >
                <Text style={styles.editButtonText}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editButton,
                  styles.editButtonSave,
                  !editText.trim() && styles.editButtonDisabled
                ]}
                onPress={saveEdit}
                disabled={!editText.trim()}
              >
                <Text style={styles.editButtonText}>Zapisz</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  itemContainerChecked: {
    backgroundColor: '#f8f8f8',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    fontSize: 16,
    color: '#333',
  },
  itemTextChecked: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  amount: {
    fontWeight: '500',
  },
  unit: {
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
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
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  checkedSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  checkedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  checkedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkedHeaderText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  checkedList: {
    marginTop: 8,
  },
  menuButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuModal: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    minWidth: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 4,
  },
  menuItemDelete: {
    marginTop: 4,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#333',
  },
  menuItemTextDelete: {
    color: '#ff4444',
  },
  editModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxWidth: 400,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  editInput: {
    height: 48,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  editButtonCancel: {
    backgroundColor: '#f5f5f5',
  },
  editButtonSave: {
    backgroundColor: '#2196F3',
  },
  editButtonDisabled: {
    backgroundColor: '#ccc',
  },
  editButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
});

// Enhance the component with WatermelonDB observables
export default withObservables([], () => ({
  uncheckedItems: ShoppingItem.observeUnchecked(database),
  checkedItems: ShoppingItem.observeChecked(database)
}))(ShoppingListScreenComponent); 