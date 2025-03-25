import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { MaterialIcons, AntDesign, Feather } from '@expo/vector-icons';
import Tag from '../../../database/models/Tag';
import database from '../../../database';

interface TagsSelectorProps {
  label: string;
  availableTags: Tag[];
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
}

export const TagsSelector = ({
  label,
  availableTags,
  selectedTags,
  onTagsChange,
}: TagsSelectorProps) => {
  const [isAddTagModalVisible, setAddTagModalVisible] = useState(false);
  const [isTagMenuVisible, setTagMenuVisible] = useState(false);
  const [isEditTagModalVisible, setEditTagModalVisible] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [editTagText, setEditTagText] = useState('');
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  const handleTagSelect = (tag: Tag) => {
    const isSelected = selectedTags.some(t => t.id === tag.id);
    if (isSelected) {
      onTagsChange(selectedTags.filter(t => t.id !== tag.id));
    } else {
      onTagsChange([...selectedTags, tag]);
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
      // Usuń tag z wybranych tagów
      if (selectedTags.some(t => t.id === tag.id)) {
        onTagsChange(selectedTags.filter(t => t.id !== tag.id));
      }
    } catch (error) {
      console.error(`Error deleting tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      Alert.alert('Błąd', 'Nie udało się usunąć tagu');
    }
  };

  const addNewTag = async () => {
    if (!newTagText.trim()) return;

    try {
      const newTag = await Tag.createTag(database, newTagText);
      setNewTagText('');
      setAddTagModalVisible(false);
      // Automatycznie dodaj nowy tag do wybranych
      onTagsChange([...selectedTags, newTag]);
    } catch (error) {
      console.error(`Error adding tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
      Alert.alert('Błąd', 'Nie udało się dodać tagu');
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      
      <View style={styles.tagsContainer}>
        <View style={styles.tagsContent}>
          {availableTags.map(tag => {
            const isSelected = selectedTags.some(t => t.id === tag.id);
            return (
              <TouchableOpacity
                key={tag.id}
                style={[
                  styles.tagChip,
                  isSelected && styles.tagChipSelected
                ]}
                onPress={() => handleTagSelect(tag)}
                onLongPress={() => showTagMenu(tag)} 
                delayLongPress={500}
              >
                <Text style={[
                  styles.tagChipText,
                  isSelected && styles.tagChipTextSelected
                ]}>
                  {tag.name}
                </Text>
                {isSelected && (
                  <MaterialIcons name="check" size={16} color="#fff" style={styles.checkIcon} />
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.addTagButton}
            onPress={() => setAddTagModalVisible(true)}
          >
            <AntDesign name="plus" size={14} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Modal dodawania nowego tagu */}
      <Modal
        visible={isAddTagModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAddTagModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Dodaj nowy tag</Text>
            <TextInput
              style={styles.input}
              value={newTagText}
              onChangeText={setNewTagText}
              placeholder="Nazwa tagu"
              placeholderTextColor="#999"
              returnKeyType="done"
              onSubmitEditing={addNewTag}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setAddTagModalVisible(false);
                  setNewTagText('');
                }}
              >
                <Text style={styles.buttonText}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
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
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edytuj tag</Text>
            <TextInput
              style={styles.input}
              value={editTagText}
              onChangeText={setEditTagText}
              placeholder="Nazwa tagu"
              placeholderTextColor="#999"
              returnKeyType="done"
              onSubmitEditing={saveEdit}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setEditTagModalVisible(false);
                  setEditTagText('');
                }}
              >
                <Text style={styles.buttonText}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
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
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  tagsContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
  },
  tagsContent: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  tagChip: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagChipSelected: {
    backgroundColor: '#5c7ba9',
  },
  tagChipText: {
    color: '#666',
    fontSize: 14,
  },
  tagChipTextSelected: {
    color: '#fff',
  },
  checkIcon: {
    marginLeft: 4,
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
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  input: {
    height: 48,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  saveButton: {
    backgroundColor: '#5c7ba9',
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