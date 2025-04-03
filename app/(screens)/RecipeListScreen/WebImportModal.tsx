import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { MaterialIcons, AntDesign } from '@expo/vector-icons';
import { webImportRecipeApi } from '../../api';
import type { WebImportRecipeResponse } from '../../api/webImportRecipe';
import Toast, { showToast } from '../../components/Toast';
import * as Clipboard from 'expo-clipboard';

interface WebImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImportSuccess?: (taskId: string) => void;
}

export const WebImportModal = ({ visible, onClose, onImportSuccess }: WebImportModalProps) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  const extractDomain = (url: string): string => {
    try {
      // Remove protocol (http://, https://, etc)
      let domain = url.trim();
      
      // Extract the domain part
      if (domain.includes('://')) {
        domain = domain.split('://')[1];
      }
      
      // Get everything until the first slash
      if (domain.includes('/')) {
        domain = domain.split('/')[0];
      }
      
      return domain;
    } catch (error) {
      console.error('Error extracting domain:', error);
      return url; // Return original URL if extraction fails
    }
  };

  const getDisplayUrl = (url: string): string => {
    return extractDomain(url);
  };

  const handlePaste = async () => {
    try {
      setIsPasting(true);
      const clipboardContent = await Clipboard.getStringAsync();
      if (clipboardContent) {
        setUrl(clipboardContent);
      } else {
        showToast({
          type: 'warning',
          text1: 'Schowek pusty',
          text2: 'Nie znaleziono tekstu do wklejenia',
          visibilityTime: 2000,
          position: 'bottom'
        });
      }
    } catch (error) {
      console.error('Błąd podczas próby wklejania ze schowka:', error);
      showToast({
        type: 'error',
        text1: 'Błąd',
        text2: 'Nie udało się wkleić zawartości schowka',
        visibilityTime: 2000,
        position: 'bottom'
      });
    } finally {
      setIsPasting(false);
    }
  };

  const handleClearUrl = () => {
    setUrl('');
  };

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

          <View style={styles.inputContainer}>
            {url ? (
              <>
                <Text 
                  style={styles.urlText}
                  numberOfLines={1}
                >
                  {getDisplayUrl(url)}
                </Text>
                <TouchableOpacity 
                  style={styles.clearButton} 
                  onPress={handleClearUrl}
                  disabled={isLoading}
                >
                  <AntDesign name="close" size={16} color="#666" />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity 
                style={styles.pasteButtonLarge}
                onPress={handlePaste}
                disabled={isLoading || isPasting}
              >
                {isPasting ? (
                  <ActivityIndicator size="small" color="#5c7ba9" />
                ) : (
                  <>
                    <MaterialIcons name="content-paste" size={24} color="#5c7ba9" />
                    <Text style={styles.pasteButtonLargeText}>Wklej adres strony ze schowka</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.importButton, isLoading ? styles.importButtonDisabled : null, !url ? styles.importButtonDisabled : null]}
            onPress={handleImport}
            disabled={isLoading || !url}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="download" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Przetwórz przepis</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Pressable>
      <Toast />
    </Modal>
  );
};

// Add default export for Expo Router compatibility
export default WebImportModal;

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
  inputContainer: {
    height: 56,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  urlText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  pasteButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  pasteButtonLargeText: {
    color: '#5c7ba9',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  importButton: {
    backgroundColor: '#5c7ba9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
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