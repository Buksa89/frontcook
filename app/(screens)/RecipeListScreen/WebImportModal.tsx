import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface WebImportModalProps {
  visible: boolean;
  onClose: () => void;
}

export const WebImportModal = ({ visible, onClose }: WebImportModalProps) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleImport = () => {
    if (!url.trim()) {
      setError('Wprowadź adres URL przepisu');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('Wprowadź poprawny adres URL');
      return;
    }

    // Clear error if validation passes
    setError('');
    
    // TODO: Implement recipe import from URL
    console.log('Import recipe from URL:', url);
    
    // Reset and close modal
    setUrl('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={onClose}
      >
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>Importuj z internetu</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Adres URL przepisu</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            value={url}
            onChangeText={(text) => {
              setUrl(text);
              if (error) setError('');
            }}
            placeholder="https://example.com/recipe"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity 
            style={styles.importButton}
            onPress={handleImport}
          >
            <MaterialIcons name="download" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Importuj</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#dc3545',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    marginTop: 4,
  },
  importButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginTop: 24,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 