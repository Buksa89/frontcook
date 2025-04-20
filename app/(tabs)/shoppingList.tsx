// app/(tabs)/shoppingList.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Modal, Alert, ActivityIndicator, ScrollView // Dodano ScrollView dla sekcji zaznaczonych
} from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { MaterialIcons, AntDesign, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import database from '../../src/database';
import ShoppingItem from '../../src/database/models/ShoppingItem';
import { useAuth } from '../../src/contexts/AuthContext';
import { Q, Model } from '@nozbe/watermelondb';
import { Observable, combineLatest, of, from } from 'rxjs';
import { map, switchMap, distinctUntilChanged, startWith } from 'rxjs/operators';

// Interfejsy (bez zmian)
interface ObservedProps { uncheckedItems: ShoppingItem[] | undefined; checkedItems: ShoppingItem[] | undefined; isLoading: boolean; }
interface ObservableResult { itemsData: Observable<Omit<ObservedProps, 'isLoading'>>; isLoading: Observable<boolean>; }

// Komponent Wewnętrzny
const ShoppingListScreenComponent: React.FC<ObservedProps> = ({ uncheckedItems, checkedItems, isLoading }) => {
  const safeUncheckedItems = Array.isArray(uncheckedItems) ? uncheckedItems : [];
  const safeCheckedItems = Array.isArray(checkedItems) ? checkedItems : [];

  // Stany (bez zmian)
  const [newItemText, setNewItemText] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isCheckedListVisible, setIsCheckedListVisible] = useState(true); // Domyślnie pokazuj kupione
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [editText, setEditText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [contextMenuItem, setContextMenuItem] = useState<ShoppingItem | null>(null);

  const navigation = useNavigation();
  const { userId } = useAuth();

  // Funkcje CRUD i pomocnicze (logika bez zmian)
  const clearAllItems = useCallback(async () => { if (!userId) return; const a = [...safeUncheckedItems, ...safeCheckedItems]; if (a.length === 0) return; try { await database.write(async () => { await database.batch(...a.map(i => i.prepareMarkAsDeleted())); }); } catch (e) { Alert.alert("Błąd", "Nie udało się wyczyścić listy."); } }, [userId, safeUncheckedItems, safeCheckedItems]);
  const confirmClearAll = useCallback(() => { if (safeUncheckedItems.length === 0 && safeCheckedItems.length === 0) return; Alert.alert( "Wyczyść listę", "Usunąć wszystkie produkty?", [ { text: "Anuluj" }, { text: "Wyczyść", onPress: clearAllItems, style: "destructive" } ] ); }, [safeUncheckedItems.length, safeCheckedItems.length, clearAllItems]);
  useEffect(() => { navigation.setOptions({ headerRight: () => (<TouchableOpacity style={styles.headerButton} onPress={confirmClearAll}><MaterialIcons name="delete-sweep" size={24} color="#e53935" /></TouchableOpacity>), }); }, [navigation, confirmClearAll]);
  const toggleItemCheck = useCallback(async (item: ShoppingItem) => { try { await database.write(() => item.toggleChecked()); } catch (e) { Alert.alert("Błąd", "Nie udało się zmienić statusu."); } }, []);
  const deleteItem = useCallback(async (item: ShoppingItem) => { try { await database.write(() => item.deleteItem()); closeContextMenu(); } catch (e) { Alert.alert("Błąd", "Nie udało się usunąć."); } }, []);
  const confirmDeleteItem = (item: ShoppingItem) => { setContextMenuItem(null); Alert.alert( 'Usuń produkt', `Usunąć "${item.name}"?`, [ { text: 'Anuluj'}, { text: 'Usuń', onPress: () => deleteItem(item), style: 'destructive'} ] ) }
  const startEdit = useCallback((item: ShoppingItem) => { setEditingItem(item); const a = item.amount ?? ''; const u = item.unit ?? ''; setEditText(`${a} ${u} ${item.name}`.trim().replace(/\s+/g, ' ')); closeContextMenu(); }, []);
  const saveEdit = useCallback(async () => { if (!editingItem || !editText.trim()) return; setIsSavingEdit(true); try { await database.write(() => editingItem.updateFromText(editText)); setEditingItem(null); setEditText(''); } catch (e) { Alert.alert("Błąd", "Nie udało się zapisać zmian."); } finally { setIsSavingEdit(false); } }, [editingItem, editText]);
  const addNewItem = useCallback(async () => { if (!newItemText.trim()) return; setIsAddingItem(true); const t = newItemText; setNewItemText(''); try { await ShoppingItem.addItemFromText(database, userId, t); } catch (e) { Alert.alert("Błąd", "Nie udało się dodać produktu."); setNewItemText(t); } finally { setIsAddingItem(false); } }, [userId, newItemText]);
  const clearCheckedItems = useCallback(async () => { if (safeCheckedItems.length === 0) return; Alert.alert( "Wyczyść kupione", "Usunąć kupione produkty?", [ { text: "Anuluj" }, { text: "Wyczyść", onPress: async () => { try { await database.write(async () => { await database.batch(...safeCheckedItems.map(i => i.prepareMarkAsDeleted())); }); } catch (e) { Alert.alert("Błąd", "Nie udało się usunąć kupionych."); } }, style: "destructive" } ] ); }, [safeCheckedItems]);
  const openContextMenu = (item: ShoppingItem) => setContextMenuItem(item);
  const closeContextMenu = () => setContextMenuItem(null);

  // --- Renderowanie Elementu Listy ---
  const renderItem = useCallback(({ item }: { item: ShoppingItem }) => {
    let displayAmount = ''; if (item.amount) { try { const n = parseFloat(item.amount.replace(',','.')); if (!isNaN(n)) { if (n !== 1 || item.unit) { displayAmount = Number.isInteger(n)?n.toString():n.toFixed(1).replace('.0','');} } } catch {} }
    return (
      <TouchableOpacity style={[styles.itemContainer, item.isChecked && styles.itemContainerChecked]} onPress={() => toggleItemCheck(item)} onLongPress={() => openContextMenu(item)} delayLongPress={400}>
        <TouchableOpacity onPress={() => toggleItemCheck(item)} style={styles.checkboxContainer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 5 }}>
           <MaterialIcons name={item.isChecked ? "check-box" : "check-box-outline-blank"} size={24} color={item.isChecked ? styles.checkedColor.color : styles.uncheckedColor.color} />
        </TouchableOpacity>
        <View style={styles.itemContent}>
          <Text style={[styles.itemText, item.isChecked && styles.itemTextChecked]} numberOfLines={2}>
            {displayAmount && <Text style={styles.amountText}>{displayAmount}{' '}</Text>}
            {item.unit && <Text style={styles.unitText}>{item.unit}{' '}</Text>}
            {item.name}
          </Text>
        </View>
         <TouchableOpacity style={styles.menuButton} onPress={() => openContextMenu(item)} hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}>
            <Feather name="more-vertical" size={20} color={styles.menuIconColor.color} />
         </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [toggleItemCheck, openContextMenu]); // Dodano zależności

  // --- Renderowanie Główne ---
  if (isLoading && safeUncheckedItems.length === 0 && safeCheckedItems.length === 0) {
    return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color={styles.primaryColor.color} /></View>);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      {/* Stan Pusty */}
      {!isLoading && safeUncheckedItems.length === 0 && safeCheckedItems.length === 0 && (
        <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateIconCircle}>
                <AntDesign name="shoppingcart" size={50} color={styles.primaryColor.color} style={{opacity: 0.8}} />
            </View>
            <Text style={styles.emptyStateTitle}>Lista zakupów jest pusta</Text>
            <Text style={styles.emptyStateSubtitle}>Dodaj produkty poniżej lub z przepisu.</Text>
        </View>
      )}

      {/* Lista */}
      <FlatList
        data={safeUncheckedItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContentContainer}
        ListHeaderComponent={safeUncheckedItems.length > 0 ? <Text style={styles.listHeader}>Do kupienia</Text> : null}
        ListFooterComponent={() => (
          <>
            {safeCheckedItems.length > 0 && (
              <View style={styles.checkedSection}>
                <TouchableOpacity style={styles.checkedHeader} onPress={() => setIsCheckedListVisible(!isCheckedListVisible)} activeOpacity={0.7}>
                  <View style={styles.checkedHeaderLeft}>
                    <MaterialIcons name={isCheckedListVisible ? "expand-less" : "expand-more"} size={24} color={styles.secondaryTextColor.color} />
                    <Text style={styles.checkedHeaderText}>Kupione ({safeCheckedItems.length})</Text>
                  </View>
                  <TouchableOpacity style={styles.clearButton} onPress={clearCheckedItems}>
                     <MaterialIcons name="delete-outline" size={20} color={styles.secondaryTextColor.color} />
                     <Text style={styles.clearButtonText}>Wyczyść</Text>
                   </TouchableOpacity>
                </TouchableOpacity>
                {/* Użyj ScrollView dla krótkiej listy zaznaczonych, aby uniknąć problemów z wydajnością zagnieżdżonej FlatList */}
                {isCheckedListVisible && (
                  <ScrollView style={styles.checkedListScrollView}>
                      {safeCheckedItems.map(item => (<React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>))}
                  </ScrollView>
                )}
              </View>
            )}
            {/* Zwiększony margines dolny, aby input nie zakrywał ostatniego elementu */}
            <View style={{ height: 100 }} />
          </>
        )}
      />

      {/* Input Dodawania */}
      <View style={styles.inputWrapper}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newItemText}
            onChangeText={setNewItemText}
            placeholder="Dodaj produkt..."
            placeholderTextColor={styles.placeholderColor.color}
            returnKeyType="done"
            onSubmitEditing={addNewItem}
            blurOnSubmit={false}
            editable={!isAddingItem}
          />
          <TouchableOpacity
            style={[styles.addButton, (!newItemText.trim() || isAddingItem) && styles.addButtonDisabled]}
            onPress={addNewItem}
            disabled={!newItemText.trim() || isAddingItem}
          >
            {isAddingItem ? <ActivityIndicator color="#fff" size="small" /> : <AntDesign name="plus" size={20} color="white" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Modale (bez zmian w logice, tylko style) */}
      <Modal visible={!!contextMenuItem} transparent={true} animationType="fade" onRequestClose={closeContextMenu}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeContextMenu}>
          <View style={styles.contextMenu} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.contextMenuItem} onPress={() => contextMenuItem && startEdit(contextMenuItem)}><Feather name="edit-2" size={20} color={styles.textColor.color} /><Text style={styles.contextMenuItemText}>Edytuj</Text></TouchableOpacity>
            <View style={styles.contextMenuSeparator} />
            <TouchableOpacity style={styles.contextMenuItem} onPress={() => contextMenuItem && confirmDeleteItem(contextMenuItem)}><Feather name="trash-2" size={20} color={styles.dangerColor.color} /><Text style={[styles.contextMenuItemText, styles.contextMenuItemTextDelete]}>Usuń</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal visible={!!editingItem} transparent={true} animationType="fade" onRequestClose={() => setEditingItem(null)}>
         <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditingItem(null)}>
           <View style={styles.editModal} onStartShouldSetResponder={() => true}>
                <Text style={styles.editModalTitle}>Edytuj produkt</Text>
                <TextInput style={styles.editInput} value={editText} onChangeText={setEditText} placeholder="Ilość Jednostka Nazwa" placeholderTextColor={styles.placeholderColor.color} returnKeyType="done" onSubmitEditing={saveEdit} autoFocus editable={!isSavingEdit} />
                <View style={styles.editButtons}>
                  <TouchableOpacity style={[styles.editButton, styles.editButtonCancel]} onPress={() => setEditingItem(null)} disabled={isSavingEdit}><Text style={styles.editButtonTextCancel}>Anuluj</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.editButton, styles.editButtonSave, (!editText.trim() || isSavingEdit) && styles.editButtonDisabled]} onPress={saveEdit} disabled={!editText.trim() || isSavingEdit}>{isSavingEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.editButtonTextSave}>Zapisz</Text>}</TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// --- HOC (bez zmian w logice) ---
