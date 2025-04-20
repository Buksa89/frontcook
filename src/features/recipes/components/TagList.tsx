// src/features/recipes/components/TagList.tsx
import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View, Modal, TextInput, Alert } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../../database';
import Tag from '../../../database/models/Tag';
import { Observable } from 'rxjs';
import { AntDesign, Feather, MaterialIcons } from '@expo/vector-icons'; // Dodano MaterialIcons

interface TagListProps {
  tags: Tag[]; // Lista dostępnych tagów z HOC
  selectedTags: Tag[]; // Aktualnie wybrane tagi (stan z komponentu nadrzędnego)
  onSelectTag: (tag: Tag) => void; // Funkcja zwrotna do zaznaczania/odznaczania
}

// Komponent wewnętrzny wyświetlający listę
const TagListComponent: React.FC<TagListProps> = ({ tags, selectedTags, onSelectTag }) => {
  const [isAddTagModalVisible, setAddTagModalVisible] = useState(false);
  const [isTagMenuVisible, setTagMenuVisible] = useState(false);
  const [isEditTagModalVisible, setEditTagModalVisible] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [editTagText, setEditTagText] = useState('');
  const [selectedTagForMenu, setSelectedTagForMenu] = useState<Tag | null>(null);

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
      // Zakładamy, że userId jest pobierany wewnątrz createTag lub przekazywany
      // Tutaj uproszczenie - zakładamy, że createTag sobie poradzi
      // W pełnej implementacji trzeba by pobrać ID usera z AuthContext
      const newTag = await Tag.createTag(database, { userId: 'TODO-GET-USER-ID', name: newTagText }); // TODO: Get actual user ID
      onSelectTag(newTag); // Opcjonalnie zaznacz nowo dodany tag
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
       setSelectedTagForMenu(null); // Wyczyść też wybrany tag
   }

   const saveEdit = async () => {
       if (!selectedTagForMenu || !editTagText.trim()) return;
       try {
           await database.write(() => selectedTagForMenu.updateTag({ name: editTagText }));
           closeEditModal();
       } catch (error) {
           console.error('Błąd aktualizacji tagu:', error);
           Alert.alert('Błąd', 'Nie udało się zaktualizować tagu.');
       }
   };

   const confirmDeleteTag = () => {
       if (!selectedTagForMenu) return;
       const tagToDelete = selectedTagForMenu; // Zapisz referencję
       closeTagMenu(); // Zamknij menu przed alertem

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
       try {
           await database.write(() => tag.deleteTag()); // Użyj metody z modelu
           // Opcjonalnie: Pokaż toast o sukcesie
       } catch (error) {
           console.error('Błąd usuwania tagu:', error);
           Alert.alert('Błąd', 'Nie udało się usunąć tagu.');
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
                        <Text style={styles.modalButtonText}>Dodaj</Text>
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
                   <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeEditModal}>
                       <Text style={styles.modalButtonText}>Anuluj</Text>
                   </TouchableOpacity>
                   <TouchableOpacity style={[styles.modalButton, styles.saveButton, !editTagText.trim() && styles.disabledButton]} onPress={saveEdit} disabled={!editTagText.trim()}>
                       <Text style={styles.modalButtonText}>Zapisz</Text>
                   </TouchableOpacity>
               </View>
           </View>
         </TouchableOpacity>
      </Modal>

      {/* Menu Kontekstowe Tagu */}
      <Modal visible={isTagMenuVisible} transparent={true} animationType="fade" onRequestClose={closeTagMenu}>
           <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeTagMenu}>
               <View style={styles.contextMenu} onStartShouldSetResponder={() => true}>
                   <TouchableOpacity style={styles.contextMenuItem} onPress={startEdit}>
                       <Feather name="edit" size={18} color="#333" />
                       <Text style={styles.contextMenuItemText}>Edytuj</Text>
                   </TouchableOpacity>
                   <TouchableOpacity style={[styles.contextMenuItem, styles.contextMenuItemDelete]} onPress={confirmDeleteTag}>
                       <Feather name="trash-2" size={18} color="#ff4444" />
                       <Text style={[styles.contextMenuItemText, styles.contextMenuItemTextDelete]}>Usuń</Text>
                   </TouchableOpacity>
               </View>
           </TouchableOpacity>
      </Modal>

    </>
  );
};

