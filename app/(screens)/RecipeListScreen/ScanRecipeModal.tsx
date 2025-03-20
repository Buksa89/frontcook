import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { scanRecipeApi } from '../../api';
import type { ScanRecipeResponse } from '../../api/scanRecipe';
import Toast, { showToast } from '../../components/Toast';

interface ScanRecipeModalProps {
  visible: boolean;
  onClose: () => void;
  onScanSuccess?: (taskId: string) => void;
}

export const ScanRecipeModal = ({ visible, onClose, onScanSuccess }: ScanRecipeModalProps) => {
  const [image, setImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      showToast({
        type: 'error',
        text1: 'Brak uprawnień',
        text2: 'Potrzebujemy uprawnień do galerii aby kontynuować!',
        visibilityTime: 4000,
        position: 'bottom'
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      showToast({
        type: 'error',
        text1: 'Brak uprawnień',
        text2: 'Potrzebujemy uprawnień do kamery aby kontynuować!',
        visibilityTime: 4000,
        position: 'bottom'
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      aspect: [4, 3],
      allowsMultipleSelection: false,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleScan = async () => {
    if (!image) {
      showToast({
        type: 'warning',
        text1: 'Brak zdjęcia',
        text2: 'Najpierw wybierz lub zrób zdjęcie przepisu',
        visibilityTime: 2000,
        position: 'bottom'
      });
      return;
    }
    
    // Start loading
    setIsLoading(true);
    
    try {
      // Call API to scan recipe from image using the dedicated API module
      const response = await scanRecipeApi.scanFromImage(image);
      
      // Show toast notification
      showToast({
        type: 'success',
        text1: 'Sukces!',
        text2: 'Zaczęliśmy analizować przepis. Damy Ci znać, gdy będzie gotowy! W tym czasie możesz dodać kolejny.',
        visibilityTime: 4000,
        position: 'bottom'
      });
      
      // Call success callback if provided
      if (onScanSuccess && response.task_id) {
        onScanSuccess(response.task_id);
      }
      
      // Reset image after success to allow adding another
      setImage(null);
      
      // No longer closing the modal automatically
      // Modal stays open so user can add another recipe
      
    } catch (err: any) {
      // Handle API error
      let errorMessage = 'Coś poszło nie tak. Może spróbuj ponownie za chwilę?';
      
      if (err.status === 401) {
        errorMessage = 'Hej, musisz się najpierw zalogować, żeby dodać przepis';
      } else if (err.data && err.data.error) {
        errorMessage = err.data.error;
      } else if (err.data && err.data.errors && err.data.errors.screenshot) {
        errorMessage = `Błąd zdjęcia: ${err.data.errors.screenshot.join(', ')}`;
      }
      
      // Show toast notification
      showToast({
        type: 'error',
        text1: 'Wystąpił błąd',
        text2: errorMessage,
        visibilityTime: 4000,
        position: 'bottom'
      });
      
      console.error('Scan recipe error:', err);
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
            <Text style={styles.title}>Zeskanuj przepis</Text>
            <TouchableOpacity onPress={onClose} disabled={isLoading}>
              <MaterialIcons name="close" size={24} color={isLoading ? "#ccc" : "#666"} />
            </TouchableOpacity>
          </View>

          {image ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: image }} style={styles.imagePreview} />
              <TouchableOpacity 
                style={styles.removeImageButton}
                onPress={() => setImage(null)}
                disabled={isLoading}
              >
                <MaterialIcons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.buttonGroup}>
              <TouchableOpacity 
                style={styles.optionButton}
                onPress={takePhoto}
                disabled={isLoading}
              >
                <MaterialIcons name="camera-alt" size={32} color="#2196F3" style={styles.buttonIcon} />
                <Text style={styles.buttonLabel}>Zrób zdjęcie</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.optionButton}
                onPress={pickImage}
                disabled={isLoading}
              >
                <MaterialIcons name="photo-library" size={32} color="#2196F3" style={styles.buttonIcon} />
                <Text style={styles.buttonLabel}>Wybierz z galerii</Text>
              </TouchableOpacity>
            </View>
          )}

          {image && (
            <TouchableOpacity 
              style={[styles.scanButton, isLoading ? styles.scanButtonDisabled : null]}
              onPress={handleScan}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="document-scanner" size={20} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.scanButtonText}>Skanuj</Text>
                </>
              )}
            </TouchableOpacity>
          )}
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
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1,
  },
  buttonIcon: {
    marginBottom: 8,
  },
  buttonLabel: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 4/3,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 6,
  },
  scanButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginTop: 8,
    minHeight: 48,
  },
  scanButtonDisabled: {
    backgroundColor: '#a0d0f7',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 