const enhance = withObservables([], (): ObservableResult => {
    const uncheckedObs = ShoppingItem.observeUnchecked(database).pipe(startWith([]));
    const checkedObs = ShoppingItem.observeChecked(database).pipe(startWith([]));
    const itemsDataObs: Observable<Omit<ObservedProps, 'isLoading'>> = combineLatest([uncheckedObs, checkedObs]).pipe(map(([unchecked, checked]) => ({ uncheckedItems: unchecked, checkedItems: checked, })));
    const isLoadingObs: Observable<boolean> = combineLatest([uncheckedObs, checkedObs]).pipe(map(([unchecked, checked]) => unchecked === undefined || checked === undefined), startWith(true), distinctUntilChanged());
    return { itemsData: itemsDataObs, isLoading: isLoadingObs, };
});

// --- Komponent Kontenera (bez zmian w logice) ---
const ShoppingListScreenContainer = () => {
     const EnhancedShoppingList = enhance(
       ({ itemsData, isLoading }: { itemsData: Omit<ObservedProps, 'isLoading'> | undefined, isLoading: boolean | undefined }) => {
           const unchecked = itemsData?.uncheckedItems ?? []; const checked = itemsData?.checkedItems ?? [];
           const loading = isLoading ?? true;
           return ( <ShoppingListScreenComponent uncheckedItems={unchecked} checkedItems={checked} isLoading={loading} /> );
       }
     );
     return <EnhancedShoppingList />;
}