// HOC do obserwowania tagów
const enhance = withObservables([], () => ({
  tags: Tag.observeAll(database) // Obserwuj wszystkie tagi (użytkownika i systemowe)
}));

export const EnhancedTagList = enhance(TagListComponent);

// --- Style ---
const styles = StyleSheet.create({
  tagsScroll: {
    flexGrow: 0, // Zapobiega rozciąganiu ScrollView w pionie
    flexShrink: 1, // Pozwala ScrollView się skurczyć
  },
  tagsContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center', // Wyśrodkuj elementy w pionie
  },
  tagButton: {
    paddingHorizontal: 14, // Więcej paddingu poziomego
    paddingVertical: 7,  // Trochę więcej paddingu pionowego
    borderRadius: 18,    // Bardziej zaokrąglone
    backgroundColor: '#e9ecef', // Jaśniejszy szary
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent', // Domyślnie przezroczysta ramka
  },
  tagButtonSelected: {
    backgroundColor: '#5c7ba9',
    borderColor: '#4a628a', // Ciemniejsza ramka dla wybranych
  },
  tagText: {
    fontSize: 14,
    color: '#495057', // Ciemniejszy szary tekst
    fontWeight: '500',
  },
  tagTextSelected: {
    color: '#fff',
  },
  addTagButtonPlaceholder: {
    width: 36, // Dopasuj do wysokości tagButton z paddingiem
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderStyle: 'dashed',
  },
   // Style dla modali
   modalOverlay: {
       flex: 1,
       backgroundColor: 'rgba(0, 0, 0, 0.4)',
       justifyContent: 'center',
       alignItems: 'center',
       padding: 20,
   },
   modalContent: {
       backgroundColor: 'white',
       borderRadius: 12,
       padding: 20,
       width: '100%',
       maxWidth: 400,
       elevation: 5,
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.1,
       shadowRadius: 4,
   },
   modalTitle: {
       fontSize: 18,
       fontWeight: '600',
       marginBottom: 16,
       textAlign: 'center',
       color: '#333',
   },
   modalInput: {
       borderWidth: 1,
       borderColor: '#ced4da',
       borderRadius: 8,
       padding: 12,
       fontSize: 16,
       marginBottom: 16,
       backgroundColor: '#f8f9fa',
   },
   modalButtons: {
       flexDirection: 'row',
       justifyContent: 'flex-end', // Przyciski po prawej
       gap: 10,
   },
   modalButton: {
       paddingVertical: 10,
       paddingHorizontal: 20,
       borderRadius: 8,
   },
   modalButtonText: {
       fontSize: 16,
       fontWeight: '500',
   },
   cancelButton: {
       backgroundColor: '#e9ecef',
   },
   saveButton: {
       backgroundColor: '#5c7ba9',
       color: '#fff'
   },
   disabledButton: {
        backgroundColor: '#adb5bd',
   },
    // Style dla menu kontekstowego
    contextMenu: {
       backgroundColor: 'white',
       borderRadius: 8,
       paddingVertical: 8,
       minWidth: 180, // Minimalna szerokość
       elevation: 5,
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.15,
       shadowRadius: 4,
   },
   contextMenuItem: {
       flexDirection: 'row',
       alignItems: 'center',
       paddingVertical: 12,
       paddingHorizontal: 16,
   },
   contextMenuItemDelete: {
       // Styl dla opcji usuwania
   },
   contextMenuItemText: {
       fontSize: 16,
       marginLeft: 12,
       color: '#333',
   },
   contextMenuItemTextDelete: {
       color: '#ff4444',
   },
});