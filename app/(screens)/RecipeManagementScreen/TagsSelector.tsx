import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet, FlatList } from 'react-native';
import { MaterialIcons, AntDesign } from '@expo/vector-icons';
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
        
        {/* Przycisk otwierający modal z wyborem tagów */}
        <TouchableOpacity
          style={styles.tagsButton}
          onPress={() => setShowTagsModal(true)}
        >
          <View style={styles.selectedTags}>
            {selectedTags.length > 0 ? (
              <View style={styles.tagsChipsContainer}>
                {selectedTags.map(tag => (
                  <View key={tag.id} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{tag.name}</Text>
                  </View>
                ))}
              </View>
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
        animationType="slide"
        onRequestClose={() => setShowTagsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Wybierz tagi</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowTagsModal(false)}
              >
                <AntDesign name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={availableTags}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedTags.some(t => t.id === item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.tagItem,
                      isSelected && styles.tagItemSelected
                    ]}
                    onPress={() => handleTagSelect(item)}
                  >
                    <Text style={[
                      styles.tagItemText,
                      isSelected && styles.tagItemTextSelected
                    ]}>
                      {item.name}
                    </Text>
                    {isSelected ? (
                      <MaterialIcons name="check" size={20} color="#2196F3" />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.tagsList}
            />
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.doneButton}
                onPress={() => setShowTagsModal(false)}
              >
                <Text style={styles.doneButtonText}>Gotowe</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  },
  tagsChipsContainer: {
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
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    minHeight: '50%',
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
  closeButton: {
    padding: 4,
  },
  tagsList: {
    padding: 8,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
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
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  doneButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 