export default ShoppingListScreenContainer;


// --- NOWE, ULEPSZONE STYLE ---
const styles = StyleSheet.create({
  // Kolory
  primaryColor: { color: '#5c7ba9' },
  secondaryTextColor: { color: '#6c757d' },
  textColor: { color: '#343a40' },
  placeholderColor: { color: '#adb5bd' },
  backgroundColor: { backgroundColor: '#f8f9fa' },
  cardBackgroundColor: { backgroundColor: '#ffffff' },
  checkedBackgroundColor: { backgroundColor: '#f1f3f5' },
  checkedColor: { color: '#5c7ba9' }, // Kolor zaznaczonego checkboxa
  uncheckedColor: { color: '#888' }, // Kolor niezaznaczonego checkboxa
  dangerColor: { color: '#e53935' },
  separatorColor: { color: '#e9ecef' },
  disabledColor: { color: '#ced4da' },

  // Główny kontener
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa', // Użycie zmiennej
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },

  // Lista
  listContentContainer: {
    paddingHorizontal: 16, // Zwiększony padding horyzontalny
    paddingTop: 16,
    paddingBottom: 120, // Dużo miejsca na input
  },
  listHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d', // Użycie zmiennej
    marginBottom: 12,
    marginLeft: 4, // Lekkie wcięcie
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Element listy
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff', // Użycie zmiennej
    borderRadius: 12, // Bardziej zaokrąglone
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  itemContainerChecked: {
    backgroundColor: '#f1f3f5', // Użycie zmiennej
    elevation: 0,
    shadowOpacity: 0,
  },
  checkboxContainer: {
     paddingRight: 14, // Więcej miejsca
     paddingVertical: 6,
  },
  itemContent: {
    flex: 1,
    marginRight: 10,
  },
  itemText: {
    fontSize: 16,
    color: '#343a40', // Użycie zmiennej
    lineHeight: 22, // Poprawa czytelności
  },
  itemTextChecked: {
    color: '#adb5bd', // Użycie zmiennej
    textDecorationLine: 'line-through',
  },
  amountText: {
      fontWeight: '600', // Pogrubiona ilość
      color: '#495057', // Ciemniejszy szary
  },
  unitText: {
      color: '#6c757d', // Szary dla jednostki
      fontSize: 15,
  },
  menuButton: {
      padding: 8,
  },
  menuIconColor: { color: '#adb5bd' }, // Kolor ikony menu

  // Sekcja zaznaczonych
  checkedSection: {
    marginTop: 24, // Większy odstęp
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef', // Użycie zmiennej
    paddingTop: 8,
  },
  checkedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 8, // Odstęp od listy
  },
  checkedHeaderLeft: { flexDirection: 'row', alignItems: 'center', },
  checkedHeaderText: { fontSize: 14, fontWeight: '600', color: '#6c757d', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5, },
  clearButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#e9ecef' }, // Tło przycisku
  clearButtonText: { fontSize: 13, color: '#6c757d', marginLeft: 4, fontWeight: '500', },
  checkedListScrollView: {
      // Można dodać max-height, jeśli lista bywa bardzo długa
      // maxHeight: 200,
  },

  // Input dodawania
  inputWrapper: { // Dodatkowy wrapper dla cienia/bordera
      backgroundColor: '#ffffff',
      borderTopWidth: 1,
      borderTopColor: '#dee2e6',
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingBottom: Platform.OS === 'ios' ? 34 : 16, // Bezpieczny obszar na dole dla iOS
      position: 'absolute', // Pozycjonowanie na dole
      bottom: 0,
      left: 0,
      right: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 50, // Zwiększona wysokość
    backgroundColor: '#f1f3f5',
    borderRadius: 10,
    paddingHorizontal: 16, // Więcej paddingu
    fontSize: 16,
    color: '#343a40',
  },
  addButton: {
    width: 50, // Dopasuj do wysokości inputu
    height: 50,
    borderRadius: 10,
    backgroundColor: '#5c7ba9', // Użycie zmiennej
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  addButtonDisabled: {
    backgroundColor: '#ced4da', // Użycie zmiennej
    elevation: 0,
    shadowOpacity: 0,
  },

  // Stan pusty
  emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, paddingBottom: 100, }, // Więcej paddingu na dole
  emptyStateIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#e9ecef', justifyContent: 'center', alignItems: 'center', marginBottom: 24, },
  emptyStateTitle: { fontSize: 18, color: '#6c757d', fontWeight: '600', marginBottom: 8, textAlign: 'center', },
  emptyStateSubtitle: { fontSize: 14, color: '#adb5bd', textAlign: 'center', },

  // Modale
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20, },
  contextMenu: { backgroundColor: 'white', borderRadius: 12, paddingVertical: 8, minWidth: 220, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5, },
  contextMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, },
  contextMenuSeparator: { height: 1, backgroundColor: '#f1f3f5', marginHorizontal: 10, },
  contextMenuItemText: { fontSize: 16, marginLeft: 15, color: '#343a40', },
  contextMenuItemTextDelete: { color: '#e53935', },
  editModal: { backgroundColor: 'white', borderRadius: 16, padding: 24, width: '95%', maxWidth: 450, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5, },
  editModalTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 20, textAlign: 'center', },
  editInput: { height: 50, backgroundColor: '#f1f3f5', borderRadius: 10, paddingHorizontal: 16, fontSize: 16, color: '#343a40', marginBottom: 20, },
  editButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 10, },
  editButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, minWidth: 90, alignItems: 'center', },
  editButtonCancel: { backgroundColor: '#e9ecef', },
  editButtonSave: { backgroundColor: '#5c7ba9', },
  editButtonDisabled: { backgroundColor: '#ced4da', },
  editButtonTextSave: { fontSize: 16, fontWeight: '600', color: 'white' },
  editButtonTextCancel: { fontSize: 16, fontWeight: '600', color: '#495057' },
  headerButton: { marginRight: 16, padding: 6, },
});