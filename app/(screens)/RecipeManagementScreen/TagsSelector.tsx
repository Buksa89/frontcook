import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Tag from '../../../database/models/Tag';

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
  const [showTagsModal, setShowTagsModal] = useState(false);

  const handleTagSelect = (tag: Tag) => {
    const isSelected = selectedTags.some(t => t.id === tag.id);
    if (isSelected) {
      onTagsChange(selectedTags.filter(t => t.id !== tag.id));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          style={styles.tagsButton}
          onPress={() => setShowTagsModal(true)}
        >
          <View style={styles.selectedTags}>
            {selectedTags.length > 0 ? (
              selectedTags.map(tag => (
                <View key={tag.id} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag.name}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.tagsPlaceholder}>Wybierz tagi</Text>
            )}
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showTagsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTagsModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowTagsModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Wybierz tagi</Text>
              <TouchableOpacity onPress={() => setShowTagsModal(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.tagsList}>
              {availableTags.map(tag => {
                const isSelected = selectedTags.some(t => t.id === tag.id);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.tagItem,
                      isSelected && styles.tagItemSelected
                    ]}
                    onPress={() => handleTagSelect(tag)}
                  >
                    <Text style={[
                      styles.tagItemText,
                      isSelected && styles.tagItemTextSelected
                    ]}>
                      {tag.name}
                    </Text>
                    {isSelected && (
                      <MaterialIcons name="check" size={20} color="#2196F3" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
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
  tagsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  selectedTags: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagChipText: {
    color: '#2196F3',
    fontSize: 14,
  },
  tagsPlaceholder: {
    color: '#999',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  tagsList: {
    padding: 16,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tagItemSelected: {
    backgroundColor: '#f5f5f5',
  },
  tagItemText: {
    fontSize: 16,
    color: '#333',
  },
  tagItemTextSelected: {
    color: '#2196F3',
    fontWeight: '500',
  },
}); 