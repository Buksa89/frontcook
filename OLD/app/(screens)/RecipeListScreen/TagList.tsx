import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View, Modal, TextInput, Alert } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '../../../database';
import Tag from '../../../database/models/Tag';
import { Observable, from } from 'rxjs';
import { router } from 'expo-router';
import { AntDesign, Feather } from '@expo/vector-icons';

interface TagListProps {
  tags: Tag[];
  selectedTags: Tag[];
  onSelectTag: (tag: Tag) => void;
}

// Base component that receives tags as a prop
export const TagList = ({ tags, selectedTags, onSelectTag }: TagListProps) => {
  const [isAddTagModalVisible, setAddTagModalVisible] = useState(false);
  const [isTagMenuVisible, setTagMenuVisible] = useState(false);
  const [isEditTagModalVisible, setEditTagModalVisible] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [editTagText, setEditTagText] = useState('');
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  const addNewTag = async () => {
    if (!newTagText.trim()) return;

    try {
      await Tag.create(database, newTagText);
      setNewTagText('');
      setAddTagModalVisible(false);
    } catch (error) {
      console.error(`Error adding tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      Alert.alert('Błąd', 'Nie udało się dodać tagu');
    }
  };

  const showTagMenu = (tag: Tag) => {
    setSelectedTag(tag);
    setTagMenuVisible(true);
  };

  const startEdit = (tag: Tag) => {
    setSelectedTag(tag);
    setEditTagText(tag.name);
    setTagMenuVisible(false);
    setEditTagModalVisible(true);
  };

  const saveEdit = async () => {
    if (!selectedTag || !editTagText.trim()) return;

    try {
      await selectedTag.update(record => {
        record.name = editTagText.trim();
      });
      
      setEditTagModalVisible(false);
      setEditTagText('');
      setSelectedTag(null);
    } catch (error) {
      console.error(`Error updating tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      Alert.alert('Błąd', 'Nie udało się zaktualizować tagu');
    }
  };

  const deleteTag = async (tag: Tag) => {
    try {
      await tag.markAsDeleted();
      setTagMenuVisible(false);
      setSelectedTag(null);
    } catch (error) {
      console.error(`Error deleting tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      Alert.alert('Błąd', 'Nie udało się usunąć tagu');
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
        {tags.map(tag => (
          <TouchableOpacity
            key={tag.id}
            style={[
              styles.tagButton,
              selectedTags.some(t => t.id === tag.id) && styles.tagButtonSelected
            ]}
            onPress={() => onSelectTag(tag)}
            onLongPress={() => showTagMenu(tag)}
            delayLongPress={500}
          >
            <Text style={[
              styles.tagText,
              selectedTags.some(t => t.id === tag.id) && styles.tagTextSelected
            ]}>
              {tag.name}
            </Text>
          </TouchableOpacity>
        ))}
        
        {/* Przycisk dodawania nowego tagu */}
        <TouchableOpacity
          style={styles.addTagButton}
          onPress={() => setAddTagModalVisible(true)}
        >
          <AntDesign name="plus" size={14} color="#666" />
        </TouchableOpacity>
      </ScrollView>

      {/* Modal dodawania nowego tagu */}
      <Modal
        visible={isAddTagModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAddTagModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addTagModal}>
            <Text style={styles.addTagModalTitle}>Dodaj nowy tag</Text>
            <TextInput
              style={styles.addTagInput}
              value={newTagText}
              onChangeText={setNewTagText}
              placeholder="Nazwa tagu"
              placeholderTextColor="#999"
              returnKeyType="done"
              onSubmitEditing={addNewTag}
              autoFocus
            />
            <View style={styles.addTagButtons}>
              <TouchableOpacity
                style={[styles.addTagButton, styles.cancelButton]}
                onPress={() => {
                  setAddTagModalVisible(false);
                  setNewTagText('');
                }}
              >
                <Text style={styles.buttonText}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.addTagButton,
                  styles.saveButton,
                  !newTagText.trim() && styles.buttonDisabled
                ]}
                onPress={addNewTag}
                disabled={!newTagText.trim()}
              >
                <Text style={styles.buttonText}>Dodaj</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Menu kontekstowe dla tagu */}
      <Modal
        visible={isTagMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTagMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTagMenuVisible(false)}
        >
          <View style={styles.tagMenuModal}>
            <TouchableOpacity
              style={styles.tagMenuItem}
              onPress={() => selectedTag && startEdit(selectedTag)}
            >
              <Feather name="edit" size={18} color="#333" />
              <Text style={styles.tagMenuItemText}>Edytuj</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tagMenuItem, styles.tagMenuItemDelete]}
              onPress={() => selectedTag && deleteTag(selectedTag)}
            >
              <Feather name="trash-2" size={18} color="#ff4444" />
              <Text style={[styles.tagMenuItemText, styles.tagMenuItemTextDelete]}>Usuń</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal edycji tagu */}
      <Modal
        visible={isEditTagModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditTagModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addTagModal}>
            <Text style={styles.addTagModalTitle}>Edytuj tag</Text>
            <TextInput
              style={styles.addTagInput}
              value={editTagText}
              onChangeText={setEditTagText}
              placeholder="Nazwa tagu"
              placeholderTextColor="#999"
              returnKeyType="done"
              onSubmitEditing={saveEdit}
              autoFocus
            />
            <View style={styles.addTagButtons}>
              <TouchableOpacity
                style={[styles.addTagButton, styles.cancelButton]}
                onPress={() => {
                  setEditTagModalVisible(false);
                  setEditTagText('');
                }}
              >
                <Text style={styles.buttonText}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.addTagButton,
                  styles.saveButton,
                  !editTagText.trim() && styles.buttonDisabled
                ]}
                onPress={saveEdit}
                disabled={!editTagText.trim()}
              >
                <Text style={styles.buttonText}>Zapisz</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

// Enhance the TagList component to observe tags from the database
const enhance = withObservables<{ selectedTags: Tag[]; onSelectTag: (tag: Tag) => void }, { tags: Observable<Tag[]> }>([], () => ({
  tags: Tag.observeAll(database)
}));

export const EnhancedTagList = enhance(TagList);

// Add default export for Expo Router compatibility
export default EnhancedTagList;

const styles = StyleSheet.create({
  tagsScroll: {
    flex: 1,
    marginRight: 4,
  },
  tagsContainer: {
    paddingLeft: 16,
    paddingRight: 8,
    gap: 8,
    flexDirection: 'row',
  },
  tagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  tagButtonSelected: {
    backgroundColor: '#5c7ba9',
  },
  tagText: {
    fontSize: 14,
    color: '#666',
  },
  tagTextSelected: {
    color: '#fff',
  },
  addTagButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTagModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxWidth: 400,
  },
  addTagModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  addTagInput: {
    height: 48,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  addTagButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    height: 'auto',
    width: 'auto',
    borderWidth: 0,
  },
  saveButton: {
    backgroundColor: '#5c7ba9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    height: 'auto',
    width: 'auto',
    borderWidth: 0,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  tagMenuModal: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    minWidth: 200,
  },
  tagMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 4,
  },
  tagMenuItemDelete: {
    marginTop: 4,
  },
  tagMenuItemText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#333',
  },
  tagMenuItemTextDelete: {
    color: '#ff4444',
  },
}); 