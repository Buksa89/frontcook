// src/features/recipes/components/AddRecipeMenu.tsx
import React, { useState } from 'react';
import { Modal, Pressable, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { showToast } from '../../../components/Toast';

// Importuj lub stwórz placeholdery dla modali
const WebImportModal = (props: any) => <Modal visible={props.visible}><TouchableOpacity onPress={props.onClose}><Text>Placeholder WebImportModal</Text></TouchableOpacity></Modal>;
const ScanRecipeModal = (props: any) => <Modal visible={props.visible}><TouchableOpacity onPress={props.onClose}><Text>Placeholder ScanRecipeModal</Text></TouchableOpacity></Modal>;
const PDFUploadModal = (props: any) => <Modal visible={props.visible}><TouchableOpacity onPress={props.onClose}><Text>Placeholder PDFUploadModal</Text></TouchableOpacity></Modal>;
const TextImportModal = (props: any) => <Modal visible={props.visible}><TouchableOpacity onPress={props.onClose}><Text>Placeholder TextImportModal</Text></TouchableOpacity></Modal>;
const AppImportModal = (props: any) => <Modal visible={props.visible}><TouchableOpacity onPress={props.onClose}><Text>Placeholder AppImportModal</Text></TouchableOpacity></Modal>;


interface AddRecipeMenuProps {
  visible: boolean;
  onClose: () => void;
  onTaskCreated?: (taskId: string, taskType: 'scan' | 'import' | 'pdf' | 'text' | 'app') => void;
}

export const AddRecipeMenu = ({ visible, onClose, onTaskCreated }: AddRecipeMenuProps) => {
  const { isAuthenticated } = useAuth();
  const [showWebImportModal, setShowWebImportModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [showTextImportModal, setShowTextImportModal] = useState(false);
  const [showAppImportModal, setShowAppImportModal] = useState(false);

  const handleAuthRequiredPress = () => {
    showToast({ type: 'warning', text1: 'Wymagane logowanie', text2: 'Zaloguj się, aby użyć tej funkcji.', visibilityTime: 3000 });
    onClose();
    router.push('/login');
  };

  const handleScanSuccess = (taskId: string) => { if (onTaskCreated) onTaskCreated(taskId, 'scan'); showToast({type: 'success', text1: 'Skanowanie rozpoczęte', text2: 'Otrzymasz powiadomienie.'}); };
  const handleImportSuccess = (taskId: string) => { if (onTaskCreated) onTaskCreated(taskId, 'import'); showToast({type: 'success', text1: 'Import rozpoczęty', text2: 'Otrzymasz powiadomienie.'}); };
  const handlePDFSuccess = (taskId: string) => { if (onTaskCreated) onTaskCreated(taskId, 'pdf'); showToast({type: 'success', text1: 'Przetwarzanie PDF rozpoczęte', text2: 'Otrzymasz powiadomienie.'}); };
  const handleTextImportSuccess = (taskId: string) => { if (onTaskCreated) onTaskCreated(taskId, 'text'); showToast({type: 'success', text1: 'Przetwarzanie tekstu rozpoczęte', text2: 'Otrzymasz powiadomienie.'}); };
  const handleAppImportSuccess = (taskId: string) => { if (onTaskCreated) onTaskCreated(taskId, 'app'); showToast({type: 'success', text1: 'Import rozpoczęty', text2: 'Otrzymasz powiadomienie.'}); };

  const openModal = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
      if (!isAuthenticated) { handleAuthRequiredPress(); return; }
      onClose(); setter(true);
  };

  return (
    <>
      <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <View style={styles.menuContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Dodaj przepis</Text>
              <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color="#666" /></TouchableOpacity>
            </View>

            {/* Opcja: Dodaj ręcznie */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                // --- POPRAWKA ŚCIEŻKI ---
                // Używamy string literal, który pasuje do struktury plików w `app/`
                router.push('/(screens)/RecipeManagementScreen');
                // Alternatywnie, jeśli masz Typed Routes:
                // router.push({ pathname: '/(screens)/RecipeManagementScreen' });
              }}
            >
              <View style={styles.menuItemContent}>
                <View style={styles.iconContainer}><MaterialIcons name="edit-note" size={24} color="#5c7ba9" /></View>
                <Text style={styles.menuItemText}>Dodaj ręcznie</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#ccc" />
            </TouchableOpacity>

             {/* Opcja: Z tekstu */}
            <TouchableOpacity style={styles.menuItem} onPress={() => openModal(setShowTextImportModal)} disabled={!isAuthenticated}>
              <View style={styles.menuItemContent}>
                <View style={[styles.iconContainer, !isAuthenticated && styles.iconContainerDisabled]}><MaterialIcons name="text-snippet" size={24} color={isAuthenticated ? "#5c7ba9" : "#999"} /></View>
                <Text style={[styles.menuItemText, !isAuthenticated && styles.menuItemTextDisabled]}>Z tekstu</Text>
              </View>
              {!isAuthenticated && (<Text style={styles.requiresAuthText}>Wymaga logowania</Text>)}
              <MaterialIcons name="chevron-right" size={24} color={isAuthenticated ? "#ccc" : "#eee"} />
            </TouchableOpacity>

            {/* Opcja: Zeskanuj (Screenshot) */}
            <TouchableOpacity style={styles.menuItem} onPress={() => openModal(setShowScanModal)} disabled={!isAuthenticated}>
              <View style={styles.menuItemContent}>
                <View style={[styles.iconContainer, !isAuthenticated && styles.iconContainerDisabled]}><MaterialIcons name="camera-alt" size={24} color={isAuthenticated ? "#5c7ba9" : "#999"} /></View>
                <Text style={[styles.menuItemText, !isAuthenticated && styles.menuItemTextDisabled]}>Zeskanuj (zdjęcie)</Text>
              </View>
               {!isAuthenticated && (<Text style={styles.requiresAuthText}>Wymaga logowania</Text>)}
              <MaterialIcons name="chevron-right" size={24} color={isAuthenticated ? "#ccc" : "#eee"} />
            </TouchableOpacity>

            {/* Opcja: Z internetu (URL) */}
             <TouchableOpacity style={styles.menuItem} onPress={() => openModal(setShowWebImportModal)} disabled={!isAuthenticated}>
              <View style={styles.menuItemContent}>
                <View style={[styles.iconContainer, !isAuthenticated && styles.iconContainerDisabled]}><MaterialIcons name="language" size={24} color={isAuthenticated ? "#5c7ba9" : "#999"} /></View>
                <Text style={[styles.menuItemText, !isAuthenticated && styles.menuItemTextDisabled]}>Z internetu (URL)</Text>
              </View>
               {!isAuthenticated && (<Text style={styles.requiresAuthText}>Wymaga logowania</Text>)}
              <MaterialIcons name="chevron-right" size={24} color={isAuthenticated ? "#ccc" : "#eee"} />
            </TouchableOpacity>

             {/* Opcja: Cały PDF */}
             <TouchableOpacity style={styles.menuItem} onPress={() => openModal(setShowPDFModal)} disabled={!isAuthenticated}>
              <View style={styles.menuItemContent}>
                <View style={[styles.iconContainer, !isAuthenticated && styles.iconContainerDisabled]}><MaterialIcons name="picture-as-pdf" size={24} color={isAuthenticated ? "#5c7ba9" : "#999"} /></View>
                <Text style={[styles.menuItemText, !isAuthenticated && styles.menuItemTextDisabled]}>Importuj z PDF</Text>
              </View>
               {!isAuthenticated && (<Text style={styles.requiresAuthText}>Wymaga logowania</Text>)}
              <MaterialIcons name="chevron-right" size={24} color={isAuthenticated ? "#ccc" : "#eee"} />
            </TouchableOpacity>

            {/* Opcja: Z innej apki (TODO) */}
            <TouchableOpacity style={[styles.menuItem, styles.menuItemDisabled]} disabled={true}>
              <View style={styles.menuItemContent}>
                <View style={styles.iconContainerDisabled}><MaterialIcons name="apps" size={24} color="#999" /></View>
                <Text style={styles.menuItemTextDisabled}>Z innej aplikacji</Text>
              </View>
              <Text style={styles.comingSoonText}>Wkrótce</Text>
              <MaterialIcons name="chevron-right" size={24} color="#eee" />
            </TouchableOpacity>

          </View>
        </Pressable>
      </Modal>

       <WebImportModal visible={showWebImportModal} onClose={() => setShowWebImportModal(false)} onImportSuccess={handleImportSuccess} />
       <ScanRecipeModal visible={showScanModal} onClose={() => setShowScanModal(false)} onScanSuccess={handleScanSuccess} />
       <PDFUploadModal visible={showPDFModal} onClose={() => setShowPDFModal(false)} onPDFSuccess={handlePDFSuccess} />
       <TextImportModal visible={showTextImportModal} onClose={() => setShowTextImportModal(false)} onImportSuccess={handleTextImportSuccess} />
       {/* <AppImportModal visible={showAppImportModal} onClose={() => setShowAppImportModal(false)} onImportSuccess={handleAppImportSuccess} /> */}
    </>
  );
};

// --- Style ---
const styles = StyleSheet.create({
    // ... (style bez zmian) ...
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end', },
    menuContainer: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20, paddingTop: 8, maxHeight: '90%', },
    menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', },
    menuTitle: { fontSize: 18, fontWeight: '600', color: '#333', },
    menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, },
    menuItemContent: { flexDirection: 'row', alignItems: 'center', flex: 1, },
    iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginRight: 16, },
    iconContainerDisabled: { backgroundColor: '#f1f3f5', },
    menuItemText: { fontSize: 16, color: '#333', },
    menuItemTextDisabled: { fontSize: 16, color: '#adb5bd', },
    menuItemDisabled: { opacity: 0.7, },
    requiresAuthText: { fontSize: 11, color: '#6c757d', fontStyle: 'italic', marginRight: 8, },
    comingSoonText: { fontSize: 11, color: '#6c757d', fontStyle: 'italic', marginRight: 8, },
});