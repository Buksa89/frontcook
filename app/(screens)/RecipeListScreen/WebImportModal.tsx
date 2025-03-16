import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { webImportRecipeApi } from '../../api';
import type { WebImportRecipeResponse } from '../../api/webImportRecipe';

interface WebImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImportSuccess?: (taskId: string) => void;
}

export const WebImportModal = ({ visible, onClose, onImportSuccess }: WebImportModalProps) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleImport = async () => {
    // Reset states
    setError('');
    setSuccessMessage('');
    
    // Validate URL
    if (!url.trim()) {
      setError('Wpisz adres strony z przepisem');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('Ten adres nie wygląda na poprawny. Upewnij się, że zaczyna się od http:// lub https://');
      return;
    }

    // Start loading
    setIsLoading(true);
    
    try {
      // Call API to import recipe from URL using the dedicated API module
      const response = await webImportRecipeApi.importFromUrl(url.trim());
      
      // Handle success
      setSuccessMessage('Super! Zaczęliśmy pobierać przepis. Damy Ci znać, gdy będzie gotowy!');
      
      // Call success callback if provided
      if (onImportSuccess && response.task_id) {
        onImportSuccess(response.task_id);
      }
      
      // Reset form and close modal after a delay
      setTimeout(() => {
        setUrl('');
        setSuccessMessage('');
        onClose();
      }, 2000);
      
    } catch (err: any) {
      // Handle API error
      if (err.status === 401) {
        setError('Hej, musisz się najpierw zalogować, żeby dodać przepis');
      } else if (err.data && err.data.error) {
        setError(err.data.error);
      } else if (err.status === 404) {
        setError('Ups! Nie możemy znaleźć tej strony. Sprawdź, czy adres jest poprawny.');
      } else {
        setError('Coś poszło nie tak. Może spróbuj ponownie za chwilę?');
      }
      console.error('Import recipe error:', err);
    } finally {
      setIsLoading(false);
    }
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
            <TouchableOpacity onPress={onClose} disabled={isLoading}>
              <MaterialIcons name="close" size={24} color={isLoading ? "#ccc" : "#666"} />
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
            editable={!isLoading}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

          <TouchableOpacity 
            style={[styles.importButton, isLoading ? styles.importButtonDisabled : null]}
            onPress={handleImport}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="download" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Importuj</Text>
              </>
            )}
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
  successText: {
    color: '#28a745',
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
    minHeight: 48,
  },
  importButtonDisabled: {
    backgroundColor: '#a0d0f7',
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