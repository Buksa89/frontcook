// app/(tabs)/shoppingList.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Modal, Alert, ActivityIndicator,
  LayoutAnimation, UIManager, Pressable
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator, DragEndParams } from 'react-native-draggable-flatlist';
import { withObservables } from '@nozbe/watermelondb/react';
import { MaterialIcons, AntDesign, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import database from '../../src/database';
import ShoppingItem from '../../src/database/models/ShoppingItem';
import { useAuth } from '../../src/contexts/AuthContext';
import { Q, Model } from '@nozbe/watermelondb';
import { Observable, combineLatest, of, from } from 'rxjs';
import { map, switchMap, distinctUntilChanged, startWith } from 'rxjs/operators';
import { showToast } from '../../src/components/Toast';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ObservedProps { uncheckedItems: ShoppingItem[] | undefined; checkedItems: ShoppingItem[] | undefined; isLoading: boolean; }
interface ObservableResult { itemsData: Observable<Omit<ObservedProps, 'isLoading'>>; isLoading: Observable<boolean>; }

const ShoppingListScreenComponent: React.FC<ObservedProps> = ({ uncheckedItems, checkedItems, isLoading }) => {
  const safeUncheckedItems = Array.isArray(uncheckedItems) ? uncheckedItems : [];
  const safeCheckedItems = Array.isArray(checkedItems) ? checkedItems : [];
  const [localUncheckedItems, setLocalUncheckedItems] = useState<ShoppingItem[]>(safeUncheckedItems);
  useEffect(() => { setLocalUncheckedItems(safeUncheckedItems); }, [safeUncheckedItems]);

  const [newItemText, setNewItemText] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isCheckedListVisible, setIsCheckedListVisible] = useState(true);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [editText, setEditText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [contextMenuItem, setContextMenuItem] = useState<ShoppingItem | null>(null);

  const navigation = useNavigation();
  const { userId } = useAuth();

  // --- Logika (bez zmian funkcjonalnych) ---
  const clearAllItems = useCallback(async () => { if (!userId && !localUncheckedItems.length && !safeCheckedItems.length) return; const all = [...localUncheckedItems, ...safeCheckedItems]; if(!all.length) return; try { await database.write(async()=>{await database.batch(...all.map(i=>i.prepareMarkAsDeleted()))}); showToast({type:'success', text1:'Lista wyczyszczona'}); } catch (e){console.error(e); showToast({type:'error',text1:'Błąd', text2:'Nie udało się wyczyścić.'});}}, [userId, localUncheckedItems, safeCheckedItems]);
  const confirmClearAll = useCallback(() => { if(!localUncheckedItems.length && !safeCheckedItems.length) return; Alert.alert("Wyczyść listę","Usunąć wszystko?",[{text:"Anuluj"},{text:"Wyczyść",onPress:clearAllItems,style:"destructive"}]);}, [localUncheckedItems.length, safeCheckedItems.length, clearAllItems]);
  useEffect(() => { navigation.setOptions({ headerRight: () => (<TouchableOpacity style={styles.headerButton} onPress={confirmClearAll}><MaterialIcons name="delete-sweep" size={24} color={styles.secondaryTextColor.color} /></TouchableOpacity>), }); }, [navigation, confirmClearAll]);
  const toggleItemCheck = useCallback(async (item: ShoppingItem) => { try { await item.toggleChecked(); } catch (e){console.error(e); showToast({type:'error',text1:'Błąd',text2:'Nie udało się zmienić statusu.'});}}, []);
  const deleteItem = useCallback(async (item: ShoppingItem) => { try { await item.deleteItem(); closeContextMenu(); showToast({type:'info', text1:'Usunięto', text2:`"${item.name}"`}); } catch (e){console.error(e); showToast({type:'error',text1:'Błąd',text2:'Nie udało się usunąć.'});}}, []);
  const confirmDeleteItem = (item: ShoppingItem) => { setContextMenuItem(null); Alert.alert('Usuń produkt', `Usunąć "${item.name}"?`,[{text:'Anuluj'},{text:'Usuń',onPress:()=>deleteItem(item),style:'destructive'}]); }
  const startEdit = useCallback((item: ShoppingItem) => { setEditingItem(item); const a=item.amount??''; const u=item.unit??''; setEditText(`${a} ${u} ${item.name}`.trim().replace(/\s+/g,' ')); closeContextMenu();}, []);
  const saveEdit = useCallback(async () => { if (!editingItem || !editText.trim()) return; setIsSavingEdit(true); try { await editingItem.updateFromText(editText); setEditingItem(null); setEditText(''); showToast({type:'success',text1:'Zapisano'}); } catch (e){console.error(e); showToast({type:'error',text1:'Błąd',text2:'Nie udało się zapisać.'});} finally {setIsSavingEdit(false);} }, [editingItem, editText]);
  const addNewItem = useCallback(async () => { if (!newItemText.trim()) return; setIsAddingItem(true); const t=newItemText; setNewItemText(''); try { await ShoppingItem.addItemFromText(database, userId, t); } catch (e){console.error(e); showToast({type:'error',text1:'Błąd',text2:'Nie udało się dodać.'}); setNewItemText(t);} finally {setIsAddingItem(false);} }, [userId, newItemText]);
  const clearCheckedItems = useCallback(async () => { if (safeCheckedItems.length === 0) return; Alert.alert("Wyczyść kupione","Usunąć kupione?",[{text:"Anuluj"},{text:"Wyczyść",onPress:async()=>{try{await database.write(async()=>{await database.batch(...safeCheckedItems.map(i=>i.prepareDeleteItem()))}); showToast({type:'success',text1:'Wyczyszczono'});}catch(e){console.error(e); showToast({type:'error',text1:'Błąd',text2:'Nie udało się usunąć.'});}},style:"destructive"}]);}, [safeCheckedItems]);
  const openContextMenu = (item: ShoppingItem) => setContextMenuItem(item);
  const closeContextMenu = () => setContextMenuItem(null);
  const toggleCheckedListVisibility = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsCheckedListVisible(!isCheckedListVisible); }

  // --- FUNKCJA OBSŁUGUJĄCA KONIEC PRZECIĄGANIA (ZAKTUALIZOWANA) ---
  const handleDragEnd = useCallback(async ({ data: reorderedItems }: DragEndParams<ShoppingItem>) => {
    setLocalUncheckedItems(reorderedItems); // Optymistyczna aktualizacja UI
    try {
      // Przygotuj operacje batch poza transakcją write
      const batchOps = await ShoppingItem.bulkUpdateOrder(database, reorderedItems);
      // Wykonaj operacje batch w transakcji write, jeśli są jakieś zmiany
      if (batchOps.length > 0) {
        await database.write(async (writer) => {
          await writer.batch(...batchOps);
        });
        console.log("[ShoppingList] Zaktualizowano kolejność w bazie danych.");
      } else {
         console.log("[ShoppingList] Brak zmian w kolejności do zapisania.");
      }
    } catch (error) {
      console.error("[ShoppingList] Błąd podczas zapisu nowej kolejności:", error);
      showToast({type: 'error', text1: 'Błąd', text2: 'Nie udało się zapisać kolejności.'});
      setLocalUncheckedItems(safeUncheckedItems); // Przywróć stan
    }
  }, [safeUncheckedItems]); // Zależność od oryginalnej listy

  // --- Renderowanie Elementu Listy (dla DraggableFlatList) ---
  const renderDraggableItem = useCallback(({ item, drag, isActive }: RenderItemParams<ShoppingItem>) => {
    let displayAmount = item.amount ?? ''; if (displayAmount) { try { const n = parseFloat(displayAmount.replace(',','.')); if(!isNaN(n)) { if (n !== 1 || item.unit) { displayAmount = Number.isInteger(n)?n.toString():n.toFixed(1).replace('.0','');} } } catch {} }
    return (
      <ScaleDecorator>
          <Pressable style={({ pressed }) => [ styles.itemContainer, item.isChecked && styles.itemContainerChecked, pressed && styles.itemPressed, isActive && styles.itemDragging ]} onPress={() => toggleItemCheck(item)} onLongPress={drag} >
            <TouchableOpacity onPress={() => toggleItemCheck(item)} style={styles.checkboxContainer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 5 }}><MaterialIcons name={"check-box-outline-blank"} size={22} color={styles.uncheckedColor.color} /></TouchableOpacity>
            <View style={styles.itemContent}><Text style={[styles.itemText, item.isChecked && styles.itemTextChecked]} numberOfLines={1} ellipsizeMode='tail'>{displayAmount && <Text style={styles.amountText}>{displayAmount}{' '}</Text>}{item.unit && <Text style={[styles.unitText, styles.secondaryTextColor]}>{item.unit}{' '}</Text>}<Text style={styles.nameText}>{item.name}</Text></Text></View>
            <TouchableOpacity style={styles.menuButton} onPress={() => openContextMenu(item)} hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}><Feather name="more-vertical" size={18} color={styles.placeholderColor.color} /></TouchableOpacity>
          </Pressable>
      </ScaleDecorator>
    );
  }, [toggleItemCheck, openContextMenu]);

  // --- Renderowanie Elementu Kupionego (bez zmian) ---
  const renderCheckedItem = useCallback(({ item }: { item: ShoppingItem }) => {
    let displayAmount = item.amount ?? ''; if (displayAmount) { try { const n = parseFloat(displayAmount.replace(',','.')); if(!isNaN(n)) { if (n !== 1 || item.unit) { displayAmount = Number.isInteger(n)?n.toString():n.toFixed(1).replace('.0','');} } } catch {} }
    return (
      <Pressable style={({ pressed }: { pressed: boolean }) => [ styles.itemContainer, styles.itemContainerChecked, pressed && styles.itemPressed ]} onPress={() => toggleItemCheck(item)} onLongPress={() => openContextMenu(item)} delayLongPress={400} >
        <TouchableOpacity onPress={() => toggleItemCheck(item)} style={styles.checkboxContainer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 5 }}><MaterialIcons name={"check-box"} size={22} color={styles.checkedColor.color} /></TouchableOpacity>
        <View style={styles.itemContent}><Text style={[styles.itemText, styles.itemTextChecked]} numberOfLines={1} ellipsizeMode='tail'>{displayAmount && <Text style={styles.amountText}>{displayAmount}{' '}</Text>}{item.unit && <Text style={[styles.unitText, styles.secondaryTextColor]}>{item.unit}{' '}</Text>}<Text style={styles.nameText}>{item.name}</Text></Text></View>
        <TouchableOpacity style={styles.menuButton} onPress={() => openContextMenu(item)} hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}><Feather name="more-vertical" size={18} color={styles.placeholderColor.color} /></TouchableOpacity>
      </Pressable>
    );
  }, [toggleItemCheck, openContextMenu]);


  // --- Renderowanie Główne ---
  if (isLoading && localUncheckedItems.length === 0 && safeCheckedItems.length === 0) { return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color={styles.placeholderColor.color} /></View>); }
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
      {!isLoading && localUncheckedItems.length === 0 && safeCheckedItems.length === 0 && ( <View style={styles.emptyState}><AntDesign name="shoppingcart" size={64} color={styles.borderColor.borderColor} /><Text style={styles.emptyText}>Twoja lista jest pusta</Text><Text style={styles.emptySubText}>Dodaj produkty poniżej</Text></View> )}
      <DraggableFlatList
        data={localUncheckedItems} renderItem={renderDraggableItem} keyExtractor={(item) => item.id} onDragEnd={handleDragEnd} // Przekazano poprawną funkcję
        containerStyle={{ flex: 1 }} contentContainerStyle={styles.listContent}
        ListFooterComponent={() => (
          <>
            {safeCheckedItems.length > 0 && (
              <View style={styles.checkedSection}>
                <TouchableOpacity style={styles.checkedHeader} onPress={toggleCheckedListVisibility} activeOpacity={0.7}>
                  <View style={styles.checkedHeaderLeft}>
                    <MaterialIcons 
                      name={isCheckedListVisible ? "keyboard-arrow-down" : "keyboard-arrow-right"} 
                      size={24} 
                      color={styles.secondaryTextColor.color} 
                    />
                    <Text style={styles.checkedHeaderText}>Kupione ({safeCheckedItems.length})</Text>
                  </View>
                  {isCheckedListVisible && (
                    <TouchableOpacity style={styles.clearButton} onPress={clearCheckedItems}>
                      <MaterialIcons name="delete-outline" size={18} color={styles.secondaryTextColor.color} />
                      <Text style={styles.clearButtonText}>Wyczyść</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                {isCheckedListVisible && (
                  <View style={styles.checkedListContainer}>
                    {safeCheckedItems.map(item => (
                      <React.Fragment key={item.id}>
                        {renderCheckedItem({ item })}
                      </React.Fragment>
                    ))}
                  </View>
                )}
              </View>
            )}
            <View style={{ height: 90 }} />
          </>
        )}
      />
      <View style={styles.inputWrapper}>
        <View style={styles.inputContainer}>
          <TextInput 
            style={styles.input} 
            value={newItemText} 
            onChangeText={setNewItemText} 
            placeholder="Co dodać do listy?" 
            placeholderTextColor={styles.placeholderColor.color} 
            returnKeyType="done" 
            onSubmitEditing={addNewItem} 
            blurOnSubmit={false} 
            editable={!isAddingItem} 
          />
          <TouchableOpacity 
            style={[
              styles.addButton, 
              (!newItemText.trim() || isAddingItem) && styles.addButtonDisabled
            ]} 
            onPress={addNewItem} 
            disabled={!newItemText.trim() || isAddingItem}
          >
            {isAddingItem ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <AntDesign name="plus" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Context Menu Modal */}
      <Modal 
        visible={!!contextMenuItem} 
        transparent={true} 
        animationType="fade" 
        onRequestClose={closeContextMenu}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={closeContextMenu}
        >
          <View style={styles.contextMenu} onStartShouldSetResponder={() => true}>
            <TouchableOpacity 
              style={styles.contextMenuItem} 
              onPress={() => contextMenuItem && startEdit(contextMenuItem)}
            >
              <Feather name="edit-2" size={18} color={styles.secondaryTextColor.color} />
              <Text style={styles.contextMenuItemText}>Edytuj</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.contextMenuItem, styles.contextMenuItemDelete]} 
              onPress={() => contextMenuItem && confirmDeleteItem(contextMenuItem)}
            >
              <Feather name="trash-2" size={18} color={styles.dangerColor.color} />
              <Text style={[styles.contextMenuItemText, styles.contextMenuItemTextDelete]}>Usuń</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      
      {/* Edit Item Modal */}
      <Modal 
        visible={!!editingItem} 
        transparent={true} 
        animationType="fade" 
        onRequestClose={() => setEditingItem(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setEditingItem(null)}
        >
          <View style={styles.editModal} onStartShouldSetResponder={() => true}>
            <Text style={styles.editModalTitle}>Edytuj produkt</Text>
            <TextInput 
              style={styles.editInput} 
              value={editText} 
              onChangeText={setEditText} 
              placeholder="Ilość Jednostka Nazwa" 
              placeholderTextColor={styles.placeholderColor.color} 
              returnKeyType="done" 
              onSubmitEditing={saveEdit} 
              autoFocus 
              editable={!isSavingEdit} 
            />
            <View style={styles.editButtons}>
              <TouchableOpacity 
                style={[styles.editButton, styles.editButtonCancel]} 
                onPress={() => setEditingItem(null)} 
                disabled={isSavingEdit}
              >
                <Text style={styles.editButtonTextCancel}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.editButton, 
                  styles.editButtonSave, 
                  (!editText.trim() || isSavingEdit) && styles.editButtonDisabled
                ]} 
                onPress={saveEdit} 
                disabled={!editText.trim() || isSavingEdit}
              >
                {isSavingEdit ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editButtonTextSave}>Zapisz</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// --- HOC withObservables (bez zmian) ---
