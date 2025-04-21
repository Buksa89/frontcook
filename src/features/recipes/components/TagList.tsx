// src/features/recipes/components/TagList.tsx
import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View, Modal, TextInput, Alert, ActivityIndicator } from 'react-native'; // Dodano ActivityIndicator
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../../database'; // Usunięto - nie potrzebujemy tu bezpośrednio
import Tag from '../../../database/models/Tag';
import { Observable } from 'rxjs';
import { AntDesign, Feather, MaterialIcons } from '@expo/vector-icons';

interface TagListProps {
  tags: Tag[];
  selectedTags: Tag[];
  onSelectTag: (tag: Tag) => void;
}

// Komponent wewnętrzny wyświetlający listę
const TagListComponent: React.FC<TagListProps> = ({ tags, selectedTags, onSelectTag }) => {
  const [isAddTagModalVisible, setAddTagModalVisible] = useState(false);
  const [isTagMenuVisible, setTagMenuVisible] = useState(false);
  const [isEditTagModalVisible, setEditTagModalVisible] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [editTagText, setEditTagText] = useState('');
  const [selectedTagForMenu, setSelectedTagForMenu] = useState<Tag | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false); // Stan zapisu edycji
  const [isDeletingTag, setIsDeletingTag] = useState(false); // Stan usuwania tagu

  const openAddTagModal = () => {
    setNewTagText('');
    setAddTagModalVisible(true);
  };

  const closeAddTagModal = () => {
    setAddTagModalVisible(false);
  };

  const handleAddNewTag = async () => {
    if (!newTagText.trim()) return;
    try {
      // TODO: Pobierz aktualne userId z AuthContext lub authUserIdProvider
      const userId = await (async () => { try { const id = await import('../../../services/auth/authUserIdProvider').then(m => m.getCurrentUserId()); return id; } catch { return null; } })();
      const newTag = await Tag.createTag(database, { userId: userId, name: newTagText });
      onSelectTag(newTag);
      closeAddTagModal();
    } catch (error) {
      console.error('Błąd dodawania tagu:', error);
      Alert.alert('Błąd', 'Nie udało się dodać tagu.');
    }
  };

   const showTagMenu = (tag: Tag) => {
     setSelectedTagForMenu(tag);
     setTagMenuVisible(true);
   };

   const closeTagMenu = () => {
       setTagMenuVisible(false);
       setSelectedTagForMenu(null);
   }

   const startEdit = () => {
       if (!selectedTagForMenu) return;
       setEditTagText(selectedTagForMenu.name);
       setTagMenuVisible(false); // Zamknij menu
       setEditTagModalVisible(true); // Otwórz modal edycji
   };

   const closeEditModal = () => {
       setEditTagModalVisible(false);
       setEditTagText('');
       setSelectedTagForMenu(null);
   }

   const saveEdit = async () => {
       if (!selectedTagForMenu || !editTagText.trim() || isSavingEdit) return;
       setIsSavingEdit(true); // Ustaw stan zapisu
       try {
           // --- ZMIANA: Bezpośrednie wywołanie metody @writer ---
           await selectedTagForMenu.updateTag({ name: editTagText });
           // --- KONIEC ZMIANY ---
           closeEditModal();
       } catch (error) {
           console.error('Błąd aktualizacji tagu:', error);
           Alert.alert('Błąd', 'Nie udało się zaktualizować tagu.');
       } finally {
           setIsSavingEdit(false); // Zresetuj stan zapisu
       }
   };

   const confirmDeleteTag = () => {
       if (!selectedTagForMenu || isDeletingTag) return;
       const tagToDelete = selectedTagForMenu;
       closeTagMenu();

       Alert.alert(
           'Usuń tag',
           `Czy na pewno chcesz usunąć tag "${tagToDelete.name}"? Spowoduje to również usunięcie go ze wszystkich powiązanych przepisów.`,
           [
               { text: 'Anuluj', style: 'cancel' },
               { text: 'Usuń', style: 'destructive', onPress: () => deleteTag(tagToDelete) }
           ]
       );
   };

   const deleteTag = async (tag: Tag) => {
       if (isDeletingTag) return;
       setIsDeletingTag(true); // Ustaw stan usuwania
       try {
           // --- ZMIANA: Bezpośrednie wywołanie metody @writer ---
           await tag.deleteTag();
           // --- KONIEC ZMIANY ---
           // Opcjonalnie: Pokaż toast o sukcesie
       } catch (error) {
           console.error('Błąd usuwania tagu:', error);
           Alert.alert('Błąd', 'Nie udało się usunąć tagu.');
       } finally {
           setIsDeletingTag(false); // Zresetuj stan usuwania
           // Stan selectedTagForMenu jest czyszczony w closeTagMenu, które jest wywoływane przed confirmDeleteTag
       }
   };


  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tagsScroll}
        contentContainerStyle={styles.tagsContainer}
      >
        {tags.map(tag => {
          const isSelected = selectedTags.some(t => t.id === tag.id);
          return (
            <TouchableOpacity
              key={tag.id}
              style={[styles.tagButton, isSelected && styles.tagButtonSelected]}
              onPress={() => onSelectTag(tag)}
              onLongPress={() => showTagMenu(tag)}
              delayLongPress={400}
            >
              <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                {tag.name}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.addTagButtonPlaceholder} onPress={openAddTagModal}>
          <AntDesign name="plus" size={14} color="#666" />
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Dodawania Tagu */}
      <Modal visible={isAddTagModalVisible} transparent={true} animationType="fade" onRequestClose={closeAddTagModal}>
         <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeAddTagModal}>
             <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                 <Text style={styles.modalTitle}>Dodaj Nowy Tag</Text>
                 <TextInput
                     style={styles.modalInput}
                     placeholder="Nazwa tagu"
                     value={newTagText}
                     onChangeText={setNewTagText}
                     autoFocus
                     onSubmitEditing={handleAddNewTag}
                 />
                 <View style={styles.modalButtons}>
                     <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeAddTagModal}>
                         <Text style={styles.modalButtonText}>Anuluj</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={[styles.modalButton, styles.saveButton, !newTagText.trim() && styles.disabledButton]} onPress={handleAddNewTag} disabled={!newTagText.trim()}>
                         <Text style={styles.modalButtonTextWhite}>Dodaj</Text>
                     </TouchableOpacity>
                 </View>
             </View>
         </TouchableOpacity>
      </Modal>

      {/* Modal Edycji Tagu */}
      <Modal visible={isEditTagModalVisible} transparent={true} animationType="fade" onRequestClose={closeEditModal}>
         <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeEditModal}>
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
               <Text style={styles.modalTitle}>Edytuj Tag</Text>
               <TextInput
                   style={styles.modalInput}
                   placeholder="Nowa nazwa tagu"
                   value={editTagText}
                   onChangeText={setEditTagText}
                   autoFocus
                   onSubmitEditing={saveEdit}
               />
               <View style={styles.modalButtons}>
                   <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeEditModal} disabled={isSavingEdit}>
                       <Text style={styles.modalButtonText}>Anuluj</Text>
                   </TouchableOpacity>
                   <TouchableOpacity style={[styles.modalButton, styles.saveButton, (!editTagText.trim() || isSavingEdit) && styles.disabledButton]} onPress={saveEdit} disabled={!editTagText.trim() || isSavingEdit}>
                      {isSavingEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalButtonTextWhite}>Zapisz</Text>}
                   </TouchableOpacity>
               </View>
           </View>
         </TouchableOpacity>
      </Modal>

      {/* Menu Kontekstowe Tagu */}
      <Modal visible={isTagMenuVisible} transparent={true} animationType="fade" onRequestClose={closeTagMenu}>
           <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeTagMenu}>
               <View style={styles.contextMenu} onStartShouldSetResponder={() => true}>
                   <TouchableOpacity style={styles.contextMenuItem} onPress={startEdit} disabled={isDeletingTag}>
                       <Feather name="edit" size={18} color="#333" />
                       <Text style={styles.contextMenuItemText}>Edytuj</Text>
                   </TouchableOpacity>
                   <TouchableOpacity style={[styles.contextMenuItem, styles.contextMenuItemDelete]} onPress={confirmDeleteTag} disabled={isDeletingTag}>
                       {isDeletingTag ? <ActivityIndicator size="small" color="#ff4444" style={styles.contextMenuIconSpacing}/> : <Feather name="trash-2" size={18} color="#ff4444" />}
                       <Text style={[styles.contextMenuItemText, styles.contextMenuItemTextDelete]}>Usuń</Text>
                   </TouchableOpacity>
               </View>
           </TouchableOpacity>
      </Modal>

    </>
  );
};

