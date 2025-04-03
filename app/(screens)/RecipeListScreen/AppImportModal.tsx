import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, FlatList, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons, AntDesign } from '@expo/vector-icons';
import Toast, { showToast } from '../../components/Toast';
import { ninjaAppsApi } from '../../api';
import type { AppListResponse, NinjaImportResponse } from '../../api/ninjaApps';
import * as DocumentPicker from 'expo-document-picker';

interface AppImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImportSuccess?: (taskId: string) => void;
}

interface AppItem {
  id: string;  // app slug
  name: string; // app display name
}

type ModalState = 'list' | 'file';

export const AppImportModal = ({ visible, onClose, onImportSuccess }: AppImportModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [apps, setApps] = useState<AppItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [modalState, setModalState] = useState<ModalState>('list');
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [forceTrigger, setForceTrigger] = useState(0); // Add force trigger for refreshing

  // Log when the component renders
  console.log('[AppImportModal] Rendering modal, visible =', visible, 'apps.length =', apps.length);

  // Fetch apps when modal becomes visible
  useEffect(() => {
    console.log('[AppImportModal] useEffect triggered - visible:', visible, 'apps.length:', apps.length, 'forceTrigger:', forceTrigger, 'isLoadingApps:', isLoadingApps);
    
    if (visible && (apps.length === 0 || forceTrigger > 0) && !isLoadingApps) {
      console.log('[AppImportModal] Calling fetchApps()');
      fetchApps();
    }
  }, [visible, forceTrigger]);

  // Reset state when modal closes
  useEffect(() => {
    console.log('[AppImportModal] Visibility changed to:', visible);
    
    if (!visible) {
      setModalState('list');
      setSelectedApp(null);
      setSelectedFile(null);
    }
  }, [visible]);
  
  const fetchApps = async () => {
    console.log('[AppImportModal] fetchApps started');
    setIsLoadingApps(true);
    setError(null);
    
    try {
      console.log('[AppImportModal] Calling ninjaAppsApi.getAppList()');
      const response = await ninjaAppsApi.getAppList();
      
      // Log the raw response
      console.log('[AppImportModal] Raw API response:', response);
      console.log('[AppImportModal] Response type:', typeof response);
      
      // Convert object to array of AppItems
      const appsList: AppItem[] = Object.entries(response || {}).map(([id, name]) => ({
        id,
        name
      }));
      
      // Log the converted list
      console.log('[AppImportModal] Converted apps list:', appsList);
      
      if (appsList.length === 0) {
        console.warn('[AppImportModal] No apps found in the response');
      }
      
      setApps(appsList);
      
      // Log the state after update to verify 
      console.log('[AppImportModal] Apps state updated, length:', appsList.length);
      
      // Log state immediately after setting
      setTimeout(() => {
        console.log('[AppImportModal] Apps state after timeout:', apps.length);
      }, 0);
    } catch (err: any) {
      console.error('[AppImportModal] Failed to fetch apps list:', err);
      
      let errorMessage = 'Nie udało się pobrać listy aplikacji. Spróbuj ponownie później.';
      
      if (err.status === 401) {
        errorMessage = 'Wymagane jest zalogowanie, aby uzyskać dostęp do listy aplikacji.';
      } else if (err.status === 404) {
        errorMessage = 'Nie znaleziono endpointu z listą aplikacji. Skontaktuj się z administratorem.';
      } else if (err.data && err.data.error) {
        errorMessage = `Błąd: ${err.data.error}`;
      } else if (err.message) {
        errorMessage = `Problem z połączeniem: ${err.message}`;
      }
      
      setError(errorMessage);
      
      showToast({
        type: 'error',
        text1: 'Błąd',
        text2: 'Nie udało się pobrać listy aplikacji',
        visibilityTime: 3000,
        position: 'bottom'
      });
      
      // Log detailed error information
      console.log('API Error Details:', {
        status: err.status,
        data: err.data,
        message: err.message,
        endpoint: 'api/ninja/apps/'
      });
    } finally {
      console.log('[AppImportModal] fetchApps completed');
      setIsLoadingApps(false);
    }
  };

  const retryFetchApps = () => {
    setForceTrigger(prev => prev + 1);
  };

  const handleAppSelect = (app: AppItem) => {
    console.log('App selected:', app);
    setSelectedApp(app);
    setModalState('file');
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled) {
        setSelectedFile(result);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      showToast({
        type: 'error',
        text1: 'Błąd',
        text2: 'Nie udało się wybrać pliku',
        visibilityTime: 3000,
        position: 'bottom'
      });
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
  };

  const goBack = () => {
    setModalState('list');
    setSelectedApp(null);
    setSelectedFile(null);
  };

  const handleSubmit = async () => {
    if (!selectedApp || !selectedFile || selectedFile.canceled) {
      showToast({
        type: 'warning',
        text1: 'Brak pliku',
        text2: 'Wybierz plik do zaimportowania',
        visibilityTime: 3000,
        position: 'bottom'
      });
      return;
    }

    setIsLoading(true);

    try {
      const fileUri = selectedFile.assets[0].uri;
      const fileName = selectedFile.assets[0].name;

      const response = await ninjaAppsApi.importFromApp(
        selectedApp.id,
        fileUri,
        fileName
      );

      // Show success toast with detailed information
      showToast({
        type: 'success',
        text1: 'Plik został wysłany!',
        text2: `Plik zostanie przetworzony. Powiadomimy Cię, gdy proces zostanie zakończony.`,
        visibilityTime: 4000,
        position: 'bottom'
      });

      // Call the success callback if provided
      if (onImportSuccess && response.task_id) {
        onImportSuccess(response.task_id);
      } else if (onImportSuccess) {
        // If no task_id is provided, we still want to notify parent component
        onImportSuccess(response.app_id);
      }

      // Reset the component state after successful upload
      setSelectedFile(null);
      setModalState('list');
      setSelectedApp(null);
      
      // Close modal after success
      onClose();
    } catch (err: any) {
      console.error('Error importing from app:', err);
      
      let errorMessage = 'Nie udało się zaimportować przepisów. Spróbuj ponownie później.';
      
      if (err.status === 401) {
        errorMessage = 'Musisz być zalogowany, aby zaimportować przepisy';
      } else if (err.status === 404) {
        errorMessage = 'Nie znaleziono endpointu importu. Skontaktuj się z administratorem.';
      } else if (err.status === 400) {
        errorMessage = 'Nieprawidłowe dane. Sprawdź format pliku i spróbuj ponownie.';
      } else if (err.data && err.data.error) {
        errorMessage = err.data.error;
      } else if (err.data && err.data.message) {
        errorMessage = err.data.message;
      } else if (err.message) {
        errorMessage = `Problem z połączeniem: ${err.message}`;
      }
      
      showToast({
        type: 'error',
        text1: 'Błąd importu',
        text2: errorMessage,
        visibilityTime: 4000,
        position: 'bottom'
      });
      
      // Log detailed error information
      console.log('Import API Error Details:', {
        status: err.status,
        data: err.data,
        message: err.message,
        app: selectedApp?.id,
        file: selectedFile?.assets[0]?.name,
        endpoint: 'api/ninja/import/'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderAppItem = ({ item }: { item: AppItem }) => {
    console.log('Rendering app item:', item);
    return (
      <TouchableOpacity
        style={styles.appItem}
        onPress={() => handleAppSelect(item)}
        disabled={isLoading}
      >
        <Text style={styles.appName}>{item.name}</Text>
        <MaterialIcons name="chevron-right" size={24} color="#666" />
      </TouchableOpacity>
    );
  };

  const renderAppsList = () => {
    // Log current state values
    console.log('[AppImportModal] renderAppsList called, state:', {
      isLoadingApps,
      error,
      appsLength: apps.length,
      modalState
    });
    
    if (isLoadingApps) {
      console.log('[AppImportModal] Rendering loading indicator');
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#5c7ba9" />
          <Text style={styles.loadingText}>Ładowanie aplikacji...</Text>
        </View>
      );
    }

    if (error) {
      console.log('[AppImportModal] Rendering error state');
      return (
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color="#e53935" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retryFetchApps}>
            <Text style={styles.retryButtonText}>Spróbuj ponownie</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Check for zero length apps array
    if (!apps || apps.length === 0) {
      console.log('[AppImportModal] Rendering empty apps state');
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.noAppsText}>Nie znaleziono żadnych aplikacji</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retryFetchApps}>
            <Text style={styles.retryButtonText}>Odśwież</Text>
          </TouchableOpacity>
        </View>
      );
    }

    console.log('[AppImportModal] Rendering FlatList with data:', apps);
    
    return (
      <FlatList
        data={apps}
        renderItem={renderAppItem}
        keyExtractor={item => item.id}
        style={styles.appList}
        contentContainerStyle={styles.appListContent}
      />
    );
  };

  const renderFileSelection = () => {
    if (!selectedApp) return null;

    return (
      <View style={styles.fileSelectionContainer}>
        <Text style={styles.appNameHeader}>{selectedApp.name}</Text>
        
        {selectedFile && !selectedFile.canceled ? (
          <View style={styles.selectedFileContainer}>
            <View style={styles.fileInfo}>
              <MaterialIcons name="insert-drive-file" size={24} color="#5c7ba9" />
              <Text style={styles.fileName} numberOfLines={1}>
                {selectedFile.assets[0].name}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.clearFileButton} 
              onPress={clearFile}
              disabled={isLoading}
            >
              <AntDesign name="close" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.selectFileButton}
            onPress={pickFile}
            disabled={isLoading}
          >
            <MaterialIcons name="upload-file" size={32} color="#5c7ba9" />
            <Text style={styles.selectFileText}>Wybierz plik do importu</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={goBack}
            disabled={isLoading}
          >
            <Text style={styles.backButtonText}>Powrót</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.submitButton, 
              (!selectedFile || selectedFile.canceled || isLoading) ? styles.disabledButton : null
            ]}
            onPress={handleSubmit}
            disabled={!selectedFile || selectedFile.canceled || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Przetwórz plik</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      {(() => { console.log('[AppImportModal] Modal render - visible:', visible, 'modalState:', modalState); return null; })()}
      <Pressable 
        style={styles.modalOverlay}
        onPress={(event) => {
          console.log('[AppImportModal] Overlay pressed');
          onClose();
        }}
      >
        <View 
          style={styles.modalContent} 
          onStartShouldSetResponder={() => {
            console.log('[AppImportModal] onStartShouldSetResponder called');
            return true;
          }}
          onResponderGrant={() => {
            console.log('[AppImportModal] onResponderGrant called');
          }}
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              {modalState === 'list' 
                ? 'Importuj z innej aplikacji' 
                : 'Wybierz plik do importu'
              }
            </Text>
            <TouchableOpacity 
              onPress={() => {
                console.log('[AppImportModal] Close button pressed');
                onClose();
              }} 
              disabled={isLoading}
            >
              <MaterialIcons name="close" size={24} color={isLoading ? "#ccc" : "#666"} />
            </TouchableOpacity>
          </View>

          {modalState === 'list' && (
            <View style={styles.listContainer}>
              {(() => { console.log('[AppImportModal] Rendering list view'); return null; })()}
              <Text style={styles.subtitle}>Wybierz aplikację</Text>
              <View style={styles.flatListContainer}>
                {(() => { console.log('[AppImportModal] Rendering list container with height'); return null; })()}
                {renderAppsList()}
              </View>
            </View>
          )}

          {modalState === 'file' && (
            <>
              {(() => { console.log('[AppImportModal] Rendering file view'); return null; })()}
              {renderFileSelection()}
            </>
          )}
        </View>
      </Pressable>
      <Toast />
    </Modal>
  );
};

// Add default export for Expo Router compatibility
export default AppImportModal;

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
    height: '80%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  listContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  flatListContainer: {
    flex: 1,
    height: '100%',
    flexGrow: 1,
  },
  appList: {
    flex: 1,
    height: '100%',
  },
  appListContent: {
    paddingVertical: 8,
  },
  appItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  appName: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#e53935',
    textAlign: 'center',
    marginBottom: 16,
  },
  noAppsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#5c7ba9',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  fileSelectionContainer: {
    flex: 1,
    paddingVertical: 16,
  },
  appNameHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  selectedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 24,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileName: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  clearFileButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  selectFileButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  selectFileText: {
    fontSize: 16,
    color: '#5c7ba9',
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#5c7ba9',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#a0d0f7',
  },
}); 