const enhance = withObservables([], (): ObservableResult => { const u = ShoppingItem.observeUnchecked(database).pipe(startWith([])); const c = ShoppingItem.observeChecked(database).pipe(startWith([])); const i: Observable<Omit<ObservedProps, 'isLoading'>> = combineLatest([u,c]).pipe(map(([u,c])=>({uncheckedItems:u, checkedItems:c}))); const l: Observable<boolean> = combineLatest([u,c]).pipe(map(([u,c])=>u===undefined||c===undefined),startWith(true),distinctUntilChanged()); return {itemsData:i, isLoading:l}; });

// --- Komponent Kontenera (bez zmian) ---
const ShoppingListScreenContainer = () => { const E = enhance(({ itemsData, isLoading }: { itemsData: Omit<ObservedProps, 'isLoading'> | undefined, isLoading: boolean | undefined }) => { const u = itemsData?.uncheckedItems ?? []; const c = itemsData?.checkedItems ?? []; const l = isLoading ?? true; return ( <ShoppingListScreenComponent uncheckedItems={u} checkedItems={c} isLoading={l} /> ); }); return <E />; }

export default ShoppingListScreenContainer;

// --- Style (bez zmian) ---
const styles = StyleSheet.create({
    bgColor: { backgroundColor: '#f8f9fa' }, cardBgColor: { backgroundColor: '#ffffff' }, textColor: { color: '#2d3748' }, secondaryTextColor: { color: '#718096' }, placeholderColor: { color: '#a0aec0' }, borderColor: { borderColor: '#e2e8f0' }, accentColor: { color: '#5c7ba9' }, accentBgColor: { backgroundColor: '#5c7ba9' }, disabledColor: { color: '#cbd5e0' }, disabledBgColor: { backgroundColor: '#e2e8f0' }, dangerColor: { color: '#e53e3e' }, checkedColor: { color: '#a0aec0' }, uncheckedColor: { color: '#4a5568' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', },
    container: { flex: 1, backgroundColor: '#f8f9fa', },
    listContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 100, },
    itemContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, backgroundColor: '#ffffff', borderRadius: 6, marginBottom: 6, borderWidth: 1, borderColor: '#e2e8f0', },
    itemPressed: { backgroundColor: '#f8fafc' },
    itemContainerChecked: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', opacity: 0.8 },
    checkboxContainer: { paddingRight: 10, paddingVertical: 2, },
    itemContent: { flex: 1, marginRight: 6, },
    itemText: { fontSize: 15, color: '#2d3748', },
    itemTextChecked: { color: '#a0aec0', textDecorationLine: 'line-through', fontStyle: 'italic' },
    amountText: { fontWeight: '500', color: '#4a5568', fontSize: 15, },
    unitText: { color: '#718096', fontSize: 14, },
    nameText: { color: '#2d3748'},
    menuButton: { paddingHorizontal: 6, paddingVertical: 4 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, opacity: 1, },
    emptyText: { fontSize: 18, color: '#4a5568', fontWeight: '500', marginTop: 16, marginBottom: 8, textAlign: 'center', },
    emptySubText: { fontSize: 14, color: '#a0aec0', textAlign: 'center', },
    inputWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 16, },
    inputContainer: { flexDirection: 'row', alignItems: 'center', },
    inputIcon: {},
    input: { flex: 1, height: 44, backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 14, fontSize: 15, color: '#2d3748', },
    addButton: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#5c7ba9', justifyContent: 'center', alignItems: 'center', marginLeft: 8, },
    addButtonDisabled: { backgroundColor: '#cbd5e0', },
    checkedSection: { marginTop: 16, marginBottom: 0, borderTopWidth: 1, borderTopColor: '#e2e8f0', },
    checkedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4, },
    checkedHeaderLeft: { flexDirection: 'row', alignItems: 'center', },
    checkedHeaderText: { fontSize: 12, fontWeight: '600', color: '#718096', marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    clearButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, },
    clearButtonText: { fontSize: 12, color: '#718096', marginLeft: 3, fontWeight: '500', },
    checkedListContainer: { paddingTop: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20, },
    contextMenu: { backgroundColor: 'white', borderRadius: 6, paddingVertical: 4, minWidth: 160, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, },
    contextMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, },
    contextMenuItemDelete: {},
    contextMenuItemText: { fontSize: 15, marginLeft: 10, color: '#4a5568', },
    contextMenuItemTextDelete: { color: '#e53e3e', },
    editModal: { backgroundColor: 'white', borderRadius: 8, padding: 20, width: '90%', maxWidth: 380, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, },
    editModalTitle: { fontSize: 17, fontWeight: '600', color: '#2d3748', marginBottom: 16, textAlign: 'center', },
    editInput: { height: 46, backgroundColor: '#f8fafc', borderRadius: 6, paddingHorizontal: 14, fontSize: 15, color: '#2d3748', marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    editButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4, },
    editButton: { paddingVertical: 9, paddingHorizontal: 22, borderRadius: 6, alignItems: 'center', },
    editButtonCancel: { backgroundColor: '#e2e8f0', },
    editButtonSave: { backgroundColor: '#5c7ba9', },
    editButtonDisabled: { backgroundColor: '#cbd5e0', },
    editButtonTextSave: { fontSize: 15, fontWeight: '500', color: 'white' },
    editButtonTextCancel: { fontSize: 15, fontWeight: '500', color: '#4a5568' },
    headerButton: { marginRight: 16, padding: 4, },
    itemDragging: { opacity: 0.8, backgroundColor: '#e2e8f0', transform: [{ scale: 1.02 }], shadowColor: "#000", shadowOffset: { width: 0, height: 4, }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 6, },
});