// HOC bez zmian
const enhance = withObservables([], () => ({
  // TODO: Przekazać aktualne userId do observeAll
  tags: Tag.observeAll(database, null) // Na razie null, trzeba podłączyć userId
}));

export const EnhancedTagList = enhance(TagListComponent);

// --- Style - dodano styl contextMenuIconSpacing ---
const styles = StyleSheet.create({
    tagsScroll: { flexGrow: 0, flexShrink: 1, },
    tagsContainer: { paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center', },
    tagButton: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: '#e9ecef', marginRight: 8, borderWidth: 1, borderColor: 'transparent', },
    tagButtonSelected: { backgroundColor: '#5c7ba9', borderColor: '#4a628a', },
    tagText: { fontSize: 14, color: '#495057', fontWeight: '500', },
    tagTextSelected: { color: '#fff', },
    addTagButtonPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f8f9fa', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#dee2e6', borderStyle: 'dashed', },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 20, },
    modalContent: { backgroundColor: 'white', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, },
    modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, textAlign: 'center', color: '#333', },
    modalInput: { borderWidth: 1, borderColor: '#ced4da', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, backgroundColor: '#f8f9fa', },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, },
    modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center', alignItems: 'center', minWidth: 80 }, // Dodano minWidth
    modalButtonText: { fontSize: 16, fontWeight: '500', },
    modalButtonTextWhite: { fontSize: 16, fontWeight: '500', color: '#fff' },
    cancelButton: { backgroundColor: '#e9ecef', },
    saveButton: { backgroundColor: '#5c7ba9', },
    disabledButton: { backgroundColor: '#adb5bd', opacity: 0.7 }, // Dodano opacity
    contextMenu: { backgroundColor: 'white', borderRadius: 8, paddingVertical: 8, minWidth: 180, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, },
    contextMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, },
    contextMenuItemDelete: { },
    contextMenuItemText: { fontSize: 16, marginLeft: 12, color: '#333', },
    contextMenuItemTextDelete: { color: '#ff4444', },
    contextMenuIconSpacing: { marginRight: 0 }, // Styl dla ActivityIndicator w miejscu ikony
});