import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, Alert } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons, AntDesign, Feather } from '@expo/vector-icons';
import database from '../../../database';
import Tag from '../../../database/models/Tag';
import RecipeTag from '../../../database/models/RecipeTag';
import { Observable } from 'rxjs';

// Base component that receives tags as props
const TagManagementScreenComponent = ({ tags }: { tags: Tag[] }) => {
  const [newTagText, setNewTagText] = useState('');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editText, setEditText] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  const deleteTag = async (tag: Tag) => {
    try {
      await database.write(async () => {
        // First, get all related RecipeTags
        const recipeTags = await database
          .get<RecipeTag>('recipe_tags')
          .query(Q.where('tag_id', tag.id))
          .fetch();

        // Delete all related RecipeTags first
        await Promise.all(recipeTags.map(recipeTag => recipeTag.destroyPermanently()));

        // Then delete the tag itself
        await tag.destroyPermanently();
      });
      setMenuVisible(false);
    } catch (error) {
      console.error(`Error deleting tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      Alert.alert('Błąd', 'Nie udało się usunąć tagu');
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingTag(tag);
    setEditText(tag.name);
    setMenuVisible(false);
  };

  const saveEdit = async () => {
    if (!editingTag || !editText.trim()) return;

    try {
      // Create new tag with the same order as the edited one
      await Tag.createOrUpdate(database, {
        name: editText,
        order: editingTag.order
      }, true);

      // Delete the old tag
      await database.write(async () => {
        await editingTag.destroyPermanently();
      });

      setEditingTag(null);
      setEditText('');
    } catch (error) {
      console.error(`Error updating tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      Alert.alert('Błąd', 'Nie udało się zaktualizować tagu');
    }
  };

  const showTagMenu = (tag: Tag) => {
    setSelectedTag(tag);
    setMenuVisible(true);
  };

  const addNewTag = async () => {
    if (!newTagText.trim()) return;

    try {
      const maxOrder = tags.reduce((max, tag) => Math.max(max, tag.order), -1);

      await Tag.createOrUpdate(database, {
        name: newTagText,
        order: maxOrder + 1
      });

      setNewTagText('');
    } catch (error) {
      console.error(`Error adding tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      Alert.alert('Błąd', 'Nie udało się dodać tagu');
    }
  };

  const renderItem = ({ item }: { item: Tag }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onLongPress={() => showTagMenu(item)}
    >
      <View style={styles.itemContent}>
        <MaterialIcons name="local-offer" size={20} color="#2196F3" style={styles.tagIcon} />
        <Text style={styles.itemText}>{item.displayName}</Text>
      </View>
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => showTagMenu(item)}
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
      {(!tags || tags.length === 0) && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Brak tagów</Text>
          <Text style={styles.emptySubText}>Dodaj tagi, aby lepiej organizować przepisy</Text>
        </View>
      )}
      
      <FlatList
        data={tags}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newTagText}
          onChangeText={setNewTagText}
          placeholder="Nazwa nowego tagu"
          placeholderTextColor="#999"
          returnKeyType="done"
          onSubmitEditing={addNewTag}
        />
        <TouchableOpacity 
          style={[
            styles.addButton,
            !newTagText.trim() && styles.addButtonDisabled
          ]}
          onPress={addNewTag}
          disabled={!newTagText.trim()}
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
              onPress={() => selectedTag && startEdit(selectedTag)}
            >
              <Feather name="edit" size={20} color="#333" />
              <Text style={styles.menuItemText}>Edytuj</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDelete]}
              onPress={() => selectedTag && deleteTag(selectedTag)}
            >
              <Feather name="trash-2" size={20} color="#ff4444" />
              <Text style={[styles.menuItemText, styles.menuItemTextDelete]}>Usuń</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal edycji */}
      <Modal
        visible={!!editingTag}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditingTag(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.editModalTitle}>Edytuj tag</Text>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              placeholder="Nazwa tagu"
              placeholderTextColor="#999"
              returnKeyType="done"
              onSubmitEditing={saveEdit}
              autoFocus
            />
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.editButton, styles.editButtonCancel]}
                onPress={() => setEditingTag(null)}
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

// Create an observable factory that handles the async operation
const createTagsObservable = (): Observable<Tag[]> => {
  return new Observable(subscriber => {
    let subscription: any;
    
    Tag.observeAll(database)
      .then(observable => {
        subscription = observable.subscribe(tags => subscriber.next(tags))
      })
      .catch(error => {
        console.error('Error observing tags:', error)
        subscriber.next([])
      })

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  })
}

// Enhance component with tags data
const enhance = withObservables([], () => ({
  tags: createTagsObservable()
}));

export default enhance(TagManagementScreenComponent);

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
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagIcon: {
    marginRight: 12,
  },
  itemText: {
    fontSize: 16,
    color: '#333',
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
}); 