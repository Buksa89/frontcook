import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { webImportRecipeApi } from '../../api';
import type { WebImportRecipeResponse } from '../../api/webImportRecipe';
import Toast, { showToast } from '../../components/Toast';

interface WebImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImportSuccess?: (taskId: string) => void;
}

export const WebImportModal = ({ visible, onClose, onImportSuccess }: WebImportModalProps) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleImport = async () => {
    // Validate URL
    if (!url.trim()) {
      showToast({
        type: 'warning',
        text1: 'Brak adresu URL',
        text2: 'Wpisz adres strony z przepisem',
        visibilityTime: 2000,
        position: 'bottom'
      });
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showToast({
        type: 'warning',
        text1: 'Niepoprawny adres',
        text2: 'Ten adres nie wygląda na poprawny. Upewnij się, że zaczyna się od http:// lub https://',
        visibilityTime: 2000,
        position: 'bottom'
      });
      return;
    }

    // Start loading
    setIsLoading(true);
    
    try {
      // Call API to import recipe from URL using the dedicated API module
      const response = await webImportRecipeApi.importFromUrl(url.trim());
      
      // Show success toast
      showToast({
        type: 'success',
        text1: 'Sukces!',
        text2: 'Zaczęliśmy pobierać przepis. Damy Ci znać, gdy będzie gotowy! W tym czasie możesz dodać kolejny.',
        visibilityTime: 4000,
        position: 'bottom'
      });
      
      // Call success callback if provided
      if (onImportSuccess && response.task_id) {
        onImportSuccess(response.task_id);
      }
      
      // Reset form but don't close modal (allow adding more)
      setUrl('');
      
    } catch (err: any) {
      // Handle API error
      let errorMessage = 'Coś poszło nie tak. Może spróbuj ponownie za chwilę?';
      
      if (err.status === 401) {
        errorMessage = 'Hej, musisz się najpierw zalogować, żeby dodać przepis';
      } else if (err.data && err.data.error) {
        errorMessage = err.data.error;
      } else if (err.status === 404) {
        errorMessage = 'Ups! Nie możemy znaleźć tej strony. Sprawdź, czy adres jest poprawny.';
      } 
      
      // Show error toast
      showToast({
        type: 'error',
        text1: 'Wystąpił błąd',
        text2: errorMessage,
        visibilityTime: 4000,
        position: 'bottom'
      });
      
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
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://example.com/recipe"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!isLoading}
          />

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
      <Toast />
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
  importButton: {
    backgroundColor: '#5c7ba9',
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