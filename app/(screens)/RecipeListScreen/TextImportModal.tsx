import React, { useState, useRef } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Pressable, ActivityIndicator, ScrollView, Keyboard } from 'react-native';
import { MaterialIcons, AntDesign, Feather } from '@expo/vector-icons';
import { textImportRecipeApi } from '../../api';
import type { TextImportRecipeResponse } from '../../api/textImportRecipe';
import Toast, { showToast } from '../../components/Toast';
import * as Clipboard from 'expo-clipboard';

interface TextImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImportSuccess?: (taskId: string) => void;
}

export const TextImportModal = ({ visible, onClose, onImportSuccess }: TextImportModalProps) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  const handlePaste = async () => {
    try {
      setIsPasting(true);
      const clipboardContent = await Clipboard.getStringAsync();
      if (clipboardContent) {
        setText(clipboardContent);
        setEditMode(true);
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

  const handleClearText = () => {
    setText('');
    setEditMode(false);
  };

  const handleStartTyping = () => {
    setEditMode(true);
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }, 100);
  };

  const handleImport = async () => {
    // Dismiss keyboard if open
    Keyboard.dismiss();
    
    // Validate text
    if (!text.trim()) {
      showToast({
        type: 'warning',
        text1: 'Brak tekstu',
        text2: 'Wpisz lub wklej tekst przepisu',
        visibilityTime: 2000,
        position: 'bottom'
      });
      return;
    }

    // Start loading
    setIsLoading(true);
    
    try {
      // Call API to import recipe from text using the dedicated API module
      const response = await textImportRecipeApi.importFromText(text.trim());
      
      // Show success toast
      showToast({
        type: 'success',
        text1: 'Sukces!',
        text2: 'Zaczęliśmy przetwarzać przepis. Damy Ci znać, gdy będzie gotowy! W tym czasie możesz dodać kolejny.',
        visibilityTime: 4000,
        position: 'bottom'
      });
      
      // Call success callback if provided
      if (onImportSuccess && response.task_id) {
        onImportSuccess(response.task_id);
      }
      
      // Reset form but don't close modal (allow adding more)
      setText('');
      setEditMode(false);
      
    } catch (err: any) {
      // Handle API error
      let errorMessage = 'Coś poszło nie tak. Może spróbuj ponownie za chwilę?';
      
      if (err.status === 401) {
        errorMessage = 'Hej, musisz się najpierw zalogować, żeby dodać przepis';
      } else if (err.data && err.data.error) {
        errorMessage = err.data.error;
      }
      
      // Show error toast
      showToast({
        type: 'error',
        text1: 'Wystąpił błąd',
        text2: errorMessage,
        visibilityTime: 4000,
        position: 'bottom'
      });
      
      console.error('Import recipe from text error:', err);
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
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      >
        <View 
          style={styles.modalContent} 
          onStartShouldSetResponder={() => {
            Keyboard.dismiss();
            return true;
          }}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Importuj z tekstu</Text>
            <TouchableOpacity onPress={onClose} disabled={isLoading}>
              <MaterialIcons name="close" size={24} color={isLoading ? "#ccc" : "#666"} />
            </TouchableOpacity>
          </View>

          <View style={styles.textAreaContainer}>
            {editMode ? (
              <View style={styles.textInputWrapper}>
                <TextInput
                  ref={textInputRef}
                  style={styles.textInput}
                  multiline={true}
                  placeholder="Wpisz lub wklej tekst przepisu..."
                  value={text}
                  onChangeText={setText}
                  editable={!isLoading}
                />
                <TouchableOpacity 
                  style={styles.clearButton} 
                  onPress={handleClearText}
                  disabled={isLoading}
                >
                  <AntDesign name="close" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyStateContainer}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={handlePaste}
                  disabled={isLoading || isPasting}
                >
                  {isPasting ? (
                    <ActivityIndicator size="small" color="#5c7ba9" />
                  ) : (
                    <>
                      <MaterialIcons name="content-paste" size={24} color="#5c7ba9" />
                      <Text style={styles.actionButtonText}>Wklej ze schowka</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                <View style={styles.orDivider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.orText}>lub</Text>
                  <View style={styles.dividerLine} />
                </View>
                
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={handleStartTyping}
                  disabled={isLoading}
                >
                  <Feather name="edit-2" size={24} color="#5c7ba9" />
                  <Text style={styles.actionButtonText}>Wpisz ręcznie</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.importButton, isLoading ? styles.importButtonDisabled : null, !text ? styles.importButtonDisabled : null]}
            onPress={handleImport}
            disabled={isLoading || !text}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="text-snippet" size={20} color="#fff" style={styles.buttonIcon} />
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
export default TextImportModal;

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
    maxHeight: '80%',
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
  textAreaContainer: {
    height: 200,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 24,
    position: 'relative',
  },
  textInputWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  textInput: {
    flex: 1,
    width: '100%',
    height: '100%',
    textAlignVertical: 'top',
    padding: 12,
    fontSize: 16,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  actionButtonText: {
    color: '#5c7ba9',
    marginTop: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  orText: {
    marginHorizontal: 10,
    color: '#999',
    fontSize: 